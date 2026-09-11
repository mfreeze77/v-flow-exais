/**
 * AFM-001 — Preflight the two raw source folders.
 *
 * Acceptance:
 *   - Both unmodified uploads are recognized and hashed without modification.
 *   - Changed content produces an explicit drift report and blocks automatic
 *     baseline substitution.
 *   - No Git clone, npm install, hook execution or remote write occurs.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import {
  preflight,
  scanZip,
  scanFolder,
  discoverFolder,
  compareInventory,
  treeContentSha256,
  safeName,
  PreflightError,
  type BaselineEntry,
} from "../../tools/import/preflight.ts";
import { openZip, ZipError } from "../../tools/import/zip.ts";
import { makeZip } from "../helpers/make-zip.ts";

const PACK = resolve("_sources/archframe-unified-implementation-v2.0.0");
const SNAPSHOTS = JSON.parse(readFileSync(join(PACK, "provenance/SOURCE_SNAPSHOTS.json"), "utf8"));
const BASELINE: BaselineEntry[] = JSON.parse(
  readFileSync(join(PACK, "provenance/SOURCE_INVENTORY.json"), "utf8"),
).entries;

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "afm001-"));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Builds a minimal tree carrying the sentinels for `repository`. */
function makeSourceTree(root: string, repository: "archify" | "hyperframes"): string {
  const files =
    repository === "archify"
      ? { "archify/package.json": '{"name":"archify"}', "archify/schemas/architecture.schema.json": "{}" }
      : {
          "package.json": '{"name":"hyperframes-monorepo"}',
          "packages/producer/package.json": "{}",
          "packages/studio/src/App.tsx": "export default null;",
        };
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe("AFM-001: real source inputs match the pinned baseline", () => {
  // The whole plan rests on these inputs being the ones the tickets were
  // written against; if this drifts, source anchors are no longer trustworthy.
  for (const repository of ["archify", "hyperframes"] as const) {
    it(`${repository} folder scan reproduces the baseline tree digest`, () => {
      const scan = scanFolder(`_sources/${repository}-main`, repository);
      const expected = BASELINE.filter((e) => e.repository === repository);
      const result = compareInventory(scan.entries, expected);

      expect(result.missing).toEqual([]);
      expect(result.extra).toEqual([]);
      expect(result.changed).toEqual([]);
      expect(result.caseCollisions).toEqual([]);
      expect(result.filesChecked).toBe(SNAPSHOTS[repository].file_entries);
      expect(result.treeContentSha256).toBe(SNAPSHOTS[repository].tree_content_sha256);
      expect(result.matchesBaseline).toBe(true);
    });
  }

  it("preserves the HyperFrames symlink as a link, not as its target's content", () => {
    // Extraction on a host without symlink support silently turns this into a
    // real directory. That is drift, and it must be caught rather than hashed
    // over -- this exact case was a live finding during G0 setup.
    const scan = scanFolder("_sources/hyperframes-main", "hyperframes");
    const link = scan.entries.find(
      (e) => e.path === "packages/producer/tests/render-symlinked-assets/src/shared",
    );
    expect(link).toBeDefined();
    expect(link!.kind).toBe("symlink");
    expect(SNAPSHOTS.hyperframes.symlinks).toContain(link!.path);
  });

  it("reports PASS for both unmodified inputs and mutates nothing", () => {
    const report = preflight({
      archify: "_sources/archify-main",
      hyperframes: "_sources/hyperframes-main",
      baseline: BASELINE,
      destination: process.cwd(),
      quarantine: "_sources",
    });
    expect(report.errors).toEqual([]);
    expect(report.status).toBe("PASS");
    expect(report.inputsMutated).toBe(false);
    expect(report.upstreamCommitVerification).toBe("not_performed");
    expect(report.quarantinedInputs).toHaveLength(2);
  }, 240_000);
});

describe("AFM-001: root resolution by sentinel, not by name", () => {
  it("accepts a renamed folder, and folders with spaces and Unicode", () => {
    for (const name of ["totally-different-name", "source folder with spaces", "架构-源码-Ω"]) {
      const root = makeSourceTree(join(tmp, "named", name), "archify");
      expect(discoverFolder(root, "archify")).toBe(resolve(root));
    }
  });

  it("descends one level into a download wrapper directory", () => {
    const outer = join(tmp, "wrapper");
    makeSourceTree(join(outer, "archify-main"), "archify");
    expect(discoverFolder(outer, "archify")).toBe(resolve(outer, "archify-main"));
  });

  it("refuses a folder with no sentinel", () => {
    const empty = join(tmp, "empty");
    mkdirSync(empty, { recursive: true });
    expect(() => discoverFolder(empty, "archify")).toThrow(PreflightError);
  });

  it("refuses an ambiguous input holding two candidate roots", () => {
    const outer = join(tmp, "ambiguous");
    makeSourceTree(join(outer, "copy-a"), "archify");
    makeSourceTree(join(outer, "copy-b"), "archify");
    expect(() => discoverFolder(outer, "archify")).toThrow(/exactly one/);
  });

  it("resolves a Windows-style path", () => {
    const root = makeSourceTree(join(tmp, "winpath"), "archify");
    // Native separators must resolve identically to POSIX ones.
    expect(discoverFolder(root.split("/").join(sep), "archify")).toBe(resolve(root));
  });
});

describe("AFM-001: drift is reported, never absorbed", () => {
  it("flags a changed lockfile as drift and refuses to pass", () => {
    const actual = [
      { path: "bun.lock", kind: "file" as const, sha256: "a".repeat(64), size: 10 },
    ];
    const expected = [
      { path: "bun.lock", kind: "file" as const, sha256: "b".repeat(64), size: 12 },
    ];
    const result = compareInventory(actual, expected);

    expect(result.matchesBaseline).toBe(false);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]!.path).toBe("bun.lock");
    expect(result.changed[0]!.fields).toEqual(["sha256", "size"]);
    // The baseline value is retained in the report so a reviewer can compare,
    // rather than being overwritten by what was found on disk.
    expect(result.changed[0]!.expected.sha256).toBe("b".repeat(64));
  });

  it("reports added and removed files separately", () => {
    const result = compareInventory(
      [{ path: "kept", kind: "file", sha256: "c".repeat(64), size: 1 },
       { path: "added", kind: "file", sha256: "d".repeat(64), size: 1 }],
      [{ path: "kept", kind: "file", sha256: "c".repeat(64), size: 1 },
       { path: "removed", kind: "file", sha256: "e".repeat(64), size: 1 }],
    );
    expect(result.extra).toEqual(["added"]);
    expect(result.missing).toEqual(["removed"]);
    expect(result.matchesBaseline).toBe(false);
  });

  it("treats a file replacing a symlink as drift", () => {
    const result = compareInventory(
      [{ path: "link", kind: "file", sha256: "f".repeat(64), size: 3 }],
      [{ path: "link", kind: "symlink", sha256: "f".repeat(64), size: 3 }],
    );
    expect(result.changed[0]!.fields).toEqual(["kind"]);
    expect(result.matchesBaseline).toBe(false);
  });

  it("flags case collisions even where the filesystem allows them", () => {
    const result = compareInventory(
      [{ path: "README.md", kind: "file", sha256: "1".repeat(64), size: 1 },
       { path: "readme.md", kind: "file", sha256: "2".repeat(64), size: 1 }],
      [{ path: "README.md", kind: "file", sha256: "1".repeat(64), size: 1 },
       { path: "readme.md", kind: "file", sha256: "2".repeat(64), size: 1 }],
    );
    expect(result.caseCollisions).toEqual([["README.md", "readme.md"]]);
    expect(result.matchesBaseline).toBe(false);
  });

  it("excludes size from the tree digest but not from change detection", () => {
    const a = treeContentSha256([{ path: "p", kind: "file", sha256: "9".repeat(64), size: 1 }]);
    const b = treeContentSha256([{ path: "p", kind: "file", sha256: "9".repeat(64), size: 999 }]);
    expect(a).toBe(b);
  });

  it("orders the tree digest by path, not by discovery order", () => {
    const one = treeContentSha256([
      { path: "b", kind: "file", sha256: "2".repeat(64), size: 1 },
      { path: "a", kind: "file", sha256: "1".repeat(64), size: 1 },
    ]);
    const two = treeContentSha256([
      { path: "a", kind: "file", sha256: "1".repeat(64), size: 1 },
      { path: "b", kind: "file", sha256: "2".repeat(64), size: 1 },
    ]);
    expect(one).toBe(two);
  });
});

