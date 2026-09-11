#!/usr/bin/env node
/**
 * AFM-012 — architectural boundary enforcement, by resolved dependency path.
 *
 * The existing checkers cannot close this: `check-package-cycles.mjs` only sees
 * declared runtime dependency fields, and `check-workspace-contracts.mjs` only
 * sees declared scripts. A dependency can violate a boundary without creating a
 * cycle, and a source import can exist without ever being declared.
 *
 * An earlier version of this file checked only direct imports inside the
 * protected package. External review demonstrated six ways to cross the same
 * boundary without tripping it, and one false positive. Each is now covered:
 *
 *   - a configured tsconfig `paths` alias pointing at forbidden code
 *   - a chain through another first-party package
 *   - production code importing a test-scope helper that re-exports it
 *   - a template-literal dynamic import
 *   - a `.cts` / `.mts` production file
 *   - a direct third-party browser-capture dependency
 *   - import-shaped text inside an ordinary string, reported as a violation
 *
 * Where an import inside protected production code cannot be resolved, that is
 * reported. Silence would certify a boundary that was never checked.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/**
 * Browser-capture and editor packages that must not become dependencies of the
 * authoring contract. Third-party tooling is named explicitly: forbidding only
 * workspace packages leaves a direct `puppeteer` import unchallenged.
 */
export const BROWSER_CAPTURE_PACKAGES = [
  "puppeteer",
  "puppeteer-core",
  "playwright",
  "playwright-core",
];

export const BOUNDARY_RULES = [
  {
    package: "@hyperframes/project-model",
    directory: "packages/project-model",
    forbidden: [
      "@hyperframes/studio",
      "@hyperframes/studio-server",
      "@hyperframes/producer",
      "@hyperframes/player",
      ...BROWSER_CAPTURE_PACKAGES,
    ],
    reason:
      "The shared project model is the authoring contract. Depending on Studio UI or on " +
      "browser-capture implementation would make it unusable by the CLI and agents, and would " +
      "invert the ownership the command/history boundary depends on.",
  },
  {
    package: "@hyperframes/diagram-engine",
    directory: "packages/diagram-engine",
    forbidden: ["@hyperframes/studio", "@hyperframes/studio-server", ...BROWSER_CAPTURE_PACKAGES],
    reason:
      "Contract C02 keeps diagram compilation a side-effect-free library. A Studio or browser " +
      "dependency would make the engine unusable from the CLI and couple compilation to a UI.",
  },
  {
    package: "@hyperframes/diagram-motion",
    directory: "packages/diagram-motion",
    forbidden: ["@hyperframes/studio", "@hyperframes/studio-server", ...BROWSER_CAPTURE_PACKAGES],
    reason:
      "Motion compilation consumes the diagram artifact contract and emits composition timing. " +
      "It must not reach into the editor or drive a browser.",
  },
];

/**
 * Test scaffolding, by location and filename — never by what it imports.
 *
 * A harness may legitimately use browser tooling. What must not happen is a
 * forbidden dependency escaping because it was moved behind a helper, so test
 * scope stops a file being a *violation site*, not a *dependency path*: once
 * production code imports a test-scope file, the chain is followed regardless.
 */
const TEST_SCOPE = /(^|\/)(tests?|__tests__|fixtures?)(\/|$)|\.(test|spec|fixture)\.[cm]?[jt]sx?$/;

