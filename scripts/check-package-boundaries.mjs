#!/usr/bin/env node
/**
 * AFM-012 — architectural boundary enforcement, by resolved dependency path.
 *
 * The existing checkers cannot close this: `check-package-cycles.mjs` only sees
 * declared runtime dependency fields, and `check-workspace-contracts.mjs` only
 * sees declared scripts. A dependency can violate a boundary without creating a
 * cycle, and a source import can exist without ever being declared.
 *
 * Syntax and module resolution come from TypeScript rather than from a private
 * scanner. Two earlier versions of this file hand-rolled both, and external
 * review walked through each one: first with six ways to cross a boundary
 * undetected, then — after those were patched individually — with four more.
 * The pattern was the problem, not the individual gaps. A specifier written
 * `./capture.js` whose source is `capture.ts`, a `paths` alias in a package's
 * own tsconfig, real code inside a template interpolation, and a package whose
 * root conditional `exports` overrides its `main` are all ordinary in this
 * repository, and every one of them was certified clean.
 *
 * So imports are read from a real AST, and specifiers are resolved by
 * `ts.resolveModuleName` under the compiler options that actually govern the
 * importing file. What stays local is policy: which packages are protected,
 * what they may not reach, and the walk that follows first-party edges.
 *
 * Where an import inside protected production code cannot be resolved, that is
 * reported. Silence would certify a boundary that was never checked.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import ts from "typescript";

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

const SOURCE_EXT = /\.([cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git"]);

export function isTestScope(relativePath) {
  return TEST_SCOPE.test(relativePath);
}

/**
 * Bundler resolution honours `exports` and the source-extension substitution
 * that makes `./capture.js` resolve to `capture.ts`, which is how this
 * repository's TypeScript is written.
 */
const DEFAULT_OPTIONS = {
  allowJs: true,
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  resolveJsonModule: true,
};

function scriptKindFor(file) {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Extracts import specifiers with line numbers, from a real AST.
 *
 * Every module-referencing form the language has is a distinct node type, so
 * they are matched as nodes rather than by shape: static import and export,
 * `import x = require(...)`, dynamic `import()`, and `require()`. Because the
 * whole tree is walked, code nested inside a template interpolation is found
 * like any other code — the previous version blanked entire template literals
 * and lost the executable expressions inside them.
 *
 * A string that merely looks like an import is a StringLiteral, not a call, so
 * it is never collected. That falls out of reading syntax, rather than being a
 * special case bolted on.
 */
export function extractImports(source, fileName = "input.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName),
  );

  const found = [];
  const add = (node) => {
    // A template literal carrying substitutions is not a static specifier.
    if (!ts.isStringLiteralLike(node)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    found.push({ specifier: node.text, line: line + 1 });
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) add(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if ((isDynamicImport || isRequire) && node.arguments.length > 0) {
        add(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const unique = new Map(found.map((entry) => [`${entry.line}:${entry.specifier}`, entry]));
  return [...unique.values()].sort(
    (a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier),
  );
}

/** Workspace directory to declared package name, plus the manifests themselves. */
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
        manifests.set(parsed.name, { directory: `packages/${entry}`, manifest: parsed });
      }
    } catch {
      // Reported by the workspace checker, not here.
    }
  }
  return byDir;
}

/**
 * Resolves a workspace package subpath through its manifest.
 *
 * Workspace packages resolve from manifests rather than through node_modules so
 * the check does not depend on install state. The precedence rule is Node's:
 * `exports` wins over `main` wherever it applies. An earlier version treated a
 * root conditions object — `{"import": "./src/unsafe.mjs"}`, with no "." key —
 * as not covering ".", fell through to `main`, and followed a file the package
 * does not actually serve.
 */
export function resolvePackageSubpath(manifest, subpath) {
  const exports = manifest?.exports;
  const pick = (value) => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return null;
    for (const condition of ["bun", "import", "module", "default", "browser", "node", "require"]) {
      if (condition in value) {
        const resolved = pick(value[condition]);
        if (resolved) return resolved;
      }
    }
    return null;
  };

  if (typeof exports === "string") return subpath === "." ? exports : null;

  if (exports && typeof exports === "object") {
    const keys = Object.keys(exports);
    // Node's rule: a map whose keys are all subpaths is a subpath map; anything
    // else is a conditions object, and it applies to "." alone.
    const isSubpathMap = keys.length > 0 && keys.every((key) => key.startsWith("."));
    if (!isSubpathMap) return subpath === "." ? pick(exports) : null;

    if (subpath in exports) return pick(exports[subpath]);
    for (const [pattern, value] of Object.entries(exports)) {
      if (!pattern.includes("*")) continue;
      const [head, tail] = pattern.split("*");
      if (subpath.startsWith(head) && subpath.endsWith(tail)) {
        const star = subpath.slice(head.length, subpath.length - tail.length);
        const target = pick(value);
        if (target) return target.replace("*", star);
      }
    }
    // An exports map that does not list the subpath does not serve it, and
    // `main` does not reinstate it.
    return null;
  }

  if (subpath === ".") return manifest?.main ?? "src/index";
  return null;
}

/**
 * Compiler options governing a file, from the nearest tsconfig.
 *
 * "Nearest" matters: a protected package can carry its own tsconfig whose
 * `paths` map an alias straight at forbidden code, and reading only the two
 * root configuration files misses that entirely.
 */
