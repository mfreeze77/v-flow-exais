/**
 * AFM-004 — Retain licenses, notices and asset-rights provenance.
 *
 * Acceptance:
 *   - Every imported code area has traceable upstream license records.
 *   - Release asset inclusion has a rights decision rather than assuming source
 *     licenses cover media.
 *   - No implementation-ticket package or evidence bundle contains font
 *     binaries or embedded font payloads.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { auditLegal, FONT_EXTENSIONS } from "../../tools/legal/asset-audit.ts";
import type { ImportMap } from "../../tools/import/plan.ts";

let map: ImportMap;
let audit: ReturnType<typeof auditLegal>;

beforeAll(() => {
  map = JSON.parse(readFileSync("provenance/import-map.json", "utf8"));
  audit = auditLegal(resolve("."), map);
}, 300_000);

describe("AFM-004: upstream license records are retained", () => {
  it("has every required license record present", () => {
    expect(audit.licenses.allPresent).toBe(true);
    for (const record of audit.licenses.required) {
      expect(record.present).toBe(true);
    }
  });

  it("retains both upstream license texts in full", () => {
    expect(readFileSync("licenses/archify-LICENSE", "utf8")).toContain("MIT License");
    expect(readFileSync("licenses/hyperframes-LICENSE", "utf8")).toContain("Apache License");
  });

  it("preserves original copyright headers rather than stripping them on rebrand", () => {
    const archify = readFileSync("licenses/archify-LICENSE", "utf8");
    expect(archify).toContain("tt-a1i");
    expect(archify).toContain("Cocoon AI");
  });

  it("keeps per-package license records for the imported diagram engine", () => {
    expect(existsSync("packages/diagram-engine/LICENSE")).toBe(true);
    expect(existsSync("packages/diagram-engine/THIRD_PARTY_NOTICES.md")).toBe(true);
  });

  it("names both upstreams and the combined-work license in the root notices", () => {
    const notices = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
    expect(notices).toContain("MIT");
    expect(notices).toContain("Apache");
    // Every imported code area must be traceable to an upstream.
    for (const pkg of ["diagram-engine", "diagram-viewer", "core", "producer", "studio"]) {
      expect(notices).toContain(pkg);
    }
  });

  it("reports no legal problem", () => {
    expect(audit.problems).toEqual([]);
  });
});

describe("AFM-004: assets are decided separately from code", () => {
  it("counts fonts and media separately from source", () => {
    expect(audit.assets.fonts).toBeGreaterThan(0);
    expect(audit.assets.media).toBeGreaterThan(0);
    expect(audit.assets.pendingRightsReview).toBeGreaterThan(0);
  });

  it("classifies imported assets as rights-review in the ledger", () => {
    // The import ledger must not silently fold media into the code disposition.
    const media = map.entries.filter((e) => e.disposition === "rights-review-media");
    const fonts = map.entries.filter((e) => e.disposition.startsWith("rights-review-font"));
    expect(media.length).toBe(473);
    expect(fonts.length).toBe(102);
  });

  it("records an explicit rights decision rather than assuming code licenses cover media", () => {
    // This build is local-only and never distributed, so no distribution
    // obligation triggers. The policy exists so the decision is on record
    // rather than implied; it is deliberately not elaborated further.
    const policy = readFileSync("docs/legal/asset-policy.md", "utf8");
    expect(policy).toContain("Local use: proceed");
    expect(policy).toContain("Distribution: blocked pending review");
  });

  it("does not depend on a commercial font for rendering", () => {
    // The container installs open Debian families; a composition requiring a
    // vendored commercial face would be a portability defect as well as a
    // licensing one.
    const dockerfile = readFileSync(".devcontainer/Dockerfile", "utf8");
    expect(dockerfile).toContain("fonts-liberation");
    expect(dockerfile).toContain("fonts-dejavu-core");
    expect(dockerfile).not.toContain("TT_Norms");
  });
});

describe("AFM-004: no font binary reaches an evidence bundle", () => {
  it("has zero font binaries under evidence/", () => {
    expect(audit.fontBinariesInEvidence).toEqual([]);
  });

  it("detects a font binary if one is planted in evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "afm004-"));
    mkdirSync(join(root, "evidence/tickets/AFM-999"), { recursive: true });
    writeFileSync(join(root, "evidence/tickets/AFM-999/Sneaky.woff2"), "not really a font");
    for (const rel of [
      "licenses/archify-LICENSE",
      "licenses/archify-THIRD_PARTY_NOTICES.md",
      "licenses/hyperframes-LICENSE",
      "THIRD_PARTY_NOTICES.md",
    ]) {
      const full = join(root, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, rel.includes("hyperframes") ? "Apache License" : "MIT License");
    }

    const planted = auditLegal(root, { ...map, entries: [] });
    expect(planted.fontBinariesInEvidence).toContain("evidence/tickets/AFM-999/Sneaky.woff2");
    expect(planted.problems.some((p) => p.includes("font binaries"))).toBe(true);
  });

  it("recognises every font extension", () => {
    for (const ext of [".woff", ".woff2", ".ttf", ".otf", ".eot"]) {
      expect(FONT_EXTENSIONS.has(ext)).toBe(true);
    }
  });
});

describe("AFM-004: modifications to upstream files are recorded", () => {
  it("explains every divergence from upstream bytes", () => {
    // Apache-2.0 4(b) requires modified files to carry a notice of change.
    for (const m of audit.modifications) {
      expect(m.reason).not.toContain("UNEXPLAINED");
      expect(m.upstreamSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.currentSha256).not.toBe(m.upstreamSha256);
    }
  });

  it("records exactly the deliberate reconciliations", () => {
    expect(audit.modifications.map((m) => m.path).sort()).toEqual([
      ".gitattributes",
      ".gitignore",
      "bun.lock",
      "package.json",
      "packages/diagram-engine/package.json",
      "packages/diagram-engine/renderers/shared/cli.mjs",
    ]);
  });

  it("tracks a relocated file rather than letting it vanish silently", () => {
    // A divergence check can only compare files that still exist, so a moved
    // or deleted import would otherwise pass unnoticed.
    expect(audit.relocations.map((r) => r.ledgerTargetPath)).toEqual([
      "packages/diagram-engine/package-lock.json",
    ]);
    expect(audit.relocations[0]!.reason).not.toContain("UNEXPLAINED");
    expect(existsSync("docs/upstream/archify/package-lock.json")).toBe(true);
  });

  it("flags a ledger target that disappeared with no reason", () => {
    const result = auditLegal(resolve("."), {
      ...map,
      entries: [
        {
          repository: "hyperframes",
          sourcePath: "packages/core/src/vanished.ts",
          targetPath: "packages/core/src/vanished.ts",
          kind: "file",
          size: 1,
          sha256: "b".repeat(64),
          mode: "0o644",
          executable: false,
          disposition: "retain-relocate-refactor-as-owned",
          implementationOwners: ["AFM-004"],
          nonAuthoritative: false,
        },
      ],
    });
    expect(result.relocations[0]!.reason).toContain("UNEXPLAINED");
    expect(result.problems.some((p) => p.includes("missing with no recorded reason"))).toBe(true);
  }, 180_000);

  it("flags an undeclared modification", () => {
    const root = mkdtempSync(join(tmpdir(), "afm004-mod-"));
    for (const rel of [
      "licenses/archify-LICENSE",
      "licenses/archify-THIRD_PARTY_NOTICES.md",
      "licenses/hyperframes-LICENSE",
      "THIRD_PARTY_NOTICES.md",
    ]) {
      const full = join(root, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, rel.includes("hyperframes") ? "Apache License" : "MIT License");
    }
    mkdirSync(join(root, "packages/core/src"), { recursive: true });
    writeFileSync(join(root, "packages/core/src/index.ts"), "// quietly changed");

    const result = auditLegal(root, {
      ...map,
      entries: [
        {
          repository: "hyperframes",
          sourcePath: "packages/core/src/index.ts",
          targetPath: "packages/core/src/index.ts",
          kind: "file",
          size: 1,
          sha256: "a".repeat(64),
          mode: "0o644",
          executable: false,
          disposition: "retain-relocate-refactor-as-owned",
          implementationOwners: ["AFM-004"],
          nonAuthoritative: false,
        },
      ],
    });

    expect(result.modifications).toHaveLength(1);
    expect(result.modifications[0]!.reason).toContain("UNEXPLAINED");
    expect(result.problems.some((p) => p.includes("Unexplained divergence"))).toBe(true);
  });
});