/** Includes .cts/.mts — omitting them left a whole production file class unchecked. */
const SOURCE_EXT = /\.([cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git"]);

export function isTestScope(relativePath) {
  return TEST_SCOPE.test(relativePath);
}

/**
 * Removes comments and string literals before scanning, so prose and ordinary
 * strings cannot be read as imports.
 *
 * Newlines are preserved so reported line numbers stay accurate. Quoted strings
 * are blanked too: an earlier version stripped only template literals, so
 * `const s = "await import('@hyperframes/studio')"` was reported as a violation.
 */
export function stripNonCode(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  const blank = (text) => text.replace(/[^\n]/g, " ");

  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (two === "//") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      // Keep the delimiters so an import's specifier position is still findable
      // when it IS an import; blank only the contents.
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === ch) break;
        j += 1;
      }
      const stop = Math.min(j + 1, n);
      out += ch + blank(source.slice(i + 1, stop - 1)) + (source[stop - 1] === ch ? ch : "");
      i = stop;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Extracts import specifiers with line numbers.
 *
 * Specifiers are read from the ORIGINAL source at the offsets located in the
 * stripped copy, so blanked string contents do not erase the specifier itself.
 * Template-literal dynamic imports are included: changing the quote style must
 * not bypass the rule.
 */
export function extractImports(source) {
  const stripped = stripNonCode(source);
  const patterns = [
    /(?:^|[\s;})])(?:import|export)\s[^;]*?from\s*(["'`])/g,
    /(?:^|[\s;})])import\s*(["'`])/g,
    /\bimport\s*\(\s*(["'`])/g,
    /\brequire\s*\(\s*(["'`])/g,
  ];

  const found = new Map();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(stripped)) !== null) {
      // The quote position in the stripped copy maps 1:1 onto the original.
      const quoteAt = match.index + match[0].length - 1;
      const quote = match[1];
      const close = source.indexOf(quote, quoteAt + 1);
      if (close === -1) continue;
      const specifier = source.slice(quoteAt + 1, close);
      // A template literal with an interpolation is not a static specifier.
      if (specifier.includes("${")) continue;
      const leading = match[0].length - match[0].replace(/^\s+/, "").length;
      const line = stripped.slice(0, match.index + leading).split("\n").length;
      found.set(`${line}:${specifier}`, { specifier, line });
    }
  }
  return [...found.values()].sort(
    (a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier),
  );
}

/** Workspace directory to declared package name. */
/**
 * Resolves a workspace package subpath to a source file through its manifest.
 *
 * Walking to `<dir>/src/index` by convention is wrong twice over: a subpath
 * import such as `@hyperframes/studio-server/finite-mutation` would be followed
 * into the package's index instead of the module actually imported, and a
 * package whose entry is declared elsewhere would not be followed at all — the
 * walk would stop silently and report the boundary clean.
 *
 * Source conditions are preferred over built ones so the check reads the code
 * in the repository rather than a stale artifact in dist/.
 */
export function resolvePackageSubpath(manifest, subpath) {
  const exports = manifest?.exports;
  const pick = (value) => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return null;
    for (const condition of ["bun", "import", "module", "default", "browser", "node", "types"]) {
      if (condition in value) {
        const resolved = pick(value[condition]);
        if (resolved) return resolved;
      }
    }
    return null;
  };

  if (typeof exports === "string" && subpath === ".") return exports;
  if (exports && typeof exports === "object") {
    if (subpath in exports) return pick(exports[subpath]);
    // Wildcard subpaths, e.g. "./helpers/*": "./src/helpers/*.ts".
    for (const [pattern, value] of Object.entries(exports)) {
      if (!pattern.includes("*")) continue;
      const [head, tail] = pattern.split("*");
      if (subpath.startsWith(head) && subpath.endsWith(tail)) {
        const star = subpath.slice(head.length, subpath.length - tail.length);
        const target = pick(value);
        if (target) return target.replace("*", star);
      }
    }
    // An exports map that does not list the subpath does not serve it.
    if (subpath !== ".") return null;
  }
  if (subpath === ".") return manifest?.main ?? "src/index";
  return null;
}

export function readWorkspacePackages(root, manifests = new Map()) {
  const packagesDir = join(root, "packages");
  const byDir = new Map();
  if (!existsSync(packagesDir)) return byDir;
  for (const entry of readdirSync(packagesDir)) {
    const manifest = join(packagesDir, entry, "package.json");
    if (!existsSync(manifest)) continue;
    try {
      const parsed = JSON.parse(readFileSync(manifest, "utf8"));
      if (parsed.name) {
        byDir.set(`packages/${entry}`, parsed.name);
        // Kept alongside the name so the walk can follow a bare or subpath
        // import to the file the package actually serves for it.
        manifests.set(parsed.name, { directory: `packages/${entry}`, manifest: parsed });
      }
    } catch {
      // Reported by the workspace checker, not here.
    }
  }
  return byDir;
}

/**
 * Reads tsconfig `paths` so a configured alias cannot hide a forbidden target.
 * TypeScript remaps these, so treating every unfamiliar bare specifier as an
 * ordinary external package cannot establish the boundary.
 */
export function readPathAliases(root) {
  const aliases = [];
  for (const name of ["tsconfig.json", "tsconfig.base.json"]) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    try {
      // Tolerate comments: tsconfig permits them, JSON.parse does not.
      const text = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      const config = JSON.parse(text);
      const paths = config?.compilerOptions?.paths ?? {};
      const baseUrl = config?.compilerOptions?.baseUrl ?? ".";
      for (const [pattern, targets] of Object.entries(paths)) {
        for (const target of targets) {
          aliases.push({ pattern, target, baseUrl });
        }
      }
    } catch {
      // An unreadable tsconfig is reported as unresolved at use sites.
    }
  }
  return aliases;
}

function matchAlias(specifier, aliases) {
  for (const { pattern, target, baseUrl } of aliases) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      if (specifier.startsWith(prefix)) {
        return join(baseUrl, target.slice(0, -1) + specifier.slice(prefix.length));
      }
    } else if (specifier === pattern) {
      return join(baseUrl, target);
    }
  }
  return null;
}

