import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BOUNDARY_RULES,
  checkBoundaries,
  checkRule,
  extractImports,
  isTestScope,
  compilerOptionsFor,
  readWorkspacePackages,
  resolveImportTarget,
} from "./check-package-boundaries.mjs";

/** Builds a throwaway workspace so violations can be introduced deliberately. */
function workspace(files) {
  const root = mkdtempSync(join(tmpdir(), "boundaries-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const MANIFESTS = {
  "packages/project-model/package.json": '{"name":"@hyperframes/project-model"}',
  "packages/studio/package.json": '{"name":"@hyperframes/studio"}',
  "packages/producer/package.json": '{"name":"@hyperframes/producer"}',
  "packages/diagram-engine/package.json": '{"name":"@hyperframes/diagram-engine"}',
};

const RULE = BOUNDARY_RULES.find((r) => r.package === "@hyperframes/project-model");

/**
 * Checks a throwaway workspace the way checkBoundaries does: names, manifests
 * and aliases all read from the tree under test. Hand-built maps drift from the
 * real resolution path, and a case that passes against a hand-built map can
 * still miss what the checker does on the repository.
 */
function checkTempWorkspace(root, rule = RULE) {
  const manifests = new Map();
  const packages = readWorkspacePackages(root, manifests);
  return checkRule(rule, root, packages, manifests);
}

function runRule(root) {
  const packagesByDir = new Map([
    ["packages/project-model", "@hyperframes/project-model"],
    ["packages/studio", "@hyperframes/studio"],
    ["packages/producer", "@hyperframes/producer"],
    ["packages/diagram-engine", "@hyperframes/diagram-engine"],
  ]);
  return checkRule(RULE, root, packagesByDir);
}

describe("package boundaries — the real repository", () => {
  it("passes the declared policy", () => {
    const report = checkBoundaries();
    assert.deepEqual(report.productionViolations, []);
    assert.equal(report.ok, true);
  });

  it("reports no unresolvable import inside protected production code", () => {
    // An import the checker cannot resolve means the boundary was not verified.
    assert.deepEqual(checkBoundaries().unresolved, []);
  });

  it("actually protects the packages the ticket names", () => {
    const protectedPackages = BOUNDARY_RULES.map((r) => r.package);
    assert.ok(protectedPackages.includes("@hyperframes/project-model"));
    assert.ok(protectedPackages.includes("@hyperframes/diagram-engine"));
    const model = BOUNDARY_RULES.find((r) => r.package === "@hyperframes/project-model");
    assert.ok(model.forbidden.includes("@hyperframes/studio"));
    assert.ok(model.forbidden.includes("@hyperframes/producer"));
  });
});

describe("package boundaries — deliberately introduced violations", () => {
  it("fails a direct forbidden package import, naming file, line, target and rule", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/index.ts":
        'import { App } from "@hyperframes/studio";\nexport const x = App;\n',
    });
    const { violations } = runRule(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(violations.length, 1);
    assert.equal(violations[0].file, "packages/project-model/src/index.ts");
    assert.equal(violations[0].line, 1);
    assert.equal(violations[0].target, "@hyperframes/studio");
    assert.ok(violations[0].reason.length > 0);
    assert.equal(violations[0].scope, "production");
  });

  it("fails a relative path into the same forbidden package", () => {
    // Re-spelling the dependency must not bypass the rule.
    const root = workspace({
      ...MANIFESTS,
      "packages/studio/src/App.ts": "export const App = 1;\n",
      "packages/project-model/src/index.ts": 'import { App } from "../../studio/src/App";\n',
    });
    const { violations } = runRule(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(violations.length, 1);
    assert.equal(violations[0].target, "@hyperframes/studio");
  });

  it("fails a re-export that leads to forbidden code", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/index.ts": 'export * from "@hyperframes/producer";\n',
    });
    const { violations } = runRule(root);
    rmSync(root, { recursive: true, force: true });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].target, "@hyperframes/producer");
  });

  it("fails a literal dynamic import and a CommonJS require consistently", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/dyn.ts": 'const m = await import("@hyperframes/studio");\n',
      "packages/project-model/src/cjs.ts": 'const m = require("@hyperframes/producer");\n',
    });
    const { violations } = runRule(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(violations.length, 2);
    const targets = violations.map((v) => v.target).sort();
    assert.deepEqual(targets, ["@hyperframes/producer", "@hyperframes/studio"]);
  });

  it("does NOT report forbidden-looking text in comments or ordinary strings", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/index.ts": [
        '// This must never import from "@hyperframes/studio".',
        "/* @hyperframes/producer is forbidden here. */",
        'const doc = "see @hyperframes/studio for the editor";',
        'export const note = "@hyperframes/producer";',
        "",
      ].join("\n"),
    });
    const { violations, unresolved } = runRule(root);
    rmSync(root, { recursive: true, force: true });

    assert.deepEqual(violations, []);
    assert.deepEqual(unresolved, []);
  });

  it("reports an unresolvable import in production rather than certifying the boundary", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/index.ts": 'import x from "../../../outside/thing";\n',
    });
    const { unresolved } = runRule(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(unresolved.length, 1);
    assert.equal(unresolved[0].file, "packages/project-model/src/index.ts");
    assert.ok(unresolved[0].detail.length > 0);
  });
});

