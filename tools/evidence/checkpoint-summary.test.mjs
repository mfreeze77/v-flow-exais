import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  consistencyProblems,
  parseTotals,
  readExitCode,
  summarise,
  verdictFor,
} from "./checkpoint-summary.mjs";

/** Writes controlled logs so false-success behaviour can be provoked. */
function evidence(logs) {
  const dir = mkdtempSync(join(tmpdir(), "checkpoint-"));
  for (const [name, text] of Object.entries(logs)) {
    writeFileSync(join(dir, `${name}.log`), text);
  }
  return dir;
}

describe("checkpoint summary — a failing run must never read as passing", () => {
  it("reports a non-zero exit as a failure", () => {
    // The previous generator hard-coded exitCode: 0 for the acceptance suite.
    const dir = evidence({ acceptance: "Tests  5 passed (5)\nEXIT=1\n" });
    const summary = summarise(dir, { partitions: [], suites: ["acceptance"] });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.suites.acceptance.status, "fail");
    assert.equal(summary.suites.acceptance.exitCode, 1);
    assert.equal(summary.trustworthy, false);
  });

  it("reports exit 7 from a root check as a failure", () => {
    const dir = evidence({ "some-check": "doing things\nEXIT=7\n" });
    const summary = summarise(dir);
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.rootChecks["some-check"].status, "fail");
    assert.equal(summary.rootChecks["some-check"].exitCode, 7);
  });

  it("treats an empty log as unknown, not as a pass", () => {
    const dir = evidence({ "empty-check": "" });
    const summary = summarise(dir);
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.rootChecks["empty-check"].status, "unknown");
    assert.equal(summary.rootChecks["empty-check"].reason, "log empty");
    assert.equal(summary.trustworthy, false);
  });

  it("treats a log with no recorded exit code as unknown", () => {
    // Deciding pass/fail from console prose is what allowed a FAIL line to be
    // missed entirely when its detector contained a stray byte.
    const dir = evidence({ "no-exit": "FAIL: package boundaries\n" });
    const summary = summarise(dir);
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.rootChecks["no-exit"].status, "unknown");
    assert.equal(summary.rootChecks["no-exit"].reason, "no exit code recorded");
  });

  it("does not depend on matching any failure word in output", () => {
    // A check that exits 0 passes even if its output happens to contain "FAIL",
    // and one that exits non-zero fails even if its output looks clean.
    const dir = evidence({
      noisy: "the string FAIL: appears in this output\nEXIT=0\n",
      quiet: "everything looks fine\nEXIT=2\n",
    });
    const summary = summarise(dir);
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.rootChecks.noisy.status, "pass");
    assert.equal(summary.rootChecks.quiet.status, "fail");
  });
});

describe("checkpoint summary — counts come from labelled lines", () => {
  it("counts a vitest failure rather than reading the last 'N passed'", () => {
    // "1 failed | 41 passed (42)" for files, "3 failed | 660 passed (663)" for
    // cases. An earlier parser took the final "N passed" it saw.
    const log = [
      " Test Files  1 failed | 41 passed (42)",
      "      Tests  3 failed | 660 passed (663)",
      "EXIT=1",
      "",
    ].join("\n");
    const totals = parseTotals(log);

    assert.equal(totals.runner, "vitest");
    assert.equal(totals.files, 42);
    assert.equal(totals.casesFailed, 3);
    assert.equal(totals.casesPassed, 660);
  });

  it("reads a skip count without folding it into passes", () => {
    const totals = parseTotals("      Tests  672 passed | 1 skipped (673)\nEXIT=0\n");
    assert.equal(totals.casesPassed, 672);
    assert.equal(totals.casesSkipped, 1);
  });

  it("sums bun's per-file summaries", () => {
    const log = [
      " 3 pass",
      " 0 fail",
      "Ran 3 tests across 1 file.",
      " 4 pass",
      " 1 fail",
      "Ran 5 tests across 1 file.",
      "EXIT=1",
      "",
    ].join("\n");
    const totals = parseTotals(log);

    assert.equal(totals.runner, "bun");
    assert.equal(totals.files, 2);
    assert.equal(totals.casesPassed, 7);
    assert.equal(totals.casesFailed, 1);
  });

  it("strips terminal colour codes before parsing", () => {
    const coloured = "[2m Test Files [22m[32m9 passed[39m (9)\nEXIT=0\n";
    assert.equal(parseTotals(coloured).files, 9);
  });

  it("reports unknown totals when neither runner's summary is present", () => {
    const totals = parseTotals("something else entirely\nEXIT=0\n");
    assert.equal(totals.casesPassed, null);
  });
});

describe("checkpoint summary — internal inconsistency is reported", () => {
  it("flags exit 0 alongside reported failing cases", () => {
    const problems = consistencyProblems(
      { status: "pass", exitCode: 0 },
      { casesPassed: 5, casesFailed: 2, casesSkipped: 0 },
      0,
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /exit 0 but 2 case/);
  });

  it("flags exit 0 alongside unlaunched files", () => {
    const problems = consistencyProblems(
      { status: "pass", exitCode: 0 },
      { casesPassed: 5, casesFailed: 0, casesSkipped: 0 },
      7,
    );
    assert.match(problems[0], /7 file\(s\) never launched/);
  });

  it("flags a non-zero exit with nothing reported failing", () => {
    const problems = consistencyProblems(
      { status: "fail", exitCode: 1 },
      { casesPassed: 5, casesFailed: 0, casesSkipped: 0 },
      0,
    );
    assert.match(problems[0], /no failing cases or unlaunched/);
  });

  it("rejects a negative or fractional count", () => {
    const problems = consistencyProblems(
      { status: "pass", exitCode: 0 },
      { casesPassed: -3, casesFailed: 0, casesSkipped: 1.5 },
      0,
    );
    assert.equal(problems.length, 2);
  });

  it("marks the whole summary untrustworthy when any problem exists", () => {
    const dir = evidence({ "unit-bun": " 5 pass\n 1 fail\nRan 6 tests across 1 file.\nEXIT=0\n" });
    const summary = summarise(dir, { partitions: ["unit-bun"], suites: [] });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.trustworthy, false);
    assert.ok(summary.problems.some((p) => p.includes("exit 0 but 1 case")));
  });
});