/** Resolves an import to the workspace package that owns it. */
export function resolveImportTarget(specifier, importingFile, root, packagesByDir, aliases = []) {
  const byDirectory = (rel) => {
    for (const [dir, name] of packagesByDir) {
      if (rel === dir || rel.startsWith(`${dir}/`))
        return { kind: "package", package: name, path: rel };
    }
    return null;
  };

  if (!specifier.startsWith(".")) {
    for (const name of packagesByDir.values()) {
      if (specifier === name || specifier.startsWith(`${name}/`)) {
        // The subpath is carried through so the walk follows the module the
        // package actually serves, not whatever happens to sit at its index.
        const rest = specifier.slice(name.length);
        return { kind: "package", package: name, path: null, subpath: rest ? `.${rest}` : "." };
      }
    }
    const aliased = matchAlias(specifier, aliases);
    if (aliased) {
      const rel = relative(root, resolve(root, aliased)).split(sep).join("/");
      const owned = byDirectory(rel);
      if (owned) return owned;
      return {
        kind: "unresolved",
        package: null,
        detail: `alias ${specifier} resolves to ${rel}, outside any package`,
      };
    }
    // Third-party or node builtin. Named third-party packages are matched by
    // the rule's forbidden list directly.
    return { kind: "external", package: specifier, path: null };
  }

  const absolute = resolve(dirname(join(root, importingFile)), specifier);
  const rel = relative(root, absolute).split(sep).join("/");
  if (rel.startsWith("..")) {
    return { kind: "unresolved", package: null, detail: "resolves outside the repository" };
  }
  const owned = byDirectory(rel);
  if (owned) return owned;
  return { kind: "unresolved", package: null, detail: `resolves to ${rel}, outside any package` };
}

function listSources(root, directory) {
  const base = join(root, directory);
  const files = [];
  if (!existsSync(base)) return files;
  const recurse = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const abs = join(dir, entry);
      let stats;
      try {
        stats = statSync(abs);
      } catch {
        continue;
      }
      if (stats.isDirectory()) recurse(abs);
      else if (SOURCE_EXT.test(entry)) files.push(relative(root, abs).split(sep).join("/"));
    }
  };
  recurse(base);
  return files;
}

