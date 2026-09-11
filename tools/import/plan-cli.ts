#!/usr/bin/env bun
/**
 * CLI wrapper for the import ledger (AFM-002).
 *
 * Exit 0 when every archive entry is accounted for with a valid, collision-free
 * destination; exit 2 on any ledger problem. A problem is never written away —
 * the report lists it and the map is still emitted so it can be inspected.
 *
 * Usage:
 *   bun run tools/import/plan-cli.ts \
 *     --archify _sources/archify-main.zip \
 *     --hyperframes _sources/hyperframes-main.zip \
 *     --out provenance/import-map.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildImportMap, type InventoryRecord } from "./plan.ts";

const PACK = "_sources/archframe-unified-implementation-v2.0.0";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Malformed argument near ${JSON.stringify(key ?? "")}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const archifyZip = args.archify ?? "_sources/archify-main.zip";
  const hyperframesZip = args.hyperframes ?? "_sources/hyperframes-main.zip";
  const out = args.out ?? "provenance/import-map.json";

  const inventory = JSON.parse(
    readFileSync(resolve(args.inventory ?? `${PACK}/provenance/SOURCE_INVENTORY.json`), "utf8"),
  ).entries as InventoryRecord[];
  const baseline = JSON.parse(
    readFileSync(resolve(args.baseline ?? `${PACK}/provenance/SOURCE_SNAPSHOTS.json`), "utf8"),
  );

  const { map, problems } = buildImportMap({
    archives: {
      archify: readFileSync(resolve(archifyZip)),
      hyperframes: readFileSync(resolve(hyperframesZip)),
    },
    inventory,
    baseline,
  });

  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${JSON.stringify(map, null, 2)}\n`, "utf8");

  console.log(`entries: ${map.counts.total}`);
  console.log(`  executable: ${map.counts.executable}`);
  console.log(`  symlinks: ${map.counts.symlinks}`);
  console.log(`  non-authoritative: ${map.counts.nonAuthoritative}`);
  for (const [disposition, count] of Object.entries(map.counts.byDisposition).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${String(count).padStart(5)}  ${disposition}`);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} ledger problem(s):`);
    for (const problem of problems.slice(0, 50)) {
      console.error(`  [${problem.code}] ${problem.path}: ${problem.detail}`);
    }
    if (problems.length > 50) console.error(`  ... and ${problems.length - 50} more`);
    console.error(`\nFAIL: ${out}`);
    return 2;
  }

  console.log(`\nPASS: ${out}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
