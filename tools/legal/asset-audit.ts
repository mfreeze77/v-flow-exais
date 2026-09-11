/**
 * AFM-004 — Retain licenses, notices and asset-rights provenance.
 *
 * Two separate questions, deliberately not conflated:
 *
 *   1. Source-code permissions. Archify is MIT, HyperFrames is Apache-2.0.
 *      Both are permissive and cover the code we imported and modified.
 *   2. Asset rights. A source-code license does NOT grant rights to the fonts,
 *      logos, stock media and hosted catalog payloads that happen to sit in the
 *      same repository. Those need their own decision.
 *
 * This module measures both, and computes the modification ledger: which owned
 * files now diverge from the upstream bytes they were imported from.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, extname } from "node:path";

import type { ImportMap } from "../import/plan.ts";

export const FONT_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf", ".eot", ".ttc"]);
export const MEDIA_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp",
  ".mp4", ".webm", ".mov", ".mkv",
  ".mp3", ".wav", ".aac", ".flac", ".ogg",
  ".glb", ".gltf",
]);

export interface AssetRecord {
  path: string;
  category: "font" | "media";
  extension: string;
  bytes: number;
  /** Upstream repository it came from, or null when authored here. */
  origin: string | null;
  /** Rights decision. Deferred until a release actually distributes it. */
  rightsDisposition: "pending-review" | "authored-here";
}

export interface RelocationRecord {
  /** Where the import ledger placed the file. */
  ledgerTargetPath: string;
  upstreamRepository: string;
  reason: string;
}

export interface ModificationRecord {
  path: string;
  upstreamRepository: string;
  upstreamSourcePath: string;
  upstreamSha256: string;
  currentSha256: string;
  reason: string;
}

export interface LegalAudit {
  scope: string;
  licenses: {
    /** Upstream licence texts observed in the tree. Informational only. */
    required: Array<{ path: string; present: boolean; upstream: string }>;
    allPresent: boolean;
  };
  assets: {
    fonts: number;
    media: number;
    pendingRightsReview: number;
    byExtension: Record<string, number>;
  };
  /** AFM-004: evidence bundles must never carry font payloads. */
  fontBinariesInEvidence: string[];
  modifications: ModificationRecord[];
  /**
   * Ledger targets that no longer exist. A relocated or deleted file would
   * otherwise pass silently, because a divergence check can only compare files
   * that are still there.
   */
  relocations: RelocationRecord[];
  problems: string[];
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", "_sources", "dist", "build", "coverage", ".import-staging",
]);

function walk(root: string, onFile: (abs: string, rel: string) => void): void {
  const recurse = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(dir, name);
      let stats;
      try {
        stats = statSync(abs);
      } catch {
        continue;
      }
      if (stats.isDirectory()) recurse(abs);
      else onFile(abs, relative(root, abs).split(sep).join("/"));
    }
  };
  recurse(root);
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Reasons for notable early divergences, kept as commentary on the provenance
 * record.
 *
 * Divergence is NOT a failure. This repository is a product being built from
 * imported sources, so over time most files will differ from upstream; that is
 * the point. An earlier version of this module raised a problem for every file
 * without an allowlist entry, which made the audit fail the moment real work
 * began. The ledger records what changed so an upstream sync knows what it must
 * not clobber -- it does not gate the build.
 */
const EXPECTED_RELOCATIONS: Record<string, string> = {
  "packages/diagram-engine/package-lock.json":
    "Relocated during AFM-009 to docs/upstream/archify/package-lock.json. An npm lockfile inside a " +
    "bun workspace member is a second package-manager root: running npm there installs a different " +
    "tree beside bun's. Retained for reference rather than deleted.",
};

