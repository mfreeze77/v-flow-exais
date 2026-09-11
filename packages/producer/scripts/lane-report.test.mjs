import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLaneReport,
  classifyDispatch,
  DISPATCH,
  EVIDENCE,
  formatLaneReport,
  normalizeFrameworkResults,
  validateFrameworkReport,
} from "./lane-report.mjs";

const base = {
  lane: "unit",
  runner: "vitest",
  command: "bun run test:unit:vitest",
  runId: "run-1",
  revision: "abc1234",
  runtime: { node: "v22.23.2", bun: "1.3.13" },
};

const ok = (files, results) => ({
  args: ["x", "vitest", "run", ...files],
  files,
  dispatch: DISPATCH.completed,
  exitCode: 0,
  evidenceState: EVIDENCE.present,
  frameworkResults: results,
});

describe("lane report — a clean run", () => {
  it("reports complete with framework-confirmed totals", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts", "b.test.ts"],
      invocations: [
        ok(["a.test.ts", "b.test.ts"], {
          collectedFiles: 2,
          casesPassed: 10,
          casesFailed: 0,
          casesSkipped: 0,
          collectionErrors: 0,
        }),
      ],
    });

    assert.equal(report.status, "complete");
    assert.equal(report.evidenceComplete, true);
    assert.equal(report.execution.casesPassed, 10);
    assert.deepEqual(report.dispatch.undispatchedFiles, []);
  });

  it("records the revision, runtime, run identifier and command", () => {
    const report = buildLaneReport({ ...base, selected: [], invocations: [] });
    assert.equal(report.revision, "abc1234");
    assert.equal(report.runId, "run-1");
    assert.equal(report.command, "bun run test:unit:vitest");
    assert.deepEqual(report.runtime, { node: "v22.23.2", bun: "1.3.13" });
  });
});

describe("lane report — injected failures", () => {
  it("a child process that cannot start invents no execution results", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts"],
      invocations: [
        {
          args: ["test", "./a.test.ts"],
          files: ["a.test.ts"],
          dispatch: DISPATCH.spawnFailed,
          error: "spawn ENOENT",
        },
      ],
    });

    assert.equal(report.status, "spawn-failed");
    // Not zero: unknown.
    assert.equal(report.execution.casesPassed, null);
    assert.equal(report.execution.casesFailed, null);
    assert.equal(report.dispatch.invocations[0].error, "spawn ENOENT");
  });

  it("a collection failure is distinct from an assertion failure", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts"],
      invocations: [
        {
          ...ok(["a.test.ts"], {
            collectedFiles: 0,
            casesPassed: 0,
            casesFailed: 0,
            casesSkipped: 0,
            collectionErrors: 1,
          }),
          exitCode: 1,
        },
      ],
    });

    assert.equal(report.execution.collectionErrors, 1);
    assert.equal(report.execution.casesFailed, 0);
    // A file that failed to import proves nothing about its cases.
    assert.equal(report.execution.collectedFiles, 0);
    assert.equal(report.status, "failed");
  });

  it("fail-fast records the exact identities of undispatched files", () => {
    const report = buildLaneReport({
      ...base,
      runner: "bun",
      selected: ["a.test.ts", "b.test.ts", "c.test.ts"],
      invocations: [
        {
          ...ok(["a.test.ts"], {
            collectedFiles: 1,
            casesPassed: 3,
            casesFailed: 1,
            casesSkipped: 0,
            collectionErrors: 0,
          }),
          exitCode: 1,
        },
        { args: [], files: ["b.test.ts"], dispatch: DISPATCH.notDispatched },
        { args: [], files: ["c.test.ts"], dispatch: DISPATCH.notDispatched },
      ],
    });

    assert.equal(report.status, "incomplete");
    assert.deepEqual(report.dispatch.undispatchedFiles, ["b.test.ts", "c.test.ts"]);
    assert.deepEqual(report.dispatch.dispatchedFiles, ["a.test.ts"]);
  });

  it("a process killed before its final report is interrupted, not passing", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts"],
      invocations: [
        {
          args: ["x", "vitest", "run", "a.test.ts"],
          files: ["a.test.ts"],
          dispatch: DISPATCH.interrupted,
          signal: "SIGKILL",
          evidenceState: EVIDENCE.missing,
        },
      ],
    });

    assert.equal(report.status, "interrupted");
    assert.equal(report.execution.casesPassed, null);
    assert.equal(report.dispatch.invocations[0].signal, "SIGKILL");
  });

  it("a missing framework report fails evidence rather than reporting a clean empty run", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts"],
      invocations: [
        {
          args: [],
          files: ["a.test.ts"],
          dispatch: DISPATCH.completed,
          exitCode: 0,
          evidenceState: EVIDENCE.missing,
          frameworkResults: null,
        },
      ],
    });

    assert.equal(report.evidenceComplete, false);
    assert.equal(report.status, "evidence-incomplete");
    assert.equal(report.execution.casesPassed, null);
  });

  it("one missing report makes the lane total unknown, not smaller", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts", "b.test.ts"],
      invocations: [
        ok(["a.test.ts"], {
          collectedFiles: 1,
          casesPassed: 5,
          casesFailed: 0,
          casesSkipped: 0,
          collectionErrors: 0,
        }),
        {
          args: [],
          files: ["b.test.ts"],
          dispatch: DISPATCH.completed,
          exitCode: 0,
          evidenceState: EVIDENCE.missing,
          frameworkResults: null,
        },
      ],
    });

    // 5 would be a lie by omission: b's cases are unknown, not zero.
    assert.equal(report.execution.casesPassed, null);
    assert.equal(report.evidenceComplete, false);
  });
});

