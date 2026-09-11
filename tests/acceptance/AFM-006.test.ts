/**
 * AFM-006 — Keep source movement safe across Windows, macOS and Linux.
 *
 * Acceptance:
 *   - Imported code never resolves runtime assets from a parent raw checkout.
 *   - Cross-platform failures name the offending path and safe remediation.
 *   - No recursive copy follows arbitrary symlink targets or overwrites input
 *     folders.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  checkPaths,
  checkRepository,
  findEscapingSymlinks,
  findRawCheckoutReferences,
  MAX_WINDOWS_PATH,
  RESERVED_WINDOWS_NAMES,
} from "../../tools/import/path-policy.ts";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "afm006-"));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const targets = (): string[] =>
  JSON.parse(readFileSync("provenance/import-map.json", "utf8")).entries.map(
    (e: { targetPath: string }) => e.targetPath,
  );

describe("AFM-006: the real imported tree is cross-platform safe", () => {
  it("has no path problem across all 7786 targets", () => {
    const report = checkRepository(".", targets());
    expect(report.problems).toEqual([]);
    expect(report.safe).toBe(true);
  }, 180_000);

  it("resolves no runtime asset from a raw checkout", () => {
    // The repository must build with _sources/ absent; a runtime reference to
    // it would make that false while still passing a normal test run.
    expect(findRawCheckoutReferences(resolve("."))).toEqual([]);
  }, 180_000);

  it("has no symlink escaping the repository", () => {
    expect(findEscapingSymlinks(resolve("."))).toEqual([]);
  }, 180_000);

  it("supports the producer symlink fixture rather than skipping it", () => {
    const report = checkRepository(".", []);
    expect(report.symlinkFixture.skipped).toBe(false);
    expect(report.symlinkFixture.path).toBe(
      "packages/producer/tests/render-symlinked-assets/src/shared",
    );
  });

  it("normalises line endings through .gitattributes, not by rewriting bytes", () => {
    // Rewriting during import would break the raw baseline hashes AFM-001
    // verifies, so the policy lives in .gitattributes instead.
    expect(readFileSync(".gitattributes", "utf8")).toContain("text=auto eol=lf");
  });
});

describe("AFM-006: unsafe paths are detected with remediation", () => {
  it("detects a case collision", () => {
    const found = checkPaths(["docs/README.md", "docs/readme.md"]);
    expect(found).toHaveLength(1);
    expect(found[0]!.code).toBe("case-collision");
    expect(found[0]!.remediation).toBeTruthy();
  });

  it("detects every reserved Windows device name, with or without extension", () => {
    for (const name of RESERVED_WINDOWS_NAMES) {
      const bare = checkPaths([`packages/x/${name}`]);
      const dotted = checkPaths([`packages/x/${name}.txt`]);
      expect(bare.some((p) => p.code === "reserved-windows-name")).toBe(true);
      expect(dotted.some((p) => p.code === "reserved-windows-name")).toBe(true);
    }
  });

  it("detects a trailing dot or space", () => {
    // Windows silently strips these, which changes the filename after checkout.
    for (const path of ["packages/x/name.", "packages/x/name "]) {
      expect(checkPaths([path]).some((p) => p.code === "trailing-dot-or-space")).toBe(true);
    }
  });

  it("detects characters Windows rejects", () => {
    for (const path of ["packages/x/a:b", "packages/x/a?b", 'packages/x/a"b', "packages/x/a|b"]) {
      expect(checkPaths([path]).some((p) => p.code === "invalid-windows-character")).toBe(true);
    }
  });

  it("detects a path over the Windows limit", () => {
    const long = `packages/${"d".repeat(120)}/${"f".repeat(120)}.ts`;
    expect(checkPaths([long], MAX_WINDOWS_PATH - 40).some((p) => p.code === "path-too-long")).toBe(
      true,
    );
  });

  it("detects an over-long single component", () => {
    expect(
      checkPaths([`packages/x/${"n".repeat(300)}.ts`]).some((p) => p.code === "component-too-long"),
    ).toBe(true);
  });

  it("names the offending path in every problem", () => {
    const found = checkPaths(["packages/x/CON", "docs/A.md", "docs/a.md", "packages/x/bad."]);
    expect(found.length).toBeGreaterThan(0);
    for (const problem of found) {
      expect(problem.path).toBeTruthy();
      expect(problem.detail).toBeTruthy();
      expect(problem.remediation).toBeTruthy();
    }
  });

  it("accepts ordinary paths", () => {
    expect(
      checkPaths([
        "packages/diagram-engine/renderers/architecture/render-architecture.mjs",
        "docs/upstream/hyperframes/CONTRIBUTING.md",
        "packages/producer/tests/render-symlinked-assets/src/shared",
      ]),
    ).toEqual([]);
  });
});

describe("AFM-006: symlinks are never followed out of the tree", () => {
  it("flags a symlink pointing outside the repository", () => {
    const root = join(tmp, "escape");
    mkdirSync(join(root, "packages"), { recursive: true });
    writeFileSync(join(tmp, "outside.txt"), "secret");
    symlinkSync("../../outside.txt", join(root, "packages", "leak"));

    const found = findEscapingSymlinks(root);
    expect(found).toHaveLength(1);
    expect(found[0]!.code).toBe("escaping-symlink");
    expect(found[0]!.path).toBe("packages/leak");
  });

  it("flags an absolute symlink target", () => {
    const root = join(tmp, "absolute");
    mkdirSync(root, { recursive: true });
    symlinkSync("/etc/passwd", join(root, "abs"));
    expect(findEscapingSymlinks(root).some((p) => p.code === "escaping-symlink")).toBe(true);
  });

  it("accepts a repository-relative symlink", () => {
    const root = join(tmp, "relative");
    mkdirSync(join(root, "a/b"), { recursive: true });
    writeFileSync(join(root, "a/target.txt"), "fine");
    symlinkSync("../target.txt", join(root, "a/b/link"));
    expect(findEscapingSymlinks(root)).toEqual([]);
  });

  it("does not descend through a symlinked directory", () => {
    // Following a link during a recursive walk is how an import escapes its
    // own root, so the walk must stop at the link itself.
    const root = join(tmp, "nodescend");
    mkdirSync(join(root, "real"), { recursive: true });
    writeFileSync(join(tmp, "outside-file.txt"), "x");
    mkdirSync(join(tmp, "outside-dir"), { recursive: true });
    writeFileSync(join(tmp, "outside-dir", "CON"), "would be flagged if followed");
    symlinkSync(join(tmp, "outside-dir"), join(root, "real", "linked-dir"));

    const found = findEscapingSymlinks(root);
    // The link itself is reported; its contents are not walked.
    expect(found.map((p) => p.path)).toEqual(["real/linked-dir"]);
  });
});

describe("AFM-006: raw-checkout reach-back is detected", () => {
  function fixture(name: string, files: Record<string, string>): string {
    const root = join(tmp, name);
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, content);
    }
    return root;
  }

  it("flags code reading from a sibling raw checkout", () => {
    const root = fixture("sibling", {
      "packages/diagram-engine/load.mjs":
        'import t from "../../../archify-main/archify/assets/template.html";',
    });
    const found = findRawCheckoutReferences(root);
    expect(found).toHaveLength(1);
    expect(found[0]!.code).toBe("raw-checkout-reference");
    expect(found[0]!.remediation).toContain("packages/");
  });

  it("flags code reading from the quarantined snapshot", () => {
    const root = fixture("quarantine", {
      "packages/core/x.ts": 'const p = "_sources/hyperframes-main/packages/core/src/index.ts";',
    });
    expect(findRawCheckoutReferences(root)).toHaveLength(1);
  });

  it("permits the import tooling itself to name the snapshots", () => {
    // Reading them is the entire purpose of tools/import.
    const root = fixture("tooling", {
      "tools/import/preflight.ts": 'const p = "_sources/archify-main/archify/package.json";',
    });
    expect(findRawCheckoutReferences(root)).toEqual([]);
  });

  it("does not flag prose that merely mentions the snapshots", () => {
    const root = fixture("prose", {
      "docs/notes.md": "We imported from _sources/archify-main/ during AFM-003.",
    });
    expect(findRawCheckoutReferences(root)).toEqual([]);
  });
});