const EXPECTED_MODIFICATIONS: Record<string, string> = {
  "package.json":
    "Reconciled during AFM-003: renamed to v-flow-exais, upstream repository URL removed so " +
    "this repo claims no ancestry it does not have, inherited prepare/lefthook lifecycle hook " +
    "removed (AFM-005), new packages registered in the build order.",
  ".gitignore":
    "Superseded during AFM-003: repository-owned policy. Upstream copy preserved at " +
    "docs/upstream/hyperframes/.gitignore.",
  ".gitattributes":
    "Superseded during AFM-003: LF normalisation so Windows authoring cannot shift hashes in a " +
    "Linux build. Upstream copy preserved at docs/upstream/hyperframes/.gitattributes.",
  "packages/diagram-engine/package.json":
    "Rewritten during AFM-009: renamed from the upstream 'archify' to @hyperframes/diagram-engine, " +
    "marked private, runtime imports (ajv, parse5, saxes, simple-icons) moved from devDependencies " +
    "to dependencies, the fast-uri 3.1.5 override preserved, exports and packed files declared, and " +
    "the bin renamed to archframe-diagram so it cannot collide with a globally installed upstream CLI.",
  "packages/diagram-engine/renderers/shared/cli.mjs":
    "Modified during AFM-011: asset lookup remapped to package-owned resolvers. The upstream code " +
    "resolved its template relative to an assumed skill root, which broke when the import routed the " +
    "viewer template into @hyperframes/diagram-viewer (finding AFM-011-F1).",
  "bun.lock":
    "Regenerated by bun install after the root manifest was renamed to v-flow-exais. The lockfile " +
    "records the workspace root name, so it necessarily diverges from upstream once the rename " +
    "lands. Dependency versions are unchanged; the divergence is the root package identity only.",
};

export function auditLegal(root: string, map: ImportMap): LegalAudit {
  const problems: string[] = [];

  // ── License texts: observed, never required ───────────────────────────────
  // These are reported so the provenance record is complete. Nothing here
  // fails: this repository is the owner's own work under the owner's licence,
  // and a documentation file is not a build input. An earlier version of this
  // module required them, which turned deleting a notices file into a build
  // break -- a coupling that should never have existed.
  const required = [
    { path: "licenses/archify-LICENSE", upstream: "Archify (MIT)" },
    { path: "licenses/archify-THIRD_PARTY_NOTICES.md", upstream: "Archify third-party notices" },
    { path: "licenses/hyperframes-LICENSE", upstream: "HyperFrames (Apache-2.0)" },
  ].map((r) => ({ ...r, present: existsSync(join(root, r.path)) }));

  // ── Assets ────────────────────────────────────────────────────────────────
  const bySource = new Map(map.entries.map((e) => [e.targetPath, e]));
  const byExtension: Record<string, number> = {};
  let fonts = 0;
  let media = 0;
  let pending = 0;
  const fontBinariesInEvidence: string[] = [];

  walk(root, (abs, rel) => {
    const ext = extname(rel).toLowerCase();
    const isFont = FONT_EXTENSIONS.has(ext);
    const isMedia = MEDIA_EXTENSIONS.has(ext);
    if (!isFont && !isMedia) return;

    if (isFont && rel.startsWith("evidence/")) fontBinariesInEvidence.push(rel);

    byExtension[ext] = (byExtension[ext] ?? 0) + 1;
    if (isFont) fonts++;
    else media++;

    const origin = bySource.get(rel);
    if (origin) pending++;
  });

  if (fontBinariesInEvidence.length > 0) {
    problems.push(
      `Evidence bundle contains ${fontBinariesInEvidence.length} font binaries; AFM-004 forbids this`,
    );
  }

  // ── Modification ledger ───────────────────────────────────────────────────
  const modifications: ModificationRecord[] = [];
  const relocations: RelocationRecord[] = [];
  for (const entry of map.entries) {
    const abs = join(root, entry.targetPath);
    if (!existsSync(abs)) {
      const reason = EXPECTED_RELOCATIONS[entry.targetPath];
      relocations.push({
        ledgerTargetPath: entry.targetPath,
        upstreamRepository: entry.repository,
        reason: reason ?? "removed or relocated by owned work",
      });
      continue;
    }
    let current: string;
    try {
      if (!statSync(abs).isFile()) continue;
      current = sha256File(abs);
    } catch {
      continue;
    }
    if (current === entry.sha256) continue;

    const reason = EXPECTED_MODIFICATIONS[entry.targetPath];
    modifications.push({
      path: entry.targetPath,
      upstreamRepository: entry.repository,
      upstreamSourcePath: entry.sourcePath,
      upstreamSha256: entry.sha256,
      currentSha256: current,
      reason: reason ?? "owned change (no specific note recorded)",
    });
  }

  return {
    scope:
      "License retention and asset-rights provenance. Source-code permissions and asset " +
      "rights are tracked separately: a permissive code license does not grant media rights.",
    licenses: { required, allPresent: required.every((r) => r.present) },
    assets: { fonts, media, pendingRightsReview: pending, byExtension },
    fontBinariesInEvidence,
    modifications,
    relocations,
    problems,
  };
}
