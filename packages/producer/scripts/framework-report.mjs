// V-Flow EXAIS: read real Bun/Vitest reports back into the lane record (AFM-012).
/**
 * Turns a test framework's own report into validated execution facts.
 *
 * Without this the lane reporter had a correct data model and no data: every
 * real invocation recorded `frameworkResults: null`, so no actual run could
 * produce framework-confirmed totals. Recording dispatch separately from
 * execution is right; leaving execution permanently unknown is not closure.
 *
 * Identity is bound before the child starts — each invocation writes to its own
 * path under a run-scoped directory — so a stale report from an earlier run
 * cannot be read as this one's evidence.
 */

import { existsSync, readFileSync } from "node:fs";

import { EVIDENCE } from "./lane-report.mjs";

/** Reporter flags for each runner, in the pinned versions. */
export function reporterArgs(runner, outfile) {
  if (runner === "bun") return ["--reporter=junit", `--reporter-outfile=${outfile}`];
  if (runner === "vitest") return ["--reporter=json", `--outputFile=${outfile}`];
  return [];
}

/**
 * Reads Bun's JUnit output.
 *
 * Bun nests `testsuite` elements — one per file, then one per describe block —
 * so counting suite elements, or distinct suite `name` attributes, overcounts
 * files badly. The root `testsuites` element carries exact totals, and file
 * identity lives in the `file` attribute rather than `name`.
 */
export function parseJunit(xml) {
  const root = /<testsuites([^>]*)>/.exec(xml);
  const caseCount = (xml.match(/<testcase/g) ?? []).length;
  if (!root && caseCount === 0) return null;

  const attrNum = (tag, name) => {
    const match = new RegExp(`${name}="([0-9]+)"`).exec(tag ?? "");
    return match ? Number(match[1]) : null;
  };

  // Distinct source files, from the attribute that actually names one.
  const files = new Set([...xml.matchAll(/<testsuite[^>]*file="([^"]+)"/g)].map((m) => m[1]));

  const total = attrNum(root ? root[1] : null, "tests") ?? caseCount;
  const failures =
    attrNum(root ? root[1] : null, "failures") ?? (xml.match(/<failure/g) ?? []).length;
  const skipped =
    attrNum(root ? root[1] : null, "skipped") ?? (xml.match(/<skipped/g) ?? []).length;

  return {
    collectedFiles: files.size || null,
    casesPassed: total - failures - skipped,
    casesFailed: failures,
    casesSkipped: skipped,
    // JUnit does not distinguish a collection error from an assertion failure,
    // so this stays null rather than being guessed at.
    collectionErrors: null,
  };
}

/** Reads Vitest's JSON reporter output. */
export function parseVitestJson(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const results = Array.isArray(json.testResults) ? json.testResults : [];

  // A file that failed with no assertions never got far enough to run its
  // cases, which is a collection failure rather than a failing assertion.
  const collectionErrors = results.filter(
    (r) =>
      r.status === "failed" && Array.isArray(r.assertionResults) && r.assertionResults.length === 0,
  ).length;

  const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

  const passed = num(json.numPassedTests);
  const failed = num(json.numFailedTests);
  if (passed === null && failed === null) return null;

  return {
    // `testResults` has one entry per FILE. `numTotalTestSuites` counts
    // describe blocks, so a single file with three describes reports 3 — which
    // then reads as covering more files than were dispatched. Neither framework
    // means "file" when it says "suite".
    collectedFiles: results.length || num(json.numTotalTestSuites),
    casesPassed: passed,
    casesFailed: failed,
    casesSkipped: (num(json.numPendingTests) ?? 0) + (num(json.numTodoTests) ?? 0),
    collectionErrors,
  };
}

/**
 * Validates a report against the invocation it is supposed to describe.
 *
 * Structural acceptance is not enough. A report covering more files than were
 * dispatched, or carrying counts that contradict the process outcome, is
 * inconsistent evidence and must not be summed into a total.
 */
export function validateAgainstInvocation(results, { files, exitCode }) {
  if (!results) {
    return { state: EVIDENCE.missing, results: null, problems: ["no report produced"] };
  }

  const problems = [];
  for (const [key, value] of Object.entries(results)) {
    if (value === null) continue;
    if (!Number.isInteger(value) || value < 0) {
      problems.push(`${key} is not a non-negative integer: ${value}`);
    }
  }

  if (typeof results.collectedFiles === "number" && results.collectedFiles > files.length) {
    problems.push(
      `report covers ${results.collectedFiles} files but ${files.length} were dispatched`,
    );
  }
  if (exitCode === 0 && (results.casesFailed ?? 0) > 0) {
    problems.push(`exit 0 but the report lists ${results.casesFailed} failing case(s)`);
  }
  if (exitCode !== 0 && results.casesFailed === 0 && (results.collectionErrors ?? 0) === 0) {
    problems.push(`exit ${exitCode} but the report lists no failures`);
  }

  return {
    state: problems.length > 0 ? EVIDENCE.unparsable : EVIDENCE.present,
    results: problems.length > 0 ? null : results,
    problems,
  };
}

/**
 * Reads the report an invocation was told to write.
 *
 * A missing file is `missing`, never an empty successful run — the distinction
 * that keeps a crashed child from looking like a clean pass.
 */
export function readInvocationReport(outfile, runner, invocation) {
  if (!existsSync(outfile)) {
    return { state: EVIDENCE.missing, results: null, problems: ["report file was not written"] };
  }

  let raw;
  try {
    raw = readFileSync(outfile, "utf8");
  } catch (error) {
    return { state: EVIDENCE.missing, results: null, problems: [`unreadable: ${String(error)}`] };
  }
  if (raw.trim().length === 0) {
    return { state: EVIDENCE.unparsable, results: null, problems: ["report file is empty"] };
  }

  let parsed = null;
  if (runner === "bun") {
    parsed = parseJunit(raw);
  } else {
    try {
      parsed = parseVitestJson(JSON.parse(raw));
    } catch {
      return { state: EVIDENCE.unparsable, results: null, problems: ["report is not valid JSON"] };
    }
  }
  if (!parsed) {
    return {
      state: EVIDENCE.unparsable,
      results: null,
      problems: ["report has no recognisable results"],
    };
  }
  return validateAgainstInvocation(parsed, invocation);
}