export function compilerOptionsFor(file, root, cache = new Map()) {
  const stop = resolve(root);
  let dir = dirname(resolve(root, file));
  const visited = [];

  for (;;) {
    if (cache.has(dir)) {
      const hit = cache.get(dir);
      for (const seen of visited) cache.set(seen, hit);
      return hit;
    }
    visited.push(dir);

    const candidate = join(dir, "tsconfig.json");
    if (existsSync(candidate)) {
      const read = ts.readConfigFile(candidate, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, dir);
      const options = { ...DEFAULT_OPTIONS, ...parsed.options };
      for (const seen of visited) cache.set(seen, options);
      return options;
    }

    if (dir === stop) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const seen of visited) cache.set(seen, DEFAULT_OPTIONS);
  return DEFAULT_OPTIONS;
}

function repoRelative(absolute, root) {
  return relative(root, absolute).split(sep).join("/");
}

/** The workspace package owning a repo-relative path, if any. */
function ownerOf(relativePath, packagesByDir) {
  for (const [dir, name] of packagesByDir) {
    if (relativePath === dir || relativePath.startsWith(`${dir}/`)) {
      return { package: name, path: relativePath };
    }
  }
  return null;
}

/** The package a bare specifier belongs to: "puppeteer/lib/x" -> "puppeteer". */
function barePackageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Resolves an import to the workspace package that owns it.
 *
 * Workspace names are matched first so policy does not depend on install state;
 * everything else goes through the compiler's own resolver.
 */
export function resolveImportTarget(specifier, importingFile, root, packagesByDir, context = {}) {
  for (const name of packagesByDir.values()) {
    if (specifier === name || specifier.startsWith(`${name}/`)) {
      const rest = specifier.slice(name.length);
      return { kind: "package", package: name, path: null, subpath: rest ? `.${rest}` : "." };
    }
  }

  const options = compilerOptionsFor(importingFile, root, context.optionsCache);
  const resolved = ts.resolveModuleName(
    specifier,
    resolve(root, importingFile),
    options,
    ts.sys,
    context.moduleCache,
  );

  const file = resolved.resolvedModule?.resolvedFileName;
  if (file) {
    const rel = repoRelative(resolve(file), root);
    if (rel.startsWith("..") || rel.includes("node_modules/")) {
      return { kind: "external", package: barePackageName(specifier), path: null };
    }
    const owned = ownerOf(rel, packagesByDir);
    if (owned) return { kind: "package", package: owned.package, path: owned.path };
    return { kind: "unresolved", package: null, detail: `resolves to ${rel}, outside any package` };
  }

  if (specifier.startsWith(".")) {
    return {
      kind: "unresolved",
      package: null,
      detail: `relative specifier ${specifier} does not resolve to a file`,
    };
  }
  // A bare specifier the compiler cannot resolve is third-party and not
  // installed here. Its name still decides the policy question.
  return { kind: "external", package: barePackageName(specifier), path: null };
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
      else if (SOURCE_EXT.test(entry)) files.push(repoRelative(abs, root));
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
export function checkRule(rule, root, packagesByDir, manifests = new Map(), context = {}) {
  const violations = [];
  const unresolved = [];
  const seen = new Set();
  const ctx = {
    optionsCache: context.optionsCache ?? new Map(),
    moduleCache: context.moduleCache ?? ts.createModuleResolutionCache(root, (x) => x),
  };

  const walk = (file, chain, originScope) => {
    if (seen.has(file)) return;
    seen.add(file);

    let source;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      return;
    }

    // Only production origins are reported: a harness may legitimately reach
    // code this check cannot resolve, but production reaching it means the
    // boundary went unverified.
    const note = (line, specifier, detail) => {
      if (originScope !== "production") return;
      unresolved.push({ rule: rule.package, file, line, specifier, detail });
    };

    for (const { specifier, line } of extractImports(source, file)) {
      const target = resolveImportTarget(specifier, file, root, packagesByDir, ctx);

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

      if (target.kind === "unresolved") {
        note(line, specifier, target.detail);
        continue;
      }

      // A path inside the repository: follow the file itself.
      if (target.path) {
        const resolved = resolveFile(root, target.path);
        if (resolved) {
          walk(resolved, [...chain, `${file}:${line}`], originScope);
        } else {
          note(line, specifier, `resolved to ${target.path}, which is not a readable file`);
        }
        continue;
      }

      // A workspace import: follow whatever the package's manifest serves.
      const owner = manifests.get(target.package);
      const served = owner ? resolvePackageSubpath(owner.manifest, target.subpath ?? ".") : null;
      const entry = served
        ? resolveFile(root, `${owner.directory}/${served.replace(/^\.\//, "")}`)
        : null;
      if (entry) {
        walk(entry, [...chain, `${file}:${line}`], originScope);
      } else {
        note(
          line,
          specifier,
          owner
            ? `${target.package} serves no resolvable file for ${target.subpath ?? "."}`
            : `${target.package} is not a known workspace package`,
        );
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
  const context = {
    optionsCache: new Map(),
    moduleCache: ts.createModuleResolutionCache(root, (x) => x),
  };
  const violations = [];
  const unresolved = [];
  for (const rule of rules) {
    const result = checkRule(rule, root, packagesByDir, manifests, context);
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
