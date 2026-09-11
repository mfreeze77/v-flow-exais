#!/usr/bin/env bun
/** CLI for the license and asset-rights audit (AFM-004). Exit 2 on any problem. */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { auditLegal } from "./asset-audit.ts";
import type { ImportMap } from "../import/plan.ts";

const root = resolve(process.argv[2] ?? ".");
const map = JSON.parse(
  readFileSync(resolve(root, "provenance/import-map.json"), "utf8"),
) as ImportMap;
const audit = auditLegal(root, map);

console.log("licenses present:", audit.licenses.allPresent);
for (const r of audit.licenses.required) {
  console.log(`  ${r.present ? "ok " : "MISSING"} ${r.path}  (${r.upstream})`);
}
console.log(`\nassets: ${audit.assets.fonts} fonts, ${audit.assets.media} media`);
console.log(`  pending rights review: ${audit.assets.pendingRightsReview}`);
console.log(`  font binaries in evidence/: ${audit.fontBinariesInEvidence.length}`);
console.log(`\nmodifications vs upstream: ${audit.modifications.length}`);
for (const m of audit.modifications) console.log(`  ${m.path}\n      ${m.reason.slice(0, 100)}`);

const write = (p: string, v: unknown) => {
  mkdirSync(dirname(resolve(root, p)), { recursive: true });
  writeFileSync(resolve(root, p), `${JSON.stringify(v, null, 2)}\n`, "utf8");
};
write("provenance/asset-audit.json", audit);
write("provenance/modification-ledger.json", {
  scope: "Files that diverge from the upstream bytes they were imported from (Apache-2.0 4(b)).",
  generatedBy: "tools/legal/asset-audit.ts",
  modifications: audit.modifications,
});

if (audit.problems.length > 0) {
  console.error(`\n${audit.problems.length} problem(s):`);
  for (const p of audit.problems) console.error(`  ${p}`);
  console.error("\nFAIL");
  process.exitCode = 2;
} else {
  console.log("\nPASS");
}
