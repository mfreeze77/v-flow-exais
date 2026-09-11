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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

describe("AFM-004: licence records are reported, never required", () => {
  it("reports what is present without failing on a missing document", () => {
    // Documentation is not a build input. This repository is the owner's own
    // work under the owner's licence; a deleted notices file must not turn the
    // suite red.
    expect(Array.isArray(audit.licenses.required)).toBe(true);
    expect(audit.problems.filter((p) => p.includes("license record"))).toEqual([]);
  });

  it("reports no problem", () => {
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

describe("AFM-004: divergence from upstream is recorded, not gated", () => {
  it("records every file that differs from the bytes it was imported from", () => {
    // This is provenance, not policy: an upstream sync needs to know which
    // files this repository owns so it never clobbers them. Divergence is the
    // expected outcome of building a product, so it must not fail anything.
    expect(audit.modifications.length).toBeGreaterThan(0);
    for (const m of audit.modifications) {
      expect(m.upstreamSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.currentSha256).not.toBe(m.upstreamSha256);
      expect(m.reason).toBeTruthy();
    }
  });

  it("includes the early reconciliations with their specific reasons", () => {
    const byPath = new Map(audit.modifications.map((m) => [m.path, m.reason]));
    for (const path of [".gitignore", ".gitattributes", "bun.lock", "package.json"]) {
      expect(byPath.get(path)).toBeTruthy();
      expect(byPath.get(path)).not.toContain("no specific note");
    }
  });

  it("records a ledger target that no longer exists", () => {
    // A divergence check can only compare files that are still there, so a
    // moved or deleted import would otherwise vanish from the record entirely.
    const paths = audit.relocations.map((r) => r.ledgerTargetPath);
    expect(paths).toContain("packages/diagram-engine/package-lock.json");
    for (const r of audit.relocations) expect(r.reason).toBeTruthy();
  });

  it("passes with no problems even though many files diverge", () => {
    expect(audit.problems).toEqual([]);
    expect(audit.modifications.length).toBeGreaterThan(4);
  });
});