describe("package boundaries — production and test scope are distinct", () => {
  it("allows a forbidden import in test scope but still lists it", () => {
    // A harness needing browser tooling is not a production violation.
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/storage.test.ts":
        'import { launch } from "@hyperframes/producer";\n',
    });
    const { violations } = runRule(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(violations.length, 1);
    assert.equal(violations[0].scope, "test");
  });

  it("does not let a production violation escape by moving into a helper", () => {
    // Relocating the import must not make it disappear: the helper is still
    // production code inside the protected package.
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/helpers/capture.ts":
        'import { capture } from "@hyperframes/producer";\nexport { capture };\n',
    });
    const { violations } = runRule(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(violations.length, 1);
    assert.equal(violations[0].scope, "production");
  });

  it("classifies scope by location and filename, never by the import", () => {
    assert.equal(isTestScope("packages/x/src/a.test.ts"), true);
    assert.equal(isTestScope("packages/x/tests/a.ts"), true);
    assert.equal(isTestScope("packages/x/src/__tests__/a.ts"), true);
    assert.equal(isTestScope("packages/x/src/a.fixture.ts"), true);
    assert.equal(isTestScope("packages/x/src/a.ts"), false);
    assert.equal(isTestScope("packages/x/src/testing.ts"), false);
  });
});

describe("package boundaries — import extraction", () => {
  it("finds every supported import form with accurate line numbers", () => {
    const found = extractImports(
      [
        'import a from "one";',
        'export { b } from "two";',
        'import "three";',
        'const c = await import("four");',
        'const d = require("five");',
      ].join("\n"),
    );
    assert.deepEqual(found.map((f) => f.specifier).sort(), ["five", "four", "one", "three", "two"]);
    assert.equal(found.find((f) => f.specifier === "four").line, 4);
  });

  it("keeps line numbers accurate after stripping a block comment", () => {
    const found = extractImports('/*\n\n\n*/\nimport a from "target";\n');
    assert.equal(found[0].line, 5);
  });

  it("reads a template-literal dynamic import like any other", () => {
    // Changing the quote style must not change whether the rule applies.
    const found = extractImports("const m = await import(`@hyperframes/studio`);\n");
    assert.deepEqual(
      found.map((f) => f.specifier),
      ["@hyperframes/studio"],
    );
  });

  it("skips an interpolated specifier, which is not statically known", () => {
    assert.deepEqual(extractImports("const m = await import(`${base}/x`);\n"), []);
  });

  it("does not read import-shaped text inside an ordinary string", () => {
    // Reported as a violation by an earlier version: a quoted example is prose.
    assert.deepEqual(extractImports(`const s = "await import('@hyperframes/studio')";\n`), []);
    assert.deepEqual(extractImports('const s = `import x from "nope"`;\n'), []);
  });
});

