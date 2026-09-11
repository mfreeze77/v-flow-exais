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

  it("ignores specifiers inside template literals", () => {
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
    const target = resolveImportTarget(
      "../../studio/src/App",
      "packages/project-model/src/a.ts",
      "/repo",
      packagesByDir,
    );
    assert.equal(target.package, "@hyperframes/studio");
  });
});
