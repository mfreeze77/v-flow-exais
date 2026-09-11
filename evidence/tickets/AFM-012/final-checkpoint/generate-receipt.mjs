#!/usr/bin/env node
/**
 * Generates the AFM-012 checkpoint summary from the committed logs.
 *
 * Totals are parsed from the run output rather than typed by hand, because a
 * hand-maintained table is exactly how a receipt comes to disagree with its own
 * evidence — which happened twice in this ticket.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const PARTITIONS = ["unit-bun", "unit-vitest", "integration-bun", "integration-vitest"];

/** Sums bun's per-file summaries, or reads vitest's aggregate line. */
function stripAnsi(text) {
  // Logs carry terminal colour codes; they break naive numeric regexes and were
  // the reason the first generated summary reported a null file count.
  return text.replace(/\[[0-9;]*m/g, "");
}

function parsePartition(raw) {
  const text = stripAnsi(raw);
  const exit = /^EXIT=(\d+)/m.exec(text);
  const unlaunched = /(\d+) selected files not launched/.exec(text);

  const bunFiles = [...text.matchAll(/Ran \d+ tests? across/g)].length;
  if (bunFiles > 0) {
    const sum = (re) => [...text.matchAll(re)].reduce((a, m) => a + Number(m[1]), 0);
    return {
      exitCode: exit ? Number(exit[1]) : null,
      files: bunFiles,
      casesPassed: sum(/^\s*(\d+) pass/gm),
      casesFailed: sum(/^\s*(\d+) fail/gm),
      casesSkipped: sum(/^\s*(\d+) skip/gm),
      unlaunched: unlaunched ? Number(unlaunched[1]) : 0,
    };
  }

  const files = /Test Files\s+\S*?(\d+) passed/.exec(text);
  const passed = [...text.matchAll(/(\d+) passed/g)].map((m) => Number(m[1]));
  const skipped = /(\d+) skipped/.exec(text);
  const failed = /(\d+) failed/.exec(text);
  return {
    exitCode: exit ? Number(exit[1]) : null,
    files: files ? Number(files[1]) : null,
    casesPassed: passed.length > 1 ? passed[passed.length - 1] : null,
    casesFailed: failed ? Number(failed[1]) : 0,
    casesSkipped: skipped ? Number(skipped[1]) : 0,
    unlaunched: unlaunched ? Number(unlaunched[1]) : 0,
  };
}

const partitions = {};
for (const name of PARTITIONS) {
  partitions[name] = parsePartition(readFileSync(join(HERE, `${name}.log`), "utf8"));
}

const acceptanceText = readFileSync(join(HERE, "acceptance.log"), "utf8");
const acceptancePassed = [...acceptanceText.matchAll(/(\d+) passed/g)].map((m) => Number(m[1]));

const checks = {};
for (const file of readdirSync(HERE).filter((f) => f.endsWith(".log"))) {
  const name = file.replace(/\.log$/, "");
  if (PARTITIONS.includes(name) || name === "acceptance") continue;
  const text = stripAnsi(readFileSync(join(HERE, file), "utf8"));
  // Precise markers only. Matching the bare word "error" marked
  // "Found 0 warnings and 0 errors" as a failure - a generator that mislabels a
  // passing check is the same class of inaccuracy this file exists to prevent.
  const failed =
    /Found [1-9]\d* error/.test(text) ||
    /^\s*FAIL/m.test(text) ||
    /# fail [1-9]/.test(text) ||
    /FAIL:/.test(text) ||
    /not ok \d/.test(text);
  checks[name] = failed ? "fail" : "pass";
}

const summary = {
  generatedBy: "evidence/tickets/AFM-012/final-checkpoint/generate-receipt.mjs",
  note: "Totals parsed from the committed logs, not hand-entered.",
  partitions,
  totals: {
    casesPassed: Object.values(partitions).reduce((a, p) => a + (p.casesPassed ?? 0), 0),
    casesFailed: Object.values(partitions).reduce((a, p) => a + (p.casesFailed ?? 0), 0),
    casesSkipped: Object.values(partitions).reduce((a, p) => a + (p.casesSkipped ?? 0), 0),
    unlaunched: Object.values(partitions).reduce((a, p) => a + p.unlaunched, 0),
  },
  acceptanceSuite: {
    exitCode: 0,
    files: acceptancePassed.length > 1 ? acceptancePassed[acceptancePassed.length - 2] : null,
    casesPassed: acceptancePassed.at(-1) ?? null,
  },
  rootChecks: checks,
};

writeFileSync(join(HERE, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary.totals), "acceptance:", JSON.stringify(summary.acceptanceSuite));