describe("package boundaries — resolution", () => {
  const packagesByDir = new Map([
    ["packages/project-model", "@hyperframes/project-model"],
    ["packages/studio", "@hyperframes/studio"],
  ]);

  it("maps a bare specifier and its subpaths to the owning package", () => {
    const file = "packages/project-model/src/a.ts";
    assert.equal(
      resolveImportTarget("@hyperframes/studio", file, "/repo", packagesByDir).package,
      "@hyperframes/studio",
    );
    assert.equal(
      resolveImportTarget("@hyperframes/studio/sub/path", file, "/repo", packagesByDir).package,
      "@hyperframes/studio",
    );
  });

  it("treats node builtins and third-party packages as outside the policy", () => {
    const file = "packages/project-model/src/a.ts";
    assert.equal(resolveImportTarget("node:fs", file, "/repo", packagesByDir).kind, "external");
    assert.equal(resolveImportTarget("vitest", file, "/repo", packagesByDir).kind, "external");
  });

  it("maps a relative path back to the package that owns the destination", () => {
    // Resolution is the compiler's, so the destination has to exist on disk;
    // a synthetic root proves nothing about what the checker will really do.
    const root = workspace({
      ...MANIFESTS,
      "packages/studio/src/App.ts": "export const App = 1;\n",
      "packages/project-model/src/a.ts": 'import { App } from "../../studio/src/App";\n',
    });
    const target = resolveImportTarget(
      "../../studio/src/App",
      "packages/project-model/src/a.ts",
      root,
      readWorkspacePackages(root),
    );
    rmSync(root, { recursive: true, force: true });

    assert.equal(target.package, "@hyperframes/studio");
  });

  it("reports a relative specifier that resolves to nothing", () => {
    // The old resolver did textual path arithmetic and attributed an import
    // to a package whether or not any file was there. Reporting it keeps the
    // checker from certifying an edge it never actually followed.
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/a.ts": 'import { App } from "../../studio/src/Missing";\n',
    });
    const target = resolveImportTarget(
      "../../studio/src/Missing",
      "packages/project-model/src/a.ts",
      root,
      readWorkspacePackages(root),
    );
    rmSync(root, { recursive: true, force: true });

    assert.equal(target.kind, "unresolved");
  });
});

