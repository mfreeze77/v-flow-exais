#!/usr/bin/env bun
/**
 * CLI wrapper around the preflight library (AFM-001).
 *
 * Exit codes follow the planning tool this replaces:
 *   0  PASS — inputs match the pinned baseline
 *   2  DRIFT_REQUIRES_REVIEW or ERROR — a human reviews before any import
 *
 * Drift is never permission to substitute a newer source silently.
 *
 * Usage:
 *   bun run tools/import/preflight-cli.ts \
 *     --archify _sources/archify-main --hyperframes _sources/hyperframes-main \
 *     [--baseline <SOURCE_INVENTORY.json>] [--out provenance/source-preflight.json] \
 *     [--lock provenance/upstream-lock.json]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildUpstreamLock, preflight, type BaselineEntry } from "./preflight.ts";

const PACK = "_sources/archframe-unified-implementation-v2.0.0";
const DEFAULT_BASELINE = `${PACK}/provenance/SOURCE_INVENTORY.json`;

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

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (!args.archify || !args.hyperframes) {
    console.error("Required: --archify <path> --hyperframes <path>");
    return 2;
  }

  const baselinePath = args.baseline ?? DEFAULT_BASELINE;
  const baseline = JSON.parse(readFileSync(resolve(baselinePath), "utf8"))
    .entries as BaselineEntry[];

  const report = preflight({
    archify: args.archify,
    hyperframes: args.hyperframes,
    baseline,
    destination: args.destination ?? process.cwd(),
    quarantine: args.quarantine ?? "_sources",
    out: args.out,
  });

  if (args.out && report.errors.length === 0) {
    writeJson(args.out, report);
    console.log(`${report.status}: ${args.out}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  // The lock records only what was observed, so it is written even on drift —
  // a drift review needs the observed hashes to reason about.
  if (args.lock && report.errors.length === 0) {
    writeJson(args.lock, buildUpstreamLock(report));
    console.log(`lock: ${args.lock}`);
  }

  return report.status === "PASS" ? 0 : 2;
}

process.exitCode = main(process.argv.slice(2));
