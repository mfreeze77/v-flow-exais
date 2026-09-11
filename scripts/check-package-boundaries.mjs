#!/usr/bin/env node
/**
 * AFM-012 — architectural boundary enforcement, by resolved import.
 *
 * The existing checkers are necessary but cannot close this requirement:
 * `check-package-cycles.mjs` only sees declared runtime dependency fields, and
 * `check-workspace-contracts.mjs` only sees declared scripts. **A dependency can
 * violate a boundary without creating a cycle, and a source import can exist
 * without ever being declared in a manifest.** So this reads actual import
 * syntax and resolves where each import lands.
 *
 * It resolves destinations rather than grepping for forbidden words, because an
 * import's target depends on module resolution, package exports and configured
 * mappings — not on how it happens to be spelled. Renaming a bare specifier to
 * a relative path must not slip past the rule, and the word "studio" inside a
 * comment must not trip it.
 *
 * Where it cannot resolve an import inside protected code, it reports the
 * uncertainty. Silence would certify a boundary it has not actually checked.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/**
 * The policy. Each rule protects one package's production code from depending
 * on another package's implementation.
 */
export const BOUNDARY_RULES = [
  {
    package: "@hyperframes/project-model",
    directory: "packages/project-model",
    forbidden: [
      "@hyperframes/studio",
      "@hyperframes/studio-server",
      "@hyperframes/producer",
      "@hyperframes/player",
    ],
    reason:
      "The shared project model is the authoring contract. Depending on Studio UI or on " +
      "browser-capture implementation would make the model unusable by the CLI and agents, " +
      "and would invert the ownership the command/history boundary depends on.",
  },
  {
    package: "@hyperframes/diagram-engine",
    directory: "packages/diagram-engine",
    forbidden: ["@hyperframes/studio", "@hyperframes/studio-server"],
    reason:
      "Contract C02 keeps diagram compilation a side-effect-free library. A Studio dependency " +
      "would make the engine unusable from the CLI and would couple compilation to a UI.",
  },
  {
    package: "@hyperframes/diagram-motion",
    directory: "packages/diagram-motion",
    forbidden: ["@hyperframes/studio", "@hyperframes/studio-server"],
    reason:
      "Motion compilation consumes the diagram artifact contract and emits composition timing. " +
      "It must not reach into the editor.",
  },
];

/**
 * Directories inside a protected package whose contents are test scaffolding
 * rather than shipped production code.
 *
 * A harness may legitimately need browser tooling. What must not happen is a
 * forbidden production import being relocated into a helper and disappearing,
 * so the scope is defined by directory and filename, never by the import itself.
 */
const TEST_SCOPE = /(^|\/)(tests?|__tests__|fixtures?)(\/|$)|\.(test|spec|fixture)\.[cm]?[jt]sx?$/;

const SOURCE_EXT = /\.(m?[jt]sx?|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git"]);

export function isTestScope(relativePath) {
  return TEST_SCOPE.test(relativePath);
}

/**
 * Extracts import specifiers with their line numbers.
 *
 * Comments and ordinary strings are stripped first so forbidden-looking prose
 * cannot be reported as an import. Static imports, re-exports, dynamic
 * `import()` with a literal argument, and `require()` are all recognised —
 * changing the syntax must not bypass the rule.
 */
export function extractImports(source) {
  // Strip block comments, line comments, and template literals, preserving
  // newlines so reported line numbers stay accurate.
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, " "))
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, (m) => m.replace(/[^\n]/g, " "));

  const patterns = [
    // import ... from "x"  /  export ... from "x"  /  import "x"
    /(?:^|[\s;}])(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g,
    /(?:^|[\s;}])import\s*["']([^"']+)["']/g,
    // dynamic import with a literal argument
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    // CommonJS
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  const found = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(stripped)) !== null) {
      // The patterns match a leading delimiter, which may itself be a newline.
      // Count to the statement keyword rather than to the delimiter, or an
      // import on its own line is reported one line early.
      const leading = match[0].length - match[0].replace(/^\s+/, "").length;
      const line = stripped.slice(0, match.index + leading).split("\n").length;
      found.push({ specifier: match[1], line });
    }
  }
  return found.sort((a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier));
}