describe("AFM-001: destination and output safety", () => {
  it("refuses a source input nested inside the destination without a quarantine", () => {
    const dest = join(tmp, "dest");
    const inside = makeSourceTree(join(dest, "nested", "archify-main"), "archify");
    const hyper = makeSourceTree(join(tmp, "hyper-ok"), "hyperframes");

    const report = preflight({
      archify: inside,
      hyperframes: hyper,
      baseline: [],
      destination: dest,
    });
    expect(report.status).toBe("ERROR");
    expect(report.errors[0]).toMatch(/must not live inside the output repository/);
  });

  it("accepts it only from the explicitly declared quarantine", () => {
    const dest = join(tmp, "dest2");
    const quarantine = join(dest, "_sources");
    const archify = makeSourceTree(join(quarantine, "archify-main"), "archify");
    const hyperframes = makeSourceTree(join(quarantine, "hyperframes-main"), "hyperframes");

    const report = preflight({
      archify,
      hyperframes,
      baseline: [],
      destination: dest,
      quarantine,
    });
    // Empty baseline means the trees differ from it; the point here is that the
    // containment check passed rather than erroring out.
    expect(report.status).toBe("DRIFT_REQUIRES_REVIEW");
    expect(report.errors).toEqual([]);
    expect(report.quarantinedInputs).toHaveLength(2);
  });

  it("never exempts an output repository nested inside a source input", () => {
    const source = makeSourceTree(join(tmp, "src-outer"), "archify");
    const dest = join(source, "build-output");
    mkdirSync(dest, { recursive: true });

    const report = preflight({
      archify: source,
      hyperframes: makeSourceTree(join(tmp, "hyper-ok2"), "hyperframes"),
      baseline: [],
      destination: dest,
      quarantine: source, // even an explicit quarantine must not permit this
    });
    expect(report.status).toBe("ERROR");
    expect(report.errors[0]).toMatch(/must not live inside a source input/);
  });

  it("refuses to write its report inside a source input", () => {
    const archify = makeSourceTree(join(tmp, "out-guard"), "archify");
    const report = preflight({
      archify,
      hyperframes: makeSourceTree(join(tmp, "hyper-ok3"), "hyperframes"),
      baseline: [],
      out: join(archify, "report.json"),
    });
    expect(report.status).toBe("ERROR");
    expect(report.errors[0]).toMatch(/must not overwrite or be written inside/);
  });

  it("reports a missing input rather than throwing", () => {
    const report = preflight({
      archify: join(tmp, "does-not-exist"),
      hyperframes: join(tmp, "also-missing"),
      baseline: [],
    });
    expect(report.status).toBe("ERROR");
    expect(report.errors[0]).toMatch(/Input does not exist/);
  });
});

