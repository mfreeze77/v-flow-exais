#!/usr/bin/env bun
/**
 * CLI wrapper for the import apply step (AFM-003).
 *
 * Exit 0 when every planned entry is written and verified; exit 2 on any
 * conflict. Conflicts are listed rather than resolved: overwriting an existing
 * file needs a deliberate decision, passed as --reconcile.
 *
 * Usage:
 *   bun run tools/import/apply-cli.ts [--dry-run]
 *     [--map provenance/import-map.json] [--reconcile package.json,bun.lock]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { applyImport, findNestedRepositories, type ImportMap } from "./apply.ts";

function parseArgs(argv: string[]): Record<string, string | true> {
  const args: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key?.startsWith("--")) throw new Error(`Malformed argument ${JSON.stringify(key ?? "")}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key.slice(2)] = true;
    } else {
      args[key.slice(2)] = next;
      i++;
    }
  }
  return args;
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const mapPath = typeof args.map === "string" ? args.map : "provenance/import-map.json";
  const destination = typeof args.destination === "string" ? args.destination : process.cwd();
  const dryRun = args["dry-run"] === true;
  const reconcile =
    typeof args.reconcile === "string" ? args.reconcile.split(",").filter(Boolean) : [];
  const supersede =
    typeof args.supersede === "string" ? args.supersede.split(",").filter(Boolean) : [];

  const map = JSON.parse(readFileSync(resolve(mapPath), "utf8")) as ImportMap;

  const receipt = applyImport({
    map,
    archives: {
      archify: readFileSync(resolve("_sources/archify-main.zip")),
      hyperframes: readFileSync(resolve("_sources/hyperframes-main.zip")),
    },
    destination,
    reconcile,
    supersede,
    dryRun,
  });

  console.log(dryRun ? "DRY RUN" : "APPLY");
  console.log(`  planned:          ${receipt.counts.planned}`);
  console.log(`  written:          ${receipt.counts.written}`);
  console.log(`  skipped identical:${receipt.counts.skippedIdentical}`);
  console.log(`  superseded:       ${receipt.counts.superseded}`);
  for (const s of receipt.superseded) {
    console.log(`      ${s.targetPath} (upstream kept at ${s.upstreamPreservedAt})`);
  }
  console.log(`  conflicts:        ${receipt.counts.conflicts}`);

  if (receipt.conflicts.length > 0) {
    const byReason = new Map<string, string[]>();
    for (const c of receipt.conflicts) {
      const bucket = byReason.get(c.reason) ?? [];
      bucket.push(c.targetPath);
      byReason.set(c.reason, bucket);
    }
    console.error("");
    for (const [reason, paths] of byReason) {
      console.error(`  [${reason}] ${paths.length}`);
      for (const p of paths.slice(0, 25)) console.error(`      ${p}`);
      if (paths.length > 25) console.error(`      ... and ${paths.length - 25} more`);
    }
    console.error(
      "\nFAIL: nothing was overwritten. Re-run with --reconcile for deliberate overwrites.",
    );
    return 2;
  }

  if (!dryRun) {
    // A vendored .git would turn part of the tree into an untracked island.
    const nested = findNestedRepositories(resolve(destination), [
      "_sources",
      "node_modules",
      ".git",
    ]);
    if (nested.length > 0) {
      console.error(`\nFAIL: nested repositories present: ${nested.join(", ")}`);
      return 2;
    }
  }

  console.log("\nPASS");
  return 0;
}

process.exitCode = main(process.argv.slice(2));
