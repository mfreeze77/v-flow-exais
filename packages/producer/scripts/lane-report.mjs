// V-Flow EXAIS: structured execution reporting for producer test lanes (AFM-012).
/**
 * Records what actually happened during a lane run, from two distinct sources.
 *
 * The distinction this module exists to preserve: **starting one Vitest process
 * with 42 filenames does not prove that 42 files loaded.** Process dispatch is
 * orchestration knowledge the wrapper owns; collected files, completed cases,
 * failures and skips are execution knowledge only the test framework owns.
 * Conflating them lets a crash look like a clean run with zero failures.
 *
 * So when the framework produced no usable report, counts are `null` — unknown —
 * never 0. A missing report is a reporting failure, not a passing run.
 */

/** Bump when the record shape changes in a way a consumer must notice. */
export const REPORT_SCHEMA_VERSION = 1;

/** How a child process attempt ended, from the wrapper's point of view. */
export const DISPATCH = {
  /** The process started and exited on its own. */
  completed: "completed",
  /** The process could not be started at all. */
  spawnFailed: "spawn-failed",
  /** The process started and was killed before it could finish. */
  interrupted: "interrupted",
  /** Never attempted, because an earlier invocation failed. */
  notDispatched: "not-dispatched",
};

/** Why framework results are unavailable or untrustworthy. */
export const EVIDENCE = {
  present: "present",
  missing: "missing",
  unparsable: "unparsable",
  stale: "stale-or-foreign",
};

/**
 * Classifies one child-process outcome.
 *
 * A signal means the process was killed before it could write its final report,
 * which is materially different from exiting non-zero after reporting failures.
 */
export function classifyDispatch(result) {
  if (result?.error) return DISPATCH.spawnFailed;
  if (result?.signal) return DISPATCH.interrupted;
  return DISPATCH.completed;
}

/**
 * Validates a framework report before any number from it is trusted.
 *
 * `expectedRunId` guards against reading a stale file from a previous run: a
 * left-behind report from an earlier, greener run is worse than none.
 */
export function validateFrameworkReport(raw, { expectedRunId } = {}) {
  if (raw === undefined || raw === null || raw === "") {
    return { state: EVIDENCE.missing, results: null };
  }
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { state: EVIDENCE.unparsable, results: null };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { state: EVIDENCE.unparsable, results: null };
  }
  if (expectedRunId && parsed.runId && parsed.runId !== expectedRunId) {
    return { state: EVIDENCE.stale, results: null };
  }
  return { state: EVIDENCE.present, results: parsed };
}

/**
 * Normalises framework results into the counts the report exposes.
 *
 * Every count is `null` when the framework did not report it. A consumer must
 * be able to tell "zero failures" from "we do not know how many there were".
 */
export function normalizeFrameworkResults(results) {
  if (!results) {
    return {
      collectedFiles: null,
      casesPassed: null,
      casesFailed: null,
      casesSkipped: null,
      collectionErrors: null,
    };
  }
  const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    collectedFiles: num(results.collectedFiles),
    casesPassed: num(results.casesPassed),
    casesFailed: num(results.casesFailed),
    casesSkipped: num(results.casesSkipped),
    // A file that fails during import has demonstrated nothing about its cases,
    // so collection errors are counted separately from assertion failures.
    collectionErrors: num(results.collectionErrors),
  };
}

/**
 * Builds the lane record.
 *
 * `undispatched` carries file identities, not just a count: "7 files not
 * launched" is far less useful than knowing which seven.
 */
export function buildLaneReport({
  lane,
  runner,
  command,
  runId,
  revision,
  runtime,
  selected,
  invocations,
  coverageLimitations = [],
}) {
  const dispatched = [];
  const undispatched = [];
  let sawFailure = false;

  for (const invocation of invocations) {
    if (invocation.dispatch === DISPATCH.notDispatched) {
      undispatched.push(...invocation.files);
      continue;
    }
    dispatched.push(...invocation.files);
    if (invocation.dispatch !== DISPATCH.completed || invocation.exitCode !== 0) sawFailure = true;
  }

  const evidence = invocations
    .filter((i) => i.dispatch === DISPATCH.completed)
    .map((i) => i.evidenceState ?? EVIDENCE.missing);
  const evidenceComplete = evidence.length > 0 && evidence.every((e) => e === EVIDENCE.present);

  // Totals are only summed when every dispatched invocation produced a valid
  // report. One missing report makes the lane total unknown, not smaller.
  const totals = evidenceComplete
    ? invocations
        .filter((i) => i.dispatch === DISPATCH.completed)
        .reduce(
          (acc, i) => {
            const r = normalizeFrameworkResults(i.frameworkResults);
            for (const key of Object.keys(acc)) {
              acc[key] = acc[key] === null || r[key] === null ? null : acc[key] + r[key];
            }
            return acc;
          },
          {
            collectedFiles: 0,
            casesPassed: 0,
            casesFailed: 0,
            casesSkipped: 0,
            collectionErrors: 0,
          },
        )
    : normalizeFrameworkResults(null);

  const status = (() => {
    if (invocations.some((i) => i.dispatch === DISPATCH.spawnFailed)) return "spawn-failed";
    if (invocations.some((i) => i.dispatch === DISPATCH.interrupted)) return "interrupted";
    if (undispatched.length > 0) return "incomplete";
    if (!evidenceComplete) return "evidence-incomplete";
    return sawFailure ? "failed" : "complete";
  })();

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    runId,
    revision,
    runtime,
    lane,
    runner: runner ?? "all",
    command,
    status,
    selection: { count: selected.length, files: selected.slice() },
    dispatch: {
      dispatchedFiles: dispatched,
      // Identities, not a count.
      undispatchedFiles: undispatched,
      invocations: invocations.map((i) => ({
        args: i.args,
        files: i.files,
        dispatch: i.dispatch,
        exitCode: i.exitCode ?? null,
        signal: i.signal ?? null,
        evidence: i.evidenceState ?? EVIDENCE.missing,
        error: i.error ?? null,
      })),
    },
    // Framework-confirmed execution. Null means unknown.
    execution: totals,
    evidenceComplete,
    /**
     * Cases the framework reported as passing that did not exercise what their
     * name implies — platform early-returns, for instance. The framework result
     * is preserved as reported; this states separately what was not covered.
     */
    coverageLimitations,
  };
}

/** Human-readable summary, generated from the record rather than kept in parallel. */
export function formatLaneReport(report) {
  const e = report.execution;
  const n = (v) => (v === null ? "unknown" : String(v));
  return [
    `lane            ${report.lane}/${report.runner}`,
    `status          ${report.status}`,
    `selected        ${report.selection.count}`,
    `dispatched      ${report.dispatch.dispatchedFiles.length}`,
    `undispatched    ${report.dispatch.undispatchedFiles.length}` +
      (report.dispatch.undispatchedFiles.length > 0
        ? `  (${report.dispatch.undispatchedFiles.join(", ")})`
        : ""),
    `collected files ${n(e.collectedFiles)}`,
    `cases passed    ${n(e.casesPassed)}`,
    `cases failed    ${n(e.casesFailed)}`,
    `cases skipped   ${n(e.casesSkipped)}`,
    `collection errs ${n(e.collectionErrors)}`,
    `evidence        ${report.evidenceComplete ? "complete" : "INCOMPLETE"}`,
  ].join("\n");
}