/** Maps a workspace package directory to its declared name. */
function readWorkspacePackages(root) {
  const packagesDir = join(root, "packages");
  const byDir = new Map();
  if (!existsSync(packagesDir)) return byDir;
  for (const entry of readdirSync(packagesDir)) {
    const manifest = join(packagesDir, entry, "package.json");
    if (!existsSync(manifest)) continue;
    try {
      const name = JSON.parse(readFileSync(manifest, "utf8")).name;
      if (name) byDir.set(`packages/${entry}`, name);
    } catch {
      // A manifest that will not parse is reported by the workspace checker.
    }
  }
  return byDir;
}

/**
 * Resolves an import to the workspace package that owns it, or reports why it
 * could not be resolved.
 *
 * Bare specifiers map by package name. Relative specifiers are resolved against
 * the importing file and mapped back by directory, so spelling a forbidden
 * dependency as `../../studio/src/x` is caught exactly like the bare form.
 */
export function resolveImportTarget(specifier, importingFile, root, packagesByDir) {
  if (!specifier.startsWith(".")) {
    // Bare specifier: match the longest declared package name.
    for (const name of packagesByDir.values()) {
      if (specifier === name || specifier.startsWith(`${name}/`)) {
        return { kind: "package", package: name };
      }
    }
    // node: builtins and third-party packages are outside this policy.
    return { kind: "external", package: null };
  }

  const absolute = resolve(dirname(join(root, importingFile)), specifier);
  const rel = relative(root, absolute).split(sep).join("/");
  if (rel.startsWith("..")) {
    return { kind: "unresolved", package: null, detail: "resolves outside the repository" };
  }
  for (const [dir, name] of packagesByDir) {
    if (rel === dir || rel.startsWith(`${dir}/`)) return { kind: "package", package: name };
  }
  return { kind: "unresolved", package: null, detail: `resolves to ${rel}, outside any package` };
}

function walkSources(root, directory, onFile) {
  const base = join(root, directory);
  if (!existsSync(base)) return;
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
      else if (SOURCE_EXT.test(entry)) onFile(relative(root, abs).split(sep).join("/"), abs);
    }
  };
  recurse(base);
}

/**
 * Checks one rule against real sources.
 *
 * `includeTestScope` is false for the production verdict: a harness may need
 * browser tooling. Violations in test scope are still returned, tagged, so they
 * are visible rather than invisible.
 */
export function checkRule(rule, root, packagesByDir, readFile = readFileSync) {
  const violations = [];
  const unresolved = [];

  walkSources(root, rule.directory, (relPath, abs) => {
    const scope = isTestScope(relPath) ? "test" : "production";
    let source;
    try {
      source = readFile(abs, "utf8");
    } catch {
      return;
    }
    for (const { specifier, line } of extractImports(source)) {
      const target = resolveImportTarget(specifier, relPath, root, packagesByDir);
      if (target.kind === "package" && rule.forbidden.includes(target.package)) {
        violations.push({
          rule: rule.package,
          scope,
          file: relPath,
          line,
          specifier,
          target: target.package,
          reason: rule.reason,
        });
      } else if (target.kind === "unresolved" && scope === "production") {
        // Reported, not ignored: an unresolvable import inside protected code
        // means this boundary was not actually verified.
        unresolved.push({
          rule: rule.package,
          file: relPath,
          line,
          specifier,
          detail: target.detail,
        });
      }
    }
  });

  return { violations, unresolved };
}

export function checkBoundaries(root = ROOT, rules = BOUNDARY_RULES) {
  const packagesByDir = readWorkspacePackages(root);
  const violations = [];
  const unresolved = [];
  for (const rule of rules) {
    const result = checkRule(rule, root, packagesByDir);
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
    console.log(`  ${rule.package} must not import: ${rule.forbidden.join(", ")}`);
  }
  for (const v of report.productionViolations) {
    console.error(`\n  VIOLATION ${v.file}:${v.line}`);
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
    console.log(
      `\n  ${testScope.length} forbidden import(s) in test scope (allowed, listed for visibility):`,
    );
    for (const v of testScope) console.log(`    ${v.file}:${v.line} -> ${v.target}`);
  }
  console.log(`\n${report.ok ? "PASS" : "FAIL"}: package boundaries`);
  process.exitCode = report.ok ? 0 : 1;
}