describe("lane report — evidence validation", () => {
  it("rejects a missing report", () => {
    assert.equal(validateFrameworkReport(undefined).state, EVIDENCE.missing);
    assert.equal(validateFrameworkReport("").state, EVIDENCE.missing);
  });

  it("rejects a truncated or unparsable report", () => {
    assert.equal(validateFrameworkReport('{"casesPassed": 4').state, EVIDENCE.unparsable);
    assert.equal(validateFrameworkReport("not json at all").state, EVIDENCE.unparsable);
  });

  it("rejects a report belonging to another run", () => {
    const raw = JSON.stringify({ runId: "run-0", casesPassed: 99 });
    const result = validateFrameworkReport(raw, { expectedRunId: "run-1" });
    assert.equal(result.state, EVIDENCE.stale);
    assert.equal(result.results, null);
  });

  it("accepts a matching report", () => {
    const raw = JSON.stringify({ runId: "run-1", casesPassed: 7 });
    const result = validateFrameworkReport(raw, { expectedRunId: "run-1" });
    assert.equal(result.state, EVIDENCE.present);
    assert.equal(result.results.casesPassed, 7);
  });

  it("treats absent counts as unknown rather than zero", () => {
    const normalized = normalizeFrameworkResults({ casesPassed: 3 });
    assert.equal(normalized.casesPassed, 3);
    assert.equal(normalized.casesFailed, null);
    assert.equal(normalized.collectedFiles, null);
  });
});

describe("lane report — skips and coverage limitations", () => {
  it("retains an explicit skip as a skip, never as a pass", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["w.test.ts"],
      invocations: [
        ok(["w.test.ts"], {
          collectedFiles: 1,
          casesPassed: 10,
          casesFailed: 0,
          casesSkipped: 1,
          collectionErrors: 0,
        }),
      ],
    });

    assert.equal(report.execution.casesSkipped, 1);
    assert.equal(report.execution.casesPassed, 10);
  });

  it("preserves a framework pass while stating separately what was not exercised", () => {
    // The macOS font cases early-return and the framework reports them passing.
    // The reported result is not rewritten; the limitation is recorded beside it.
    const report = buildLaneReport({
      ...base,
      runner: "bun",
      selected: ["fonts.test.ts"],
      invocations: [
        ok(["fonts.test.ts"], {
          collectedFiles: 1,
          casesPassed: 6,
          casesFailed: 0,
          casesSkipped: 0,
          collectionErrors: 0,
        }),
      ],
      coverageLimitations: [
        {
          file: "fonts.test.ts",
          cases: 2,
          reportedAs: "passed",
          limitation:
            "Early-returns when the macOS system font is absent; macOS capture unexercised.",
        },
      ],
    });

    assert.equal(report.execution.casesPassed, 6, "framework result must be preserved as reported");
    assert.equal(report.coverageLimitations.length, 1);
    assert.equal(report.coverageLimitations[0].reportedAs, "passed");
  });
});

describe("lane report — dispatch classification", () => {
  it("separates spawn failure, signal death and ordinary exit", () => {
    assert.equal(classifyDispatch({ error: new Error("ENOENT") }), DISPATCH.spawnFailed);
    assert.equal(classifyDispatch({ signal: "SIGKILL", status: null }), DISPATCH.interrupted);
    assert.equal(classifyDispatch({ status: 1 }), DISPATCH.completed);
    assert.equal(classifyDispatch({ status: 0 }), DISPATCH.completed);
  });
});

describe("lane report — the summary is generated, not maintained in parallel", () => {
  it("prints unknown rather than zero when evidence is incomplete", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts"],
      invocations: [
        { args: [], files: ["a.test.ts"], dispatch: DISPATCH.interrupted, signal: "SIGKILL" },
      ],
    });
    const text = formatLaneReport(report);
    assert.match(text, /cases passed\s+unknown/);
    assert.match(text, /evidence\s+INCOMPLETE/);
  });

  it("lists undispatched files by name in the summary", () => {
    const report = buildLaneReport({
      ...base,
      selected: ["a.test.ts", "b.test.ts"],
      invocations: [
        {
          ...ok(["a.test.ts"], {
            collectedFiles: 1,
            casesPassed: 1,
            casesFailed: 1,
            casesSkipped: 0,
            collectionErrors: 0,
          }),
          exitCode: 1,
        },
        { args: [], files: ["b.test.ts"], dispatch: DISPATCH.notDispatched },
      ],
    });
    assert.match(formatLaneReport(report), /undispatched\s+1\s+\(b\.test\.ts\)/);
  });
});
