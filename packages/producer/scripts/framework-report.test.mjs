// V-Flow EXAIS: reporting proved against real runner output, not fixtures (AFM-012).
/**
 * These tests spawn Bun and Vitest for real.
 *
 * Hand-written report fixtures would pass against a parser that misreads the
 * actual format — which is exactly what happened twice while building this:
 * Bun nests a `testsuite` per describe block, and Vitest's
 * `numTotalTestSuites` counts describes rather than files. Both bugs produced
 * confident, wrong file counts and both were invisible to invented input. The
 * only thing that settles the format is the runner's own output, so every
 * parsing claim here is made against a process that really ran.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  readInvocationReport,
  reporterArgs,
  validateAgainstInvocation,
} from "./framework-report.mjs";
import { EVIDENCE } from "./lane-report.mjs";
import { PRODUCER_ROOT } from "./test-classification.mjs";

/**
 * Fixtures live inside the producer package so `vitest` and the workspace's
 * module resolution behave exactly as they do in a real lane run.
 */
const SCRATCH = mkdtempSync(join(PRODUCER_ROOT, ".framework-report-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

let counter = 0;
function fixture(source) {
  const dir = join(SCRATCH, `case-${(counter += 1)}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "sample.test.ts");
  writeFileSync(file, source);
  return {
    dir,
    file,
    relative: file
      .slice(PRODUCER_ROOT.length + 1)
      .split("\\")
      .join("/"),
  };
}

/** Runs a runner the way the lane does, then reads back what it wrote. */
function run(runner, relativeFile, { expectFailure = false } = {}) {
  const outfile = join(SCRATCH, `report-${counter}-${runner}`);
  const base =
    runner === "bun"
      ? ["test", `./${relativeFile}`]
      : ["x", "--no-install", "vitest", "run", relativeFile];
  const result = spawnSync("bun", [...base, ...reporterArgs(runner, outfile)], {
    cwd: PRODUCER_ROOT,
    encoding: "utf8",
    env: { ...process.env, HYPERFRAMES_TEST_LANE: "unit" },
  });

  assert.equal(result.error, undefined, `runner did not start: ${result.error}`);
  const exitCode = result.status ?? 1;
  if (expectFailure) {
    assert.notEqual(exitCode, 0, "fixture was supposed to fail but the runner exited 0");
  } else {
    assert.equal(exitCode, 0, `runner failed unexpectedly:\n${result.stdout}\n${result.stderr}`);
  }
  return {
    exitCode,
    evidence: readInvocationReport(outfile, runner, { files: [relativeFile], exitCode }),
  };
}

const PASSING = `
import { describe, expect, it } from "vitest";
describe("group one", () => {
  it("a", () => { expect(1).toBe(1); });
  it("b", () => { expect(2).toBe(2); });
});
describe("group two", () => {
  it("c", () => { expect(3).toBe(3); });
});
`;

const BUN_PASSING = `
import { describe, expect, it } from "bun:test";
describe("group one", () => {
  it("a", () => { expect(1).toBe(1); });
  it("b", () => { expect(2).toBe(2); });
});
describe("group two", () => {
  it("c", () => { expect(3).toBe(3); });
});
`;

describe("framework reporting — real Bun runs", () => {
  it("reads passing totals from Bun's own JUnit output", () => {
    const f = fixture(BUN_PASSING);
    const { evidence } = run("bun", f.relative);

    assert.equal(evidence.state, EVIDENCE.present, evidence.problems?.join("; "));
    assert.equal(evidence.results.casesPassed, 3);
    assert.equal(evidence.results.casesFailed, 0);
  });

  it("reports one collected file for a file containing several describe blocks", () => {
    // Bun emits a nested `testsuite` per describe. Counting suite elements
    // reported 3 files for this fixture and made a lane look better covered
    // than it was.
    const f = fixture(BUN_PASSING);
    const { evidence } = run("bun", f.relative);

    assert.equal(evidence.results.collectedFiles, 1);
  });

  it("reads a real failure as a failure", () => {
    const f = fixture(`
import { describe, expect, it } from "bun:test";
describe("group", () => {
  it("passes", () => { expect(1).toBe(1); });
  it("fails", () => { expect(1).toBe(2); });
});
`);
    const { evidence, exitCode } = run("bun", f.relative, { expectFailure: true });

    assert.equal(evidence.state, EVIDENCE.present, evidence.problems?.join("; "));
    assert.equal(evidence.results.casesFailed, 1);
    assert.equal(evidence.results.casesPassed, 1);
    // A non-zero exit accompanied by a reported failure is consistent evidence,
    // so it must be accepted rather than discarded as a reporting problem.
    assert.notEqual(exitCode, 0);
  });

  it("counts a skipped case separately from a passing one", () => {
    const f = fixture(`
import { describe, expect, it } from "bun:test";
describe("group", () => {
  it("runs", () => { expect(1).toBe(1); });
  it.skip("does not run", () => { expect(1).toBe(2); });
});
`);
    const { evidence } = run("bun", f.relative);

    assert.equal(evidence.results.casesSkipped, 1);
    assert.equal(evidence.results.casesPassed, 1);
    // A skipped case demonstrated nothing; folding it into passes would
    // overstate what ran.
    assert.notEqual(evidence.results.casesPassed, 2);
  });
});

describe("framework reporting — real Vitest runs", () => {
  it("reads passing totals from Vitest's own JSON output", () => {
    const f = fixture(PASSING);
    const { evidence } = run("vitest", f.relative);

    assert.equal(evidence.state, EVIDENCE.present, evidence.problems?.join("; "));
    assert.equal(evidence.results.casesPassed, 3);
    assert.equal(evidence.results.casesFailed, 0);
  });

  it("reports one collected file for a file containing several describe blocks", () => {
    // `numTotalTestSuites` is 2 for this fixture. Reporting 2 collected files
    // for 1 dispatched file also trips the dispatch cross-check, turning a
    // healthy run into rejected evidence.
    const f = fixture(PASSING);
    const { evidence } = run("vitest", f.relative);

    assert.equal(evidence.results.collectedFiles, 1);
    assert.equal(evidence.state, EVIDENCE.present);
  });

  it("reads a real failure as a failure", () => {
    const f = fixture(`
import { describe, expect, it } from "vitest";
describe("group", () => {
  it("passes", () => { expect(1).toBe(1); });
  it("fails", () => { expect(1).toBe(2); });
});
`);
    const { evidence } = run("vitest", f.relative, { expectFailure: true });

    assert.equal(evidence.state, EVIDENCE.present, evidence.problems?.join("; "));
    assert.equal(evidence.results.casesFailed, 1);
    assert.equal(evidence.results.casesPassed, 1);
  });

  it("records a file that throws on import as a collection error, not as zero failures", () => {
    // A file that never loaded ran none of its cases. Reporting "0 failed"
    // for it is how a crashed import reads as a clean run.
    const f = fixture(`
throw new Error("import-time explosion");
import { it } from "vitest";
it("never runs", () => {});
`);
    const { evidence } = run("vitest", f.relative, { expectFailure: true });

    assert.equal(evidence.state, EVIDENCE.present, evidence.problems?.join("; "));
    assert.equal(evidence.results.collectionErrors, 1);
    assert.equal(evidence.results.casesPassed, 0);
  });
});

describe("framework reporting — absent and inconsistent evidence", () => {
  it("treats a report the runner never wrote as missing, never as an empty pass", () => {
    const evidence = readInvocationReport(join(SCRATCH, "does-not-exist"), "bun", {
      files: ["a.test.ts"],
      exitCode: 0,
    });

    assert.equal(evidence.state, EVIDENCE.missing);
    assert.equal(evidence.results, null);
  });

  it("rejects a report covering more files than were dispatched", () => {
    // The shape a stale report from a wider earlier run takes.
    const evidence = validateAgainstInvocation(
      {
        collectedFiles: 42,
        casesPassed: 900,
        casesFailed: 0,
        casesSkipped: 0,
        collectionErrors: 0,
      },
      { files: ["a.test.ts"], exitCode: 0 },
    );

    assert.equal(evidence.state, EVIDENCE.unparsable);
    assert.equal(evidence.results, null);
    assert.match(evidence.problems[0], /42 files but 1 were dispatched/);
  });

  it("rejects an exit code that contradicts the reported counts", () => {
    const clean = validateAgainstInvocation(
      { collectedFiles: 1, casesPassed: 5, casesFailed: 0, casesSkipped: 0, collectionErrors: 0 },
      { files: ["a.test.ts"], exitCode: 1 },
    );
    assert.equal(clean.state, EVIDENCE.unparsable);

    const failing = validateAgainstInvocation(
      { collectedFiles: 1, casesPassed: 5, casesFailed: 2, casesSkipped: 0, collectionErrors: 0 },
      { files: ["a.test.ts"], exitCode: 0 },
    );
    assert.equal(failing.state, EVIDENCE.unparsable);
  });

  it("rejects an empty report file rather than reading it as a clean run", () => {
    const outfile = join(SCRATCH, "empty-report");
    writeFileSync(outfile, "");
    const evidence = readInvocationReport(outfile, "vitest", { files: ["a.test.ts"], exitCode: 0 });

    assert.equal(evidence.state, EVIDENCE.unparsable);
    assert.equal(evidence.results, null);
  });
});
