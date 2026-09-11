#!/usr/bin/env bun
/**
 * CLI for the inherited-automation audit (AFM-005).
 * Exit 0 when nothing is blocked; exit 2 when live automation is present.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { auditAutomation, effectiveHooksPath } from "./audit-automation.ts";

const root = resolve(process.argv[2] ?? ".");
const audit = auditAutomation(root);
const hooksPath = effectiveHooksPath(root);

console.log(`hooks path: ${hooksPath ?? "(default .git/hooks)"}`);
console.log(`blocked: ${audit.summary.blocked}  review: ${audit.summary.review}`);
for (const f of audit.findings) {
  console.log(`  [${f.severity}] ${f.code} ${f.path}`);
  console.log(`      ${f.detail}`);
}

const out = "provenance/automation-audit.json";
mkdirSync(dirname(resolve(root, out)), { recursive: true });
writeFileSync(
  resolve(root, out),
  `${JSON.stringify({ ...audit, effectiveHooksPath: hooksPath }, null, 2)}\n`,
  "utf8",
);
console.log(`\n${audit.quarantined ? "PASS" : "FAIL"}: ${out}`);
process.exitCode = audit.quarantined ? 0 : 2;