/** Resolves a repo-relative module path to a real file, trying extensions. */
function resolveFile(root, rel) {
  const candidates = [rel];
  for (const ext of [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"]) {
    candidates.push(`${rel}${ext}`, `${rel}/index${ext}`);
  }
  for (const candidate of candidates) {
    const abs = join(root, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) return candidate;
  }
  return null;
}

/**
 * Follows first-party dependency paths from protected production code.
 *
 * A direct import is only the simplest way to cross a boundary. Reaching
 * forbidden code through another workspace package, or through a test-scope
 * helper that production code imports, crosses exactly the same line — so the
 * chain is walked and the path reported.
 */
export function checkRule(rule, root, packagesByDir, aliases = [], manifests = new Map()) {
  const violations = [];
  const unresolved = [];
  const seen = new Set();

  const walk = (file, chain, originScope) => {
    if (seen.has(file)) return;
    seen.add(file);

    let source;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      return;
    }

    for (const { specifier, line } of extractImports(source)) {
      const target = resolveImportTarget(specifier, file, root, packagesByDir, aliases);

      if (rule.forbidden.includes(target.package)) {
        violations.push({
          rule: rule.package,
          scope: originScope,
          file: chain[0],
          line: chain.length === 1 ? line : null,
          via: chain.length > 1 ? [...chain.slice(1), `${file}:${line}`] : [],
          specifier,
          target: target.package,
          reason: rule.reason,
        });
        continue;
      }

      if (target.kind === "external") continue;

      // Follow first-party destinations, inside this package or another.
      if (target.path) {
        const resolved = resolveFile(root, target.path);
        if (resolved) {
          walk(resolved, [...chain, `${file}:${line}`], originScope);
          continue;
        }
      }
      if (target.kind === "package" && !target.path) {
        // A workspace import: follow the file the package's manifest serves for
        // this exact subpath.
        const owner = manifests.get(target.package);
        const served = owner ? resolvePackageSubpath(owner.manifest, target.subpath ?? ".") : null;
        const entry = served
          ? resolveFile(root, `${owner.directory}/${served.replace(/^\.\//, "")}`)
          : null;
        if (entry) {
          walk(entry, [...chain, `${file}:${line}`], originScope);
        } else if (originScope === "production") {
          // Not following it silently: an unresolved first-party entry means
          // the chain beyond this point was never checked.
          unresolved.push({
            rule: rule.package,
            file,
            line,
            specifier,
            detail: owner
              ? `${target.package} serves no resolvable file for ${target.subpath ?? "."}`
              : `${target.package} is not a known workspace package`,
          });
        }
        continue;
      }
      if (target.kind === "unresolved" && originScope === "production") {
        unresolved.push({ rule: rule.package, file, line, specifier, detail: target.detail });
      }
    }
  };

  for (const file of listSources(root, rule.directory)) {
    seen.clear();
    walk(file, [file], isTestScope(file) ? "test" : "production");
  }

  return { violations, unresolved };
}

export function checkBoundaries(root = ROOT, rules = BOUNDARY_RULES) {
  const manifests = new Map();
  const packagesByDir = readWorkspacePackages(root, manifests);
  const aliases = readPathAliases(root);
  const violations = [];
  const unresolved = [];
  for (const rule of rules) {
    const result = checkRule(rule, root, packagesByDir, aliases, manifests);
    violations.push(...result.violations);
    unresolved.push(...result.unresolved);
  }
  const productionViolations = violations.filter((v) => v.scope === "production");
  return {
    rules: rules.map((r) => ({ package: r.package, forbidden: r.forbidden })),
    violations,
    productionViolations,
    unresolved,
    ok: productionViolations.length === 0 && unresolved.length === 0,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join("/"))) {
  const report = checkBoundaries();
  for (const rule of report.rules) {
    console.log(`  ${rule.package} must not depend on: ${rule.forbidden.join(", ")}`);
  }
  for (const v of report.productionViolations) {
    console.error(`\n  VIOLATION ${v.file}${v.line ? `:${v.line}` : ""}`);
    if (v.via.length > 0) console.error(`    via ${v.via.join(" -> ")}`);
    console.error(`    imports ${JSON.stringify(v.specifier)} -> ${v.target}`);
    console.error(`    ${v.reason}`);
  }
  for (const u of report.unresolved) {
    console.error(
      `\n  UNRESOLVED ${u.file}:${u.line} ${JSON.stringify(u.specifier)} — ${u.detail}`,
    );
    console.error("    The boundary was not verified for this import.");
  }
  const testScope = report.violations.filter((v) => v.scope === "test");
  if (testScope.length > 0) {
    console.log(`\n  ${testScope.length} forbidden import(s) reached only from test scope:`);
    for (const v of testScope) console.log(`    ${v.file} -> ${v.target}`);
  }
  console.log(`\n${report.ok ? "PASS" : "FAIL"}: package boundaries`);
  process.exitCode = report.ok ? 0 : 1;
}
