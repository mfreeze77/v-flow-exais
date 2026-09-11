#!/usr/bin/env bun
/** Workspace validation CLI (AFM-009). Exit 2 on any problem. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { checkWorkspace } from "./workspace.ts";

const root = resolve(process.argv[2] ?? ".");
const report = checkWorkspace(root);

console.log(`workspace packages: ${report.packageCount}`);
for (const p of report.packages) {
  console.log(`  ${p.private ? "private" : "public "}  ${p.name.padEnd(34)} ${p.dir}`);
}
if (report.problems.length > 0) {
  console.error(`\n${report.problems.length} problem(s):`);
  for (const p of report.problems) console.error(`  [${p.code}] ${p.package}: ${p.detail}`);
}
const out = "provenance/workspace-report.json";
mkdirSync(dirname(resolve(root, out)), { recursive: true });
writeFileSync(resolve(root, out), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`\n${report.valid ? "PASS" : "FAIL"}: ${out}`);
process.exitCode = report.valid ? 0 : 2;
