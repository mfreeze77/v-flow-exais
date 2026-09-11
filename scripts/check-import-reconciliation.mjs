#!/usr/bin/env node
/**
 * Every file the import ledger placed is still tracked, or its removal is declared.
 *
 * This exists because a file silently left the repository and nobody noticed for
 * weeks. `packages/producer/tests/render-symlinked-assets/src/shared` is a
 * symlink; git on Windows cannot stat it and prints
 *
 *   warning: could not open directory '...': Function not implemented
 *
 * and then reports nothing further. `git add -A` therefore stages it as
 * DELETED. It was added correctly as a mode-120000 blob in AFM-003 and removed
 * by AFM-005 — a commit about git hooks — with no sign in the diff review that
 * anything had happened. A clean `git status` was taken as proof the import was
 * fully committed, when for this path a clean status is exactly what a silent
 * deletion looks like.
 *
 * So completeness is asserted against the ledger rather than against git's
 * summary of its own view. Intentional removals are listed below with reasons:
 * a removal that cannot be explained is a finding, and a removal that can be
 * should be written down where the next person will look.
 */

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/**
 * Files the import placed that this repository has deliberately removed.
 *
 * Each entry must say why. "It was in the way" is not a reason; the point of
 * the ledger is that provenance survives the decision to drop something.
 */
export const DECLARED_REMOVALS = [
  {
    path: "packages/diagram-engine/package-lock.json",
    reason:
      "npm lockfile inherited from the Archify source. This is a Bun workspace with a " +
      "single root bun.lock; a nested npm lockfile describes a dependency tree that is " +
      "never installed and would contradict the one that is. Removed in AFM-009/AFM-011.",
  },
  {
    path: "packages/core/src/studio-api/index.ts",
    reason: "Deprecated forwarding surface removed as a deliberate fork break; see AFM-012.",
  },
  ...[
    "draftMarkers.ts",
    "finiteMutation.ts",
    "finiteMutation.test.ts",
    "manualEditsRenderScript.ts",
    "manualEditsRenderScript.test.ts",
    "screenshotClip.ts",
    "studioMotionRenderScript.ts",
    "studioMotionRenderScript.test.ts",
  ].map((name) => ({
    path: `packages/core/src/studio-api/helpers/${name}`,
    reason:
      "Deprecated forwarding shim re-exporting code that already lives in studio-server; " +
      "removed with the rest of the surface in AFM-012. The three .test.ts files were " +
      "duplicates of studio-server's own, so no coverage was lost.",
  })),
  {
    path: "scripts/publish-workflow.test.mjs",
    reason:
      "Asserted on .github/workflows/publish.yml, which this repository deliberately does " +
      "not have: every upstream workflow was imported under quarantine-automation, which " +
      "audit:automation asserts. Removed in AFM-012.",
  },
];

/** Repo-relative paths git currently tracks. */
export function trackedFiles(root = ROOT) {
  const listing = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return new Set(listing.split("\0").filter(Boolean));
}

/** Target paths the import ledger says it wrote. */
export function ledgerTargets(root = ROOT) {
  const map = JSON.parse(readFileSync(join(root, "provenance/import-map.json"), "utf8"));
  const targets = new Map();
  for (const entry of map.entries ?? []) {
    if (entry.targetPath) targets.set(entry.targetPath, entry);
  }
  return targets;
}

export function reconcile({ root = ROOT, removals = DECLARED_REMOVALS } = {}) {
  const tracked = trackedFiles(root);
  const targets = ledgerTargets(root);
  const declared = new Map(removals.map((r) => [r.path, r.reason]));

  const undeclared = [];
  const resurrected = [];

  for (const [path, entry] of targets) {
    const isTracked = tracked.has(path);
    if (!isTracked && !declared.has(path)) {
      undeclared.push({ path, disposition: entry.disposition });
    }
    // A path declared removed but tracked again means the declaration is stale
    // and would hide a future real deletion.
    if (isTracked && declared.has(path)) resurrected.push(path);
  }

  const unusedDeclarations = [...declared.keys()].filter((p) => !targets.has(p));

  return {
    ledgerFiles: targets.size,
    trackedFiles: tracked.size,
    undeclared,
    resurrected,
    unusedDeclarations,
    ok: undeclared.length === 0 && resurrected.length === 0 && unusedDeclarations.length === 0,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("\\").join("/"))) {
  if (!existsSync(join(ROOT, "provenance/import-map.json"))) {
    console.error("provenance/import-map.json is missing; the import ledger is the baseline.");
    process.exitCode = 1;
  } else {
    const report = reconcile();

    for (const { path, disposition } of report.undeclared) {
      console.error(`  MISSING  ${path}`);
      console.error(`           imported as "${disposition}" and no longer tracked, with no`);
      console.error("           entry in DECLARED_REMOVALS explaining why.");
    }
    for (const path of report.resurrected) {
      console.error(`  STALE    ${path} is declared removed but is tracked again.`);
    }
    for (const path of report.unusedDeclarations) {
      console.error(`  UNKNOWN  ${path} is declared removed but the ledger never placed it.`);
    }

    console.log(
      `\n${report.ok ? "PASS" : "FAIL"}: import reconciliation ` +
        `(${report.ledgerFiles} ledger files, ${report.trackedFiles} tracked)`,
    );
    process.exitCode = report.ok ? 0 : 1;
  }
}
