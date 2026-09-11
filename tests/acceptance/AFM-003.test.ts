/**
 * AFM-003 — Initialize and populate the new owned monorepo.
 *
 * Acceptance:
 *   - The repo builds without sibling raw folders, submodules or globally
 *     installed upstream CLIs (once workspace reconciliation is complete).
 *   - Inputs retain their original inventory hashes.
 *   - The import is resumable and never fabricates upstream Git ancestry or
 *     pushes a remote.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  lstatSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  applyImport,
  findNestedRepositories,
  ledgerDigest,
  loadReceipt,
  type ImportReceipt,
} from "../../tools/import/apply.ts";
import type { ImportMap, ImportMapEntry } from "../../tools/import/plan.ts";
import { makeZip } from "../helpers/make-zip.ts";

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "afm003-"));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** sha256 helper matching the ledger's hashing. */
async function sha(content: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
}

interface Fixture {
  map: ImportMap;
  archives: { archify: Buffer; hyperframes: Buffer };
}

/** Builds a small but structurally complete import fixture. */
async function makeFixture(): Promise<Fixture> {
  const files = {
    "archify/package.json": '{"name":"archify"}',
    "archify/schemas/architecture.schema.json": "{}",
    "archify/renderers/architecture/render-architecture.mjs": "export const render = () => {};",
    "archify/bin/archify.mjs": "#!/usr/bin/env node\n",
  };
  const archify = makeZip([...Object.entries(files).map(([name, content]) => ({ name, content }))]);
  const hyperframes = makeZip([
    { name: "package.json", content: '{"name":"hyperframes-monorepo"}' },
    { name: "packages/producer/package.json", content: "{}" },
    { name: "packages/studio/src/App.tsx", content: "export default null;" },
    { name: "packages/producer/tests/link", content: "../shared", symlink: true },
  ]);

  const entry = async (
    repository: "archify" | "hyperframes",
    sourcePath: string,
    targetPath: string,
    content: string,
    extra: Partial<ImportMapEntry> = {},
  ): Promise<ImportMapEntry> => ({
    repository,
    sourcePath,
    targetPath,
    kind: "file",
    size: Buffer.byteLength(content),
    sha256: await sha(content),
    mode: "0o644",
    executable: false,
    disposition: "retain-relocate-refactor-as-owned",
    implementationOwners: ["AFM-003"],
    nonAuthoritative: false,
    ...extra,
  });

  const entries: ImportMapEntry[] = [
    await entry(
      "archify",
      "archify/package.json",
      "packages/diagram-engine/package.json",
      files["archify/package.json"],
    ),
    await entry(
      "archify",
      "archify/schemas/architecture.schema.json",
      "packages/diagram-engine/schemas/architecture.schema.json",
      files["archify/schemas/architecture.schema.json"],
    ),
    await entry(
      "archify",
      "archify/renderers/architecture/render-architecture.mjs",
      "packages/diagram-engine/renderers/architecture/render-architecture.mjs",
      files["archify/renderers/architecture/render-architecture.mjs"],
    ),
    await entry(
      "archify",
      "archify/bin/archify.mjs",
      "packages/diagram-engine/bin/archify.mjs",
      files["archify/bin/archify.mjs"],
      { mode: "0o755", executable: true },
    ),
    await entry("hyperframes", "package.json", "package.json", '{"name":"hyperframes-monorepo"}'),
    await entry(
      "hyperframes",
      "packages/producer/package.json",
      "packages/producer/package.json",
      "{}",
    ),
    await entry(
      "hyperframes",
      "packages/studio/src/App.tsx",
      "packages/studio/src/App.tsx",
      "export default null;",
    ),
    await entry(
      "hyperframes",
      "packages/producer/tests/link",
      "packages/producer/tests/link",
      "../shared",
      {
        kind: "symlink",
        mode: "0o777",
        executable: true,
        disposition: "review-symlink-do-not-follow",
      },
    ),
  ];

  return {
    map: {
      generatedBy: "test",
      scope: "fixture",
      sourceBaseline: {},
      counts: {
        total: entries.length,
        byRepository: {},
        byDisposition: {},
        executable: 2,
        symlinks: 1,
        nonAuthoritative: 0,
      },
      entries,
    },
    archives: { archify, hyperframes },
  };
}