describe("checkpoint summary — totals refuse to guess", () => {
  it("reports null overall when one partition's totals are unknown", () => {
    const dir = evidence({
      "unit-bun": " 5 pass\n 0 fail\nRan 5 tests across 1 file.\nEXIT=0\n",
      "unit-vitest": "no recognisable summary\nEXIT=0\n",
    });
    const summary = summarise(dir, {
      partitions: ["unit-bun", "unit-vitest"],
      suites: [],
    });
    rmSync(dir, { recursive: true, force: true });

    // 5 would understate the truth by treating unknown as zero.
    assert.equal(summary.totals.casesPassed, null);
  });

  it("reads an exit code only from its own line", () => {
    assert.equal(readExitCode("EXIT=0\n"), 0);
    assert.equal(readExitCode("EXIT=3\n"), 3);
    assert.equal(readExitCode("the text EXIT=0 inline"), null);
    assert.equal(readExitCode("no exit here"), null);
  });

  it("treats a missing log as unknown", () => {
    assert.equal(verdictFor(null).status, "unknown");
    assert.equal(verdictFor(null).reason, "log missing");
  });
});

describe("checkpoint summary — framework evidence outranks console text", () => {
  /** Writes a log plus the lane report the runner would have left beside it. */
  function laneEvidence(name, log, report) {
    const dir = mkdtempSync(join(tmpdir(), "checkpoint-lane-"));
    writeFileSync(join(dir, `${name}.log`), log);
    if (report) writeFileSync(join(dir, `${name}.report.json`), JSON.stringify(report));
    return dir;
  }

  const complete = (execution) => ({
    status: "complete",
    runner: "vitest",
    evidenceComplete: true,
    execution,
    dispatch: { undispatchedFiles: [] },
  });

  it("takes totals from the lane report, not from the terminal summary", () => {
    // The console text here is unparsable, which is exactly the case that made
    // a real, fully green lane report every count as "unknown".
    const dir = laneEvidence(
      "unit-vitest",
      "some terminal output with no recognisable summary\nEXIT=0\n",
      complete({
        collectedFiles: 42,
        casesPassed: 672,
        casesFailed: 0,
        casesSkipped: 1,
        collectionErrors: 0,
      }),
    );
    const summary = summarise(dir, { partitions: ["unit-vitest"], suites: [] });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.partitions["unit-vitest"].casesPassed, 672);
    assert.equal(summary.partitions["unit-vitest"].source, "framework");
    assert.equal(summary.trustworthy, true);
  });

  it("says when totals came from terminal text instead", () => {
    const dir = laneEvidence("unit-bun", " 5 pass\n 0 fail\nRan 5 tests across 1 file.\nEXIT=0\n", null);
    const summary = summarise(dir, { partitions: ["unit-bun"], suites: [] });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.partitions["unit-bun"].source, "console-text");
    assert.equal(summary.partitions["unit-bun"].casesPassed, 5);
    // Usable, but not framework-confirmed, and the summary must not imply it
    // was: a silent fallback is how the broken wiring went unnoticed.
    assert.equal(summary.trustworthy, false);
    assert.ok(summary.problems.some((p) => p.includes("no lane report")));
  });

  it("refuses a clean exit whose lane report cannot confirm execution", () => {
    // Exit 0 with unconfirmed execution is the exact shape this tool exists to
    // stop being reported as a pass.
    const dir = laneEvidence("unit-vitest", "looks fine\nEXIT=0\n", {
      ...complete({
        collectedFiles: null,
        casesPassed: null,
        casesFailed: null,
        casesSkipped: null,
        collectionErrors: null,
      }),
      evidenceComplete: false,
      status: "evidence-incomplete",
    });
    const summary = summarise(dir, { partitions: ["unit-vitest"], suites: [] });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.partitions["unit-vitest"].status, "pass");
    assert.equal(summary.trustworthy, false);
    assert.ok(summary.problems.some((p) => p.includes("evidenceComplete")));
  });

  it("reports files the lane never launched even when the process exited 0", () => {
    const dir = laneEvidence("integration-bun", "fine\nEXIT=0\n", {
      ...complete({
        collectedFiles: 3,
        casesPassed: 30,
        casesFailed: 0,
        casesSkipped: 0,
        collectionErrors: 0,
      }),
      dispatch: { undispatchedFiles: ["a.test.ts", "b.test.ts"] },
    });
    const summary = summarise(dir, { partitions: ["integration-bun"], suites: [] });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.partitions["integration-bun"].unlaunched, 2);
    assert.equal(summary.trustworthy, false);
    assert.ok(summary.problems.some((p) => p.includes("a.test.ts")));
  });

  it("treats an unreadable lane report as a problem, not as absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "checkpoint-lane-"));
    writeFileSync(join(dir, "unit-bun.log"), "fine\nEXIT=0\n");
    writeFileSync(join(dir, "unit-bun.report.json"), "{ this is not json");
    const summary = summarise(dir, { partitions: ["unit-bun"], suites: [] });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(summary.trustworthy, false);
    assert.ok(summary.problems.some((p) => p.includes("not valid JSON")));
  });
});
