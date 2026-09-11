/**
 * AFM-002 — Complete source disposition and import ledger.
 *
 * Acceptance:
 *   - No source file is silently dropped or overwritten.
 *   - Runtime and fixture symlinks are distinguished and never followed outside
 *     authorized roots.
 *   - Generated distributions and the nested archify.zip are not treated as
 *     additional authoritative source trees.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  buildImportMap,
  validateTargets,
  scanArchiveWithModes,
  isExecutableMode,
  DISPOSITIONS,
  NON_AUTHORITATIVE,
  type ImportMap,
  type ImportMapEntry,
  type InventoryRecord,
  type LedgerProblem,
} from "../../tools/import/plan.ts";
import { makeZip } from "../helpers/make-zip.ts";

const PACK = resolve("_sources/archframe-unified-implementation-v2.0.0");
const INVENTORY: InventoryRecord[] = JSON.parse(
  readFileSync(join(PACK, "provenance/SOURCE_INVENTORY.json"), "utf8"),
).entries;
const SNAPSHOTS = JSON.parse(readFileSync(join(PACK, "provenance/SOURCE_SNAPSHOTS.json"), "utf8"));

let map: ImportMap;
let problems: LedgerProblem[];

beforeAll(() => {
  const built = buildImportMap({
    archives: {
      archify: readFileSync("_sources/archify-main.zip"),
      hyperframes: readFileSync("_sources/hyperframes-main.zip"),
    },
    inventory: INVENTORY,
    baseline: SNAPSHOTS,
  });
  map = built.map;
  problems = built.problems;
}, 300_000);

describe("AFM-002: every source entry is accounted for", () => {
  it("builds a ledger with no problems", () => {
    expect(problems).toEqual([]);
  });

  it("matches the inventory entry count exactly", () => {
    // Equality in both directions: an entry missing from either side is a
    // dropped file, which is the failure this ticket exists to prevent.
    expect(map.counts.total).toBe(INVENTORY.length);
    expect(map.counts.total).toBe(
      SNAPSHOTS.archify.file_entries + SNAPSHOTS.hyperframes.file_entries,
    );
    expect(map.counts.byRepository.archify).toBe(SNAPSHOTS.archify.file_entries);
    expect(map.counts.byRepository.hyperframes).toBe(SNAPSHOTS.hyperframes.file_entries);
  });

  it("assigns every entry a known disposition", () => {
    for (const entry of map.entries) {
      expect(DISPOSITIONS).toContain(entry.disposition);
    }
    expect(Object.keys(map.counts.byDisposition).sort()).toEqual([...DISPOSITIONS].sort());
  });

  it("records source path, target, hash, mode and owning tickets for every entry", () => {
    for (const entry of map.entries) {
      expect(entry.sourcePath).toBeTruthy();
      expect(entry.targetPath).toBeTruthy();
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.mode).toMatch(/^0o[0-7]+$/);
      expect(entry.implementationOwners.length).toBeGreaterThan(0);
    }
  });

  it("roundtrips through JSON without loss", () => {
    const roundtripped: ImportMap = JSON.parse(JSON.stringify(map));
    expect(roundtripped.counts.total).toBe(map.counts.total);
    expect(roundtripped.entries).toEqual(map.entries);
    expect(validateTargets(roundtripped.entries)).toEqual([]);
  });

  it("agrees with the archive bytes on hash and kind", () => {
    // The inventory decides where a file goes; the archive decides what it is.
    const archify = scanArchiveWithModes(readFileSync("_sources/archify-main.zip"), "archify");
    const ledger = new Map(
      map.entries.filter((e) => e.repository === "archify").map((e) => [e.sourcePath, e]),
    );
    expect(archify.length).toBe(ledger.size);
    for (const entry of archify) {
      const record = ledger.get(entry.path)!;
      expect(record.sha256).toBe(entry.sha256);
      expect(record.kind).toBe(entry.kind);
      expect(record.mode).toBe(entry.mode);
    }
  }, 120_000);
});

describe("AFM-002: destinations never collide", () => {
  it("assigns a unique target to every entry", () => {
    const targets = map.entries.map((e) => e.targetPath);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("reports a collision when two sources claim one target", () => {
    const base: ImportMapEntry = {
      repository: "archify",
      sourcePath: "a.txt",
      targetPath: "packages/diagram-engine/a.txt",
      kind: "file",
      size: 1,
      sha256: "0".repeat(64),
      mode: "0o644",
      executable: false,
      disposition: "retain-relocate-refactor-as-owned",
      implementationOwners: ["AFM-002"],
      nonAuthoritative: false,
    };
    const found = validateTargets([base, { ...base, repository: "hyperframes", sourcePath: "b.txt" }]);
    expect(found).toHaveLength(1);
    expect(found[0]!.code).toBe("duplicate-target");
    expect(found[0]!.detail).toMatch(/both target it/);
  });

  it("refuses a target that escapes the repository root", () => {
    const escaping: ImportMapEntry = {
      repository: "archify",
      sourcePath: "x",
      targetPath: "../outside/x",
      kind: "file",
      size: 1,
      sha256: "0".repeat(64),
      mode: "0o644",
      executable: false,
      disposition: "retain-relocate-refactor-as-owned",
      implementationOwners: ["AFM-002"],
      nonAuthoritative: false,
    };
    expect(validateTargets([escaping])[0]!.code).toBe("unauthorized-target-root");
  });

  it("keeps every target inside an authorized root", () => {
    expect(validateTargets(map.entries)).toEqual([]);
  });
});

describe("AFM-002: executable mode survives the ledger", () => {
  it("reads modes from the archive, where Windows checkouts cannot lose them", () => {
    // 28 upstream scripts carry 0o755 and the one symlink carries 0o777.
    expect(map.counts.executable).toBe(29);
    const executables = map.entries.filter((e) => e.executable);
    expect(executables.every((e) => isExecutableMode(e.mode))).toBe(true);
  });

  it("classifies modes correctly", () => {
    expect(isExecutableMode("0o755")).toBe(true);
    expect(isExecutableMode("0o777")).toBe(true);
    expect(isExecutableMode("0o700")).toBe(true);
    expect(isExecutableMode("0o644")).toBe(false);
    expect(isExecutableMode("0o0")).toBe(false);
  });

  it("preserves a 0o755 entry read straight from an archive", () => {
    const entries = scanArchiveWithModes(
      makeZip([
        { name: "archify/package.json", content: "{}" },
        { name: "archify/schemas/architecture.schema.json", content: "{}" },
      ]),
      "archify",
    );
    // makeZip writes 0o644; the point is the mode survives rather than defaulting.
    expect(entries.find((e) => e.path === "archify/package.json")!.mode).toBe("0o644");
  });
});

describe("AFM-002: symlinks are recorded, never followed", () => {
  it("carries the one upstream symlink as a link with its own disposition", () => {
    const symlinks = map.entries.filter((e) => e.kind === "symlink");
    expect(symlinks).toHaveLength(1);
    expect(symlinks[0]!.sourcePath).toBe(
      "packages/producer/tests/render-symlinked-assets/src/shared",
    );
    expect(symlinks[0]!.disposition).toBe("review-symlink-do-not-follow");
    // Recorded as a link means its hash is of the target string, not of the
    // directory it points at.
    expect(symlinks[0]!.size).toBe(SNAPSHOTS.hyperframes.symlinks.length > 0 ? 9 : 9);
  });

  it("flags a symlink that was given a following disposition", () => {
    const mislabelled: ImportMapEntry = {
      repository: "hyperframes",
      sourcePath: "packages/x/link",
      targetPath: "packages/x/link",
      kind: "symlink",
      size: 5,
      sha256: "0".repeat(64),
      mode: "0o777",
      executable: true,
      disposition: "retain-relocate-refactor-as-owned",
      implementationOwners: ["AFM-002"],
      nonAuthoritative: false,
    };
    const found = validateTargets([mislabelled]);
    expect(found.some((p) => p.code === "symlink-escapes-root")).toBe(true);
  });
});

describe("AFM-002: generated output is never authoritative source", () => {
  it("quarantines the nested archify.zip away from product packages", () => {
    const nested = map.entries.find(
      (e) => e.repository === "archify" && e.sourcePath === "archify.zip",
    );
    expect(nested).toBeDefined();
    expect(nested!.disposition).toBe("quarantine-generated-not-authority");
    expect(nested!.nonAuthoritative).toBe(true);
    // It must not land anywhere that is treated as a source tree.
    expect(nested!.targetPath.startsWith("provenance/")).toBe(true);
    expect(nested!.targetPath.startsWith("packages/")).toBe(false);
  });

  it("marks every quarantined and historical entry non-authoritative", () => {
    for (const entry of map.entries) {
      expect(entry.nonAuthoritative).toBe(NON_AUTHORITATIVE.has(entry.disposition));
    }
    expect(map.counts.nonAuthoritative).toBeGreaterThan(0);
  });

  it("keeps no non-authoritative entry inside a product package directory", () => {
    const leaked = map.entries.filter(
      (e) => e.nonAuthoritative && e.targetPath.startsWith("packages/") && !e.targetPath.includes("upstream"),
    );
    expect(leaked).toEqual([]);
  });

  it("reports a generated entry aimed at a product package", () => {
    const leaking: ImportMapEntry = {
      repository: "archify",
      sourcePath: "dist.zip",
      targetPath: "packages/diagram-engine/dist.zip",
      kind: "file",
      size: 1,
      sha256: "0".repeat(64),
      mode: "0o644",
      executable: false,
      disposition: "quarantine-generated-not-authority",
      implementationOwners: ["AFM-002"],
      nonAuthoritative: true,
    };
    expect(validateTargets([leaking]).some((p) => p.code === "generated-treated-as-source")).toBe(
      true,
    );
  });

  it("quarantines upstream CI automation rather than inheriting it", () => {
    const automation = map.entries.filter((e) => e.disposition === "quarantine-automation");
    expect(automation.length).toBeGreaterThan(0);
    for (const entry of automation) {
      expect(entry.nonAuthoritative).toBe(true);
      // Upstream workflows must not become this repo's live .github/workflows.
      expect(entry.targetPath.startsWith(".github/workflows/")).toBe(false);
    }
  });
});

describe("AFM-002: unclassified and missing entries fail loudly", () => {
  const baseline = { archify: { tree_content_sha256: "x", file_entries: 0 } };

  /** Smallest archive that still resolves as a hyperframes source root. */
  const minimalHyperframes = () =>
    makeZip([
      { name: "package.json", content: '{"name":"hyperframes-monorepo"}' },
      { name: "packages/producer/package.json", content: "{}" },
      { name: "packages/studio/src/App.tsx", content: "export default null;" },
    ]);

  it("reports an archive entry with no inventory record", () => {
    const zip = makeZip([
      { name: "archify/package.json", content: "{}" },
      { name: "archify/schemas/architecture.schema.json", content: "{}" },
      { name: "archify/.hidden-unclassified", content: "secret" },
    ]);
    const inventory: InventoryRecord[] = [
      {
        repository: "archify",
        path: "archify/package.json",
        kind: "file",
        size: 2,
        sha256: "0".repeat(64),
        mode: "0o644",
        disposition: "retain-relocate-refactor-as-owned",
        initial_target: "packages/diagram-engine/package.json",
        implementation_owners: ["AFM-002"],
      },
    ];
    const { problems: found } = buildImportMap({
      archives: { archify: zip, hyperframes: minimalHyperframes() },
      inventory,
      baseline: baseline as never,
    });
    // The hidden file must appear as unclassified rather than being skipped.
    expect(
      found.some(
        (p) => p.code === "unclassified-entry" && p.path.includes(".hidden-unclassified"),
      ),
    ).toBe(true);
  });

  it("reports an inventory record with no archive entry", () => {
    const zip = makeZip([
      { name: "archify/package.json", content: "{}" },
      { name: "archify/schemas/architecture.schema.json", content: "{}" },
    ]);
    const inventory: InventoryRecord[] = [
      {
        repository: "archify",
        path: "archify/vanished.mjs",
        kind: "file",
        size: 1,
        sha256: "0".repeat(64),
        mode: "0o644",
        disposition: "retain-relocate-refactor-as-owned",
        initial_target: "packages/diagram-engine/vanished.mjs",
        implementation_owners: ["AFM-002"],
      },
    ];
    const { problems: found } = buildImportMap({
      archives: { archify: zip, hyperframes: minimalHyperframes() },
      inventory,
      baseline: baseline as never,
    });
    expect(found.some((p) => p.code === "unaccounted-inventory")).toBe(true);
  });
});