let fixture: Fixture;
beforeAll(async () => {
  fixture = await makeFixture();
});

describe("AFM-003: a clean import writes and verifies every entry", () => {
  it("writes all planned entries into an empty destination", () => {
    const dest = join(tmp, "clean");
    mkdirSync(dest, { recursive: true });
    const receipt = applyImport({ ...fixture, destination: dest });

    expect(receipt.conflicts).toEqual([]);
    expect(receipt.counts.written).toBe(fixture.map.entries.length);
    expect(receipt.completedAt).not.toBeNull();
    for (const entry of fixture.map.entries) {
      // lstat, not existsSync: the fixture's symlink deliberately dangles, and
      // existsSync follows links, so a correctly created link reads as absent.
      expect(lstatSync(join(dest, entry.targetPath), { throwIfNoEntry: false })).toBeDefined();
    }
  });

  it("recreates a symlink instead of materializing its target", () => {
    const dest = join(tmp, "symlink");
    mkdirSync(dest, { recursive: true });
    applyImport({ ...fixture, destination: dest });

    const link = join(dest, "packages/producer/tests/link");
    const stats = lstatSync(link, { throwIfNoEntry: false });
    expect(stats?.isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe("../shared");
  });

  it("applies the executable bit from the ledger", () => {
    const dest = join(tmp, "exec");
    mkdirSync(dest, { recursive: true });
    applyImport({ ...fixture, destination: dest });

    const mode = statSync(join(dest, "packages/diagram-engine/bin/archify.mjs")).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  it("leaves no staging directory behind", () => {
    const dest = join(tmp, "staging");
    mkdirSync(dest, { recursive: true });
    applyImport({ ...fixture, destination: dest });
    expect(existsSync(join(dest, ".import-staging"))).toBe(false);
  });

  it("writes a receipt that records no Git activity", () => {
    const dest = join(tmp, "gitless");
    mkdirSync(dest, { recursive: true });
    const receipt = applyImport({ ...fixture, destination: dest });

    expect(receipt.gitHistory).toBe("not_initialized_by_import");
    expect(receipt.upstreamAncestry).toBe("not_fabricated");
    expect(receipt.remote).toBe("none_configured");
    // The import must not create a repository of its own.
    expect(existsSync(join(dest, ".git"))).toBe(false);
  });
});

describe("AFM-003: the import is resumable", () => {
  it("skips entries a matching receipt already recorded", () => {
    const dest = join(tmp, "resume");
    mkdirSync(dest, { recursive: true });
    const receiptPath = join(dest, "receipt.json");

    // Simulate an interrupted run: three entries done, the rest outstanding.
    const partial: ImportReceipt = {
      generatedBy: "test",
      ledgerDigest: ledgerDigest(fixture.map),
      destination: resolve(dest),
      startedAt: "2026-09-10T00:00:00.000Z",
      completedAt: null,
      counts: { planned: 8, written: 3, skippedIdentical: 0, superseded: 0, conflicts: 0 },
      written: fixture.map.entries.slice(0, 3).map((e) => e.targetPath),
      skippedIdentical: [],
      superseded: [],
      conflicts: [],
      gitHistory: "not_initialized_by_import",
      upstreamAncestry: "not_fabricated",
      remote: "none_configured",
    };
    mkdirSync(join(dest, "."), { recursive: true });
    writeFileSync(receiptPath, JSON.stringify(partial));

    const resumed = applyImport({ ...fixture, destination: dest, receiptPath });

    // Prior work is retained and the remainder is completed.
    expect(resumed.counts.written).toBe(fixture.map.entries.length);
    expect(resumed.conflicts).toEqual([]);
    expect(resumed.startedAt).toBe(partial.startedAt);
    // The three "already written" entries were skipped, so they do not exist.
    expect(existsSync(join(dest, fixture.map.entries[0]!.targetPath))).toBe(false);
    expect(existsSync(join(dest, fixture.map.entries[4]!.targetPath))).toBe(true);
  });

  it("refuses to resume against a receipt from a different ledger", () => {
    const dest = join(tmp, "resume-mismatch");
    mkdirSync(dest, { recursive: true });
    const receiptPath = join(dest, "receipt.json");

    writeFileSync(
      receiptPath,
      JSON.stringify({
        generatedBy: "test",
        ledgerDigest: "a-different-ledger",
        written: fixture.map.entries.map((e) => e.targetPath),
      }),
    );

    const receipt = applyImport({ ...fixture, destination: dest, receiptPath });
    // A stale receipt must not mark work done; everything is redone.
    expect(receipt.counts.written).toBe(fixture.map.entries.length);
  });

  it("changes the ledger digest when the plan changes", () => {
    const altered: ImportMap = {
      ...fixture.map,
      entries: [...fixture.map.entries.slice(1)],
    };
    expect(ledgerDigest(altered)).not.toBe(ledgerDigest(fixture.map));
  });

  it("persists a receipt that can be reloaded", () => {
    const dest = join(tmp, "receipt-roundtrip");
    mkdirSync(dest, { recursive: true });
    applyImport({ ...fixture, destination: dest });
    const loaded = loadReceipt(join(dest, "provenance/import-receipt.json"));
    expect(loaded?.ledgerDigest).toBe(ledgerDigest(fixture.map));
  });
});

describe("AFM-003: a populated destination fails non-destructively", () => {
  it("refuses to overwrite an unrelated file and changes nothing", () => {
    const dest = join(tmp, "occupied");
    mkdirSync(join(dest, "packages/diagram-engine"), { recursive: true });
    const victim = join(dest, "packages/diagram-engine/package.json");
    writeFileSync(victim, '{"name":"something-else-entirely"}');
    const before = readFileSync(victim, "utf8");

    const receipt = applyImport({ ...fixture, destination: dest });

    expect(receipt.conflicts.length).toBeGreaterThan(0);
    expect(receipt.conflicts[0]!.reason).toBe("exists-with-different-content");
    expect(receipt.completedAt).toBeNull();
    // The pre-existing file is untouched.
    expect(readFileSync(victim, "utf8")).toBe(before);
  });

  it("overwrites only paths explicitly reconciled", () => {
    const dest = join(tmp, "reconciled");
    mkdirSync(join(dest, "packages/diagram-engine"), { recursive: true });
    const victim = join(dest, "packages/diagram-engine/package.json");
    writeFileSync(victim, '{"name":"something-else-entirely"}');

    const receipt = applyImport({
      ...fixture,
      destination: dest,
      reconcile: ["packages/diagram-engine/package.json"],
    });

    expect(receipt.conflicts).toEqual([]);
    expect(readFileSync(victim, "utf8")).toBe('{"name":"archify"}');
  });

  it("supersedes a path while preserving the upstream copy", () => {
    const dest = join(tmp, "superseded");
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, "package.json"), '{"name":"owned-policy"}');

    const receipt = applyImport({
      ...fixture,
      destination: dest,
      supersede: ["package.json"],
    });

    expect(receipt.conflicts).toEqual([]);
    expect(receipt.superseded).toHaveLength(1);
    // The destination keeps its own file...
    expect(readFileSync(join(dest, "package.json"), "utf8")).toBe('{"name":"owned-policy"}');
    // ...and the upstream version is preserved rather than discarded.
    const preserved = join(dest, receipt.superseded[0]!.upstreamPreservedAt);
    expect(readFileSync(preserved, "utf8")).toBe('{"name":"hyperframes-monorepo"}');
  });

  it("skips an identical existing file without reporting a conflict", () => {
    const dest = join(tmp, "identical");
    mkdirSync(join(dest, "packages/diagram-engine"), { recursive: true });
    writeFileSync(join(dest, "packages/diagram-engine/package.json"), '{"name":"archify"}');

    const receipt = applyImport({ ...fixture, destination: dest });
    expect(receipt.conflicts).toEqual([]);
    expect(receipt.skippedIdentical).toContain("packages/diagram-engine/package.json");
  });
});

describe("AFM-003: corruption and escape are refused", () => {
  it("reports a hash mismatch rather than writing bad bytes", () => {
    const dest = join(tmp, "corrupt");
    mkdirSync(dest, { recursive: true });
    const corrupted: ImportMap = {
      ...fixture.map,
      entries: fixture.map.entries.map((e, i) => (i === 0 ? { ...e, sha256: "f".repeat(64) } : e)),
    };

    const receipt = applyImport({ ...fixture, map: corrupted, destination: dest });
    expect(receipt.conflicts.some((c) => c.reason === "hash-verification-failed")).toBe(true);
    expect(existsSync(join(dest, corrupted.entries[0]!.targetPath))).toBe(false);
  });

  it("refuses a target that escapes the destination", () => {
    const dest = join(tmp, "escape");
    mkdirSync(dest, { recursive: true });
    const escaping: ImportMap = {
      ...fixture.map,
      entries: [{ ...fixture.map.entries[0]!, targetPath: "../escaped.json" }],
    };

    const receipt = applyImport({ ...fixture, map: escaping, destination: dest });
    expect(receipt.conflicts[0]!.reason).toBe("outside-destination");
    expect(existsSync(join(tmp, "escaped.json"))).toBe(false);
  });

  it("dry run writes nothing at all", () => {
    const dest = join(tmp, "dry");
    mkdirSync(dest, { recursive: true });
    const receipt = applyImport({ ...fixture, destination: dest, dryRun: true });

    expect(receipt.counts.written).toBe(fixture.map.entries.length);
    for (const entry of fixture.map.entries) {
      expect(existsSync(join(dest, entry.targetPath))).toBe(false);
    }
    expect(existsSync(join(dest, "provenance/import-receipt.json"))).toBe(false);
  });
});

describe("AFM-003: the real imported tree", () => {
  it("contains no nested repository", () => {
    expect(findNestedRepositories(resolve("."), ["_sources", "node_modules", ".git"])).toEqual([]);
  }, 120_000);

  it("carries the expected workspace packages", () => {
    for (const pkg of [
      "diagram-engine",
      "diagram-viewer",
      "core",
      "producer",
      "studio",
      "studio-server",
      "sdk",
      "player",
      "cli",
    ]) {
      expect(existsSync(resolve("packages", pkg))).toBe(true);
    }
  });

  it("did not inherit upstream CI workflows", () => {
    // The ledger routes all 18 upstream workflow entries to docs/upstream/;
    // a live workflow file here would mean push/tag events could publish.
    const tracked = execSync("git ls-files .github/workflows", { encoding: "utf8" }).trim();
    expect(tracked).toBe("");
    const onDisk = existsSync(resolve(".github/workflows"))
      ? readdirSync(resolve(".github/workflows"))
      : [];
    expect(onDisk).toEqual([]);
  });

  it("claims no upstream repository ancestry in the root manifest", () => {
    const root = JSON.parse(readFileSync("package.json", "utf8"));
    expect(root.name).toBe("v-flow-exais");
    expect(root.repository).toBeUndefined();
    // The inherited lifecycle hook must not return.
    expect(root.scripts.prepare).toBeUndefined();
  });

  it("records the real import as complete with zero conflicts", () => {
    const receipt = loadReceipt("provenance/import-receipt.json");
    expect(receipt).not.toBeNull();
    expect(receipt!.counts.planned).toBe(7786);
    expect(receipt!.counts.written).toBe(7784);
    expect(receipt!.counts.superseded).toBe(2);
    expect(receipt!.conflicts).toEqual([]);
    expect(receipt!.completedAt).not.toBeNull();
  });
});
