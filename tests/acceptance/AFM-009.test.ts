/**
 * AFM-009 — Reconcile workspace manifests and package ownership.
 *
 * Acceptance:
 *   - One root install resolves every production workspace dependency locally.
 *   - Duplicate package names, hidden npm fallbacks and accidental published
 *     upstream package substitution fail validation.
 *   - Native HyperFrames packages remain available; no package is removed
 *     merely because the diagram slice does not use it.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  checkWorkspace,
  findUnresolvedWorkspaceDependencies,
  readWorkspace,
  validateWorkspace,
  OWNED_NEW_PACKAGES,
  type WorkspacePackage,
} from "../../tools/build/workspace.ts";

const root = resolve(".");

describe("AFM-009: the workspace is internally consistent", () => {
  it("validates with no problems", () => {
    const report = checkWorkspace(root);
    expect(report.problems).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it("registers all 18 packages, including the four owned additions", () => {
    const report = checkWorkspace(root);
    expect(report.packageCount).toBe(18);
    const names = new Set(report.packages.map((p) => p.name));
    for (const owned of OWNED_NEW_PACKAGES) {
      expect(names.has(owned)).toBe(true);
    }
  });

  it("keeps every inherited HyperFrames package available", () => {
    // No package is dropped merely because the diagram slice does not use it.
    const names = new Set(checkWorkspace(root).packages.map((p) => p.name));
    for (const pkg of [
      "aws-lambda",
      "cli",
      "core",
      "engine",
      "gcp-cloud-run",
      "lint",
      "parsers",
      "player",
      "producer",
      "sdk",
      "sdk-playground",
      "shader-transitions",
      "studio",
      "studio-server",
    ]) {
      expect(names.has(`@hyperframes/${pkg}`)).toBe(true);
    }
  });

  it("keeps packages introduced here private", () => {
    const report = checkWorkspace(root);
    for (const pkg of report.packages) {
      if (OWNED_NEW_PACKAGES.has(pkg.name)) expect(pkg.private).toBe(true);
    }
  });

  it("has no nested package-manager root", () => {
    // A stray package-lock.json inside a bun workspace member is a second
    // root: npm run there installs a different tree beside bun's. The one
    // inherited from Archify was relocated to docs/upstream/.
    for (const pkg of readWorkspace(root)) {
      for (const lockfile of ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]) {
        expect(existsSync(resolve(root, pkg.dir, lockfile))).toBe(false);
      }
    }
    expect(existsSync(resolve(root, "docs/upstream/archify/package-lock.json"))).toBe(true);
  });

  it("resolves every workspace dependency locally", () => {
    expect(findUnresolvedWorkspaceDependencies(root, readWorkspace(root))).toEqual([]);
  });

  it("translates Archify's dependencies and its fast-uri override", () => {
    const engine = JSON.parse(readFileSync("packages/diagram-engine/package.json", "utf8"));
    // The renderers import these at runtime, so they are dependencies here even
    // though Archify declared them as devDependencies.
    for (const dep of ["ajv", "parse5", "saxes", "simple-icons"]) {
      expect(engine.dependencies[dep]).toBeTruthy();
    }
    expect(engine.overrides["fast-uri"]).toBe("3.1.5");
  });

  it("keeps the React constraints from the workspace root", () => {
    const rootManifest = JSON.parse(readFileSync("package.json", "utf8"));
    expect(rootManifest.resolutions.react).toBe("^19.0.0");
    expect(rootManifest.overrides["react-dom"]).toBe("^19.0.0");
  });
});

describe("AFM-009: validation catches the failures it is supposed to", () => {
  const pkg = (dir: string, manifest: Record<string, unknown>): WorkspacePackage => ({
    dir,
    manifest,
  });

  it("fails a duplicate package name", () => {
    const found = validateWorkspace(root, [
      pkg("packages/a", { name: "@hyperframes/core", private: true }),
      pkg("packages/b", { name: "@hyperframes/core", private: true }),
    ]);
    expect(found.some((p) => p.code === "duplicate-package-name")).toBe(true);
  });

  it("fails a missing package name", () => {
    const found = validateWorkspace(root, [pkg("packages/broken", {})]);
    expect(found.some((p) => p.code === "missing-package-name")).toBe(true);
  });

  it("fails an internal dependency pinned to a registry range", () => {
    // This is the accidental published-upstream substitution: a registry range
    // for an internal name resolves to whatever upstream published.
    const found = validateWorkspace(root, [
      pkg("packages/core", { name: "@hyperframes/core", private: true }),
      pkg("packages/x", {
        name: "@hyperframes/x",
        private: true,
        dependencies: { "@hyperframes/core": "^0.8.0" },
      }),
    ]);
    const problem = found.find((p) => p.code === "registry-substitution");
    expect(problem).toBeDefined();
    expect(problem!.detail).toContain("workspace:*");
  });

  it("accepts an internal dependency declared as workspace:*", () => {
    const found = validateWorkspace(root, [
      pkg("packages/core", { name: "@hyperframes/core", private: true }),
      pkg("packages/x", {
        name: "@hyperframes/x",
        private: true,
        dependencies: { "@hyperframes/core": "workspace:*" },
      }),
    ]);
    expect(found.filter((p) => p.code === "registry-substitution")).toEqual([]);
  });

  it("fails an owned package that is not private", () => {
    const found = validateWorkspace(root, [
      pkg("packages/project-model", { name: "@hyperframes/project-model" }),
    ]);
    expect(found.some((p) => p.code === "new-package-not-private")).toBe(true);
  });
});