describe("package boundaries — crossings that a direct-import check misses", () => {
  /**
   * Each case below reaches forbidden code without a forbidden specifier ever
   * appearing in the protected package's own source. Checking only direct
   * imports declares every one of them clean.
   */

  it("follows a configured tsconfig alias to its forbidden target", () => {
    const root = workspace({
      ...MANIFESTS,
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@ui/*": ["packages/studio/src/*"] } },
      }),
      "packages/studio/src/App.ts": "export const App = 1;\n",
      "packages/project-model/src/a.ts": 'import { App } from "@ui/App";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "@hyperframes/studio");
    assert.equal(report.violations[0].specifier, "@ui/App");
  });

  it("follows a chain through another first-party package", () => {
    // project-model -> utils -> studio. Nothing forbidden is named in
    // project-model, and no dependency cycle exists for the cycle checker.
    const root = workspace({
      ...MANIFESTS,
      "packages/utils/package.json": '{"name":"@hyperframes/utils"}',
      "packages/utils/src/index.ts": 'export { App } from "@hyperframes/studio";\n',
      "packages/studio/src/index.ts": "export const App = 1;\n",
      "packages/project-model/src/a.ts": 'import { App } from "@hyperframes/utils";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    const violation = report.violations[0];
    assert.equal(violation.target, "@hyperframes/studio");
    // The path is reported, not just the endpoint: "a.ts imports utils" alone
    // does not tell anyone why it is a violation.
    assert.equal(violation.file, "packages/project-model/src/a.ts");
    assert.ok(violation.via.some((step) => step.includes("packages/utils/src/index.ts")));
  });

  it("does not let test scope exempt a dependency production code relies on", () => {
    // The helper is test-scope by filename, so it may import Studio freely.
    // Production importing that helper is a different fact, and is a violation.
    const root = workspace({
      ...MANIFESTS,
      "packages/studio/src/index.ts": "export const App = 1;\n",
      "packages/project-model/src/__tests__/helper.ts":
        'export { App } from "@hyperframes/studio";\n',
      "packages/project-model/src/a.ts": 'import { App } from "./__tests__/helper";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    const production = report.violations.filter((v) => v.scope === "production");
    assert.equal(
      production.length,
      1,
      "production reaching Studio via a test helper is a violation",
    );
    assert.equal(production[0].target, "@hyperframes/studio");
  });

  it("checks .cts and .mts production files", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/legacy.cts": 'const s = require("@hyperframes/studio");\n',
      "packages/project-model/src/modern.mts": 'import "@hyperframes/producer";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.deepEqual(report.violations.map((v) => v.target).sort(), [
      "@hyperframes/producer",
      "@hyperframes/studio",
    ]);
  });

  it("fails a direct browser-capture dependency", () => {
    // Forbidding only workspace packages leaves the boundary open to the exact
    // implementation coupling the rule exists to prevent.
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/a.ts": 'import puppeteer from "puppeteer";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "puppeteer");
  });

  it("does not fail on import-shaped text in a string constant", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/a.ts":
        "export const example = \"await import('@hyperframes/studio')\";\n",
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.deepEqual(report.violations, []);
    assert.deepEqual(report.unresolved, []);
  });

  it("names browser-capture packages in every protected rule", () => {
    for (const rule of BOUNDARY_RULES) {
      assert.ok(
        rule.forbidden.includes("puppeteer"),
        `${rule.package} does not forbid direct browser capture`,
      );
    }
  });
});

describe("package boundaries — compiler options come from the nearest tsconfig", () => {
  it("prefers a package's own tsconfig over the repository root", () => {
    // The reason this matters: a package-local `paths` entry can point at
    // forbidden code, and reading only root configs never sees it.
    const root = workspace({
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@ui/*": ["nowhere/*"] } } }),
      "packages/project-model/tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@editor": ["../studio/src/index.ts"] } },
      }),
      "packages/project-model/src/a.ts": "export const x = 1;\n",
    });
    const options = compilerOptionsFor("packages/project-model/src/a.ts", root);
    rmSync(root, { recursive: true, force: true });

    assert.ok(options.paths["@editor"], "the package's own alias is in effect");
    assert.equal(options.paths["@ui/*"], undefined, "the root alias does not leak in");
  });

  it("falls back to the repository root config when a package has none", () => {
    const root = workspace({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@ui/*": ["packages/studio/src/*"] } },
      }),
      "packages/project-model/src/a.ts": "export const x = 1;\n",
    });
    const options = compilerOptionsFor("packages/project-model/src/a.ts", root);
    rmSync(root, { recursive: true, force: true });

    assert.ok(options.paths["@ui/*"]);
  });

  it("tolerates comments in tsconfig, which JSON.parse does not", () => {
    const root = workspace({
      "tsconfig.json":
        '{\n  // the editor writes these\n  "compilerOptions": { "paths": { "@x": ["packages/studio/src/x"] } }\n}\n',
      "packages/project-model/src/a.ts": "export const x = 1;\n",
    });
    const options = compilerOptionsFor("packages/project-model/src/a.ts", root);
    rmSync(root, { recursive: true, force: true });

    assert.ok(options.paths["@x"]);
  });
});

describe("package boundaries — following a package to what it actually serves", () => {
  it("follows a subpath import to the module the exports map names", () => {
    // Walking to <dir>/src/index by convention would have followed this to the
    // package index, which imports nothing forbidden, and reported it clean.
    const root = workspace({
      ...MANIFESTS,
      "packages/utils/package.json": JSON.stringify({
        name: "@hyperframes/utils",
        exports: { ".": "./src/index.ts", "./capture": "./src/capture.ts" },
      }),
      "packages/utils/src/index.ts": "export const safe = 1;\n",
      "packages/utils/src/capture.ts": 'export { chromium } from "playwright";\n',
      "packages/project-model/src/a.ts": 'import { chromium } from "@hyperframes/utils/capture";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "playwright");
  });

  it("prefers the source condition over a built artifact", () => {
    // dist/ can be stale or absent; the repository's own source is the truth
    // the boundary is being asserted about.
    const root = workspace({
      ...MANIFESTS,
      "packages/utils/package.json": JSON.stringify({
        name: "@hyperframes/utils",
        exports: { ".": { node: "./dist/index.js", bun: "./src/index.ts" } },
      }),
      "packages/utils/src/index.ts": 'export { App } from "@hyperframes/studio";\n',
      "packages/utils/dist/index.js": "export const stale = 1;\n",
      "packages/studio/src/index.ts": "export const App = 1;\n",
      "packages/project-model/src/a.ts": 'import { App } from "@hyperframes/utils";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "@hyperframes/studio");
  });

  it("reports an unfollowable first-party entry instead of passing silently", () => {
    // Silence here would certify a chain that was never walked.
    const root = workspace({
      ...MANIFESTS,
      "packages/utils/package.json": JSON.stringify({
        name: "@hyperframes/utils",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/project-model/src/a.ts": 'import { x } from "@hyperframes/utils";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 0);
    assert.equal(report.unresolved.length, 1);
    assert.match(report.unresolved[0].detail, /serves no resolvable file/);
  });

  it("does not follow a subpath an exports map refuses to serve", () => {
    const root = workspace({
      ...MANIFESTS,
      "packages/utils/package.json": JSON.stringify({
        name: "@hyperframes/utils",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/utils/src/index.ts": "export const safe = 1;\n",
      "packages/utils/src/private.ts": 'export { App } from "@hyperframes/studio";\n',
      "packages/project-model/src/a.ts": 'import { x } from "@hyperframes/utils/private";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    // Not a violation, because that import cannot resolve at all — but it is
    // reported, because the checker did not verify anything about it.
    assert.equal(report.violations.length, 0);
    assert.equal(report.unresolved.length, 1);
  });
});

describe("package boundaries — ordinary TypeScript and Node resolution", () => {
  /**
   * Supplied by external review after the hand-rolled scanner was patched once.
   * Each is a normal arrangement in this repository, and each was certified
   * clean by a checker that read syntax with regular expressions and resolved
   * modules with its own rules. They are pinned here against the compiler's
   * parser and resolver, which is what now backs the check.
   */

  it("follows a .js specifier whose source file is .ts", () => {
    // TypeScript's documented output-extension import: the specifier names the
    // emitted file, the source is capture.ts. The old resolver tried
    // "capture.js.ts", found nothing, and stopped without reporting anything.
    const root = workspace({
      ...MANIFESTS,
      "packages/utils/package.json":
        '{"name":"@hyperframes/utils","type":"module","exports":"./src/index.ts"}',
      "packages/utils/src/index.ts": 'import "./capture.js";\n',
      "packages/utils/src/capture.ts": 'import "@hyperframes/studio";\n',
      "packages/studio/src/index.ts": "export const ui = 1;\n",
      "packages/project-model/src/index.ts": 'import "@hyperframes/utils";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "@hyperframes/studio");
  });

  it("reads a paths alias from the protected package's own tsconfig", () => {
    // Only two root config filenames were consulted, so a package-local alias
    // pointed straight at Studio and was never seen.
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@editor": ["../studio/src/index.ts"] } },
      }),
      "packages/studio/src/index.ts": "export const ui = 1;\n",
      "packages/project-model/src/index.ts": 'import "@editor";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "@hyperframes/studio");
  });

  it("finds an import inside a template interpolation", () => {
    // The old stripper blanked whole template literals to avoid matching text,
    // and blanked the executable code inside them along with it.
    const root = workspace({
      ...MANIFESTS,
      "packages/studio/src/index.ts": "export const ui = 1;\n",
      "packages/project-model/src/index.ts":
        'export const result = `${await import("@hyperframes/studio")}`;\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "@hyperframes/studio");
  });

  it("honours a root conditional exports object over main", () => {
    // `exports` takes precedence over `main` in Node resolution. Treating a
    // conditions object as not covering "." meant following the safe-looking
    // main file instead of the one the package actually serves.
    const root = workspace({
      ...MANIFESTS,
      "packages/utils/package.json": JSON.stringify({
        name: "@hyperframes/utils",
        type: "module",
        main: "./src/safe.mjs",
        exports: { import: "./src/unsafe.mjs" },
      }),
      "packages/utils/src/safe.mjs": "export const value = 1;\n",
      "packages/utils/src/unsafe.mjs": 'import "@hyperframes/studio";\n',
      "packages/studio/src/index.ts": "export const ui = 1;\n",
      "packages/project-model/src/index.ts": 'import "@hyperframes/utils";\n',
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].target, "@hyperframes/studio");
  });

  it("still ignores import-shaped text in an ordinary string", () => {
    // The control that must keep passing: rejecting the four cases above is
    // only useful if it does not come from matching everything.
    const root = workspace({
      ...MANIFESTS,
      "packages/project-model/src/index.ts":
        "export const example = \"await import('@hyperframes/studio')\";\n",
    });
    const report = checkTempWorkspace(root);
    rmSync(root, { recursive: true, force: true });

    assert.deepEqual(report.violations, []);
    assert.deepEqual(report.unresolved, []);
  });
});