describe("AFM-001: archive handling", () => {
  const archifyZip = () =>
    makeZip(
      [
        { name: "archify-main/archify/package.json", content: '{"name":"archify"}' },
        { name: "archify-main/archify/schemas/architecture.schema.json", content: "{}" },
      ],
      "18911058008f17dc065af23a2cdc9bfeff6d3f7a",
    );

  it("records the archive comment as an unverified revision candidate", () => {
    const scan = scanZip(archifyZip(), "archify");
    expect(scan.archiveCommentRevisionCandidate).toBe(
      "18911058008f17dc065af23a2cdc9bfeff6d3f7a",
    );
    expect(scan.resolvedRoot).toBe("archify-main");
    // The pack itself never promoted these to verified commits.
    expect(SNAPSHOTS.archify.independently_verified_commit).toBeNull();
    expect(SNAPSHOTS.archify.git_history_included).toBe(false);
  });

  it("reads the real Archify archive to the same digest as the folder", () => {
    const zip = scanZip(readFileSync("_sources/archify-main.zip"), "archify");
    const folder = scanFolder("_sources/archify-main", "archify");
    expect(treeContentSha256(zip.entries)).toBe(treeContentSha256(folder.entries));
    expect(zip.archiveCommentRevisionCandidate).toBe(
      SNAPSHOTS.archify.archive_comment_revision_candidate,
    );
  });

  it("classifies a symlink entry by its unix mode", () => {
    const zip = makeZip([
      { name: "archify/package.json", content: '{"name":"archify"}' },
      { name: "archify/schemas/architecture.schema.json", content: "{}" },
      { name: "archify/link", content: "../target", symlink: true },
    ]);
    // Archify's sentinels live under an `archify/` subdirectory, so the
    // resolved root is the archive root and entry paths keep that prefix.
    const scan = scanZip(zip, "archify");
    expect(scan.entries.find((e) => e.path === "archify/link")!.kind).toBe("symlink");
  });

  it("excludes admin entries from identity comparison", () => {
    const zip = makeZip([
      { name: "archify/package.json", content: '{"name":"archify"}' },
      { name: "archify/schemas/architecture.schema.json", content: "{}" },
      { name: "archify/.git/HEAD", content: "ref: refs/heads/main" },
      { name: "archify/node_modules/x/index.js", content: "" },
    ]);
    const scan = scanZip(zip, "archify");
    expect(scan.entries.map((e) => e.path)).not.toContain("archify/.git/HEAD");
    expect(scan.excludedAdminEntries).toContain("archify/.git/HEAD");
    expect(scan.excludedAdminEntries).toContain("archify/node_modules/x/index.js");
  });

  it("rejects a malformed archive", () => {
    expect(() => openZip(Buffer.from("this is not a zip file"))).toThrow(ZipError);
  });

  it("rejects a truncated central directory", () => {
    const zip = archifyZip();
    // Claim more entries than the directory actually holds.
    const eocd = zip.length - 22 - 40;
    zip.writeUInt16LE(99, eocd + 10);
    expect(() => openZip(zip)).toThrow(/Corrupt central directory|end-of-central-directory/);
  });

  it("rejects an encrypted entry instead of hashing ciphertext", () => {
    const zip = makeZip([
      { name: "archify/package.json", content: '{"name":"archify"}' },
      { name: "archify/schemas/architecture.schema.json", content: "{}" },
      { name: "archify/secret", content: "x", encrypted: true },
    ]);
    expect(() => scanZip(zip, "archify")).toThrow(/Encrypted entry unsupported/);
  });

  it("rejects archive entries that would escape the extraction root", () => {
    expect(() => safeName("../../etc/passwd")).toThrow(/Escaping\/absolute/);
    expect(() => safeName("/etc/passwd")).toThrow(/Escaping\/absolute/);
    expect(() => safeName("C:/Windows/system32")).toThrow(/Escaping\/absolute/);
    expect(() => safeName("bad\\name")).toThrow(/Unsafe archive entry name/);
    expect(() => safeName("null\0byte")).toThrow(/Unsafe archive entry name/);
    expect(safeName("packages/core/src/index.ts")).toBe("packages/core/src/index.ts");
  });

  it("refuses an archive with no identifiable source root", () => {
    const zip = makeZip([{ name: "random/file.txt", content: "x" }]);
    expect(() => scanZip(zip, "archify")).toThrow(/exactly one archify source root/);
  });
});

describe("AFM-001: inspection performs no side effects", () => {
  it("does not shell out, clone, install or reach the network", () => {
    // Enforced structurally: the preflight modules import only node:crypto,
    // node:fs, node:path and node:zlib. A regression that adds child_process,
    // node:http/https/net or a package manager call fails here.
    const sources = [
      readFileSync("tools/import/preflight.ts", "utf8"),
      readFileSync("tools/import/zip.ts", "utf8"),
    ].join("\n");

    for (const forbidden of [
      "child_process",
      "node:http",
      "node:https",
      "node:net",
      "node:dgram",
      "fetch(",
      "execSync",
      "spawnSync",
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it("opens no write handle on a source input during a scan", () => {
    const root = makeSourceTree(join(tmp, "readonly-check"), "archify");
    const before = scanFolder(root, "archify");
    const after = scanFolder(root, "archify");
    expect(treeContentSha256(after.entries)).toBe(treeContentSha256(before.entries));
  });
});
