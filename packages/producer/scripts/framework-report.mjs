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
 * cannot be read as this one's evidence. A unique path stops a file being
 * *reused*; it says nothing about what the file *contains*, so the contents are
 * reconciled against the invocation as well. External review showed why that
 * matters: a JUnit document truncated mid-element still declared `tests="8"`
 * and was accepted as eight passing cases, and a Vitest report covering one of
 * two dispatched files — or naming a file that was never dispatched at all —
 * was accepted because the totals happened to add up.
 *
 * So file identities survive parsing and are compared as sets. A report that
 * covers fewer files than were dispatched is not wrong, but it does not
 * establish the selection ran: those runs keep their results and are marked
 * `incomplete` rather than certified.
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
 * Compares test-file paths that the runner and the wrapper may spell
 * differently — absolute vs relative, `./` prefixed, Windows separators.
 */
export function normalizeTestFile(file) {
  if (typeof file !== "string" || file.length === 0) return null;
  const unix = file.split("\\").join("/").replace(/^\.\//, "");
  // Compared by suffix, so only the trailing path segments need to agree.
  return unix.replace(/^([A-Za-z]:)?\//, "");
}

/** Whether two normalized paths name the same file, allowing either to be deeper. */
function samePath(a, b) {
  if (a === b) return true;
  return a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

/**
 * Minimal XML well-formedness check, enough to reject a truncated document.
 *
 * A regular expression can read attributes out of text that is not a document
 * at all. `<testsuites tests="8"><testsuite file="a.test.ts">` has no closing
 * tags and no cases, yet every attribute the old parser wanted was present, so
 * it reported eight passing cases from a file that recorded none. This walks
 * the tags and requires them to balance.
 */
export function isWellFormedXml(xml) {
  const stack = [];
  const tag = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let match;
  let consumed = 0;
  const withoutProlog = xml.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  while ((match = tag.exec(withoutProlog)) !== null) {
    const [whole, closing, name, , selfClosing] = match;
    consumed += whole.length;
    if (closing === "/") {
      if (stack.pop() !== name) return false;
    } else if (selfClosing !== "/") {
      stack.push(name);
    }
  }
  if (stack.length > 0) return false;

  // Text outside any element is fine, but a document with no elements at all,
  // or one whose remaining text contains an unclosed "<", is not usable.
  if (consumed === 0) return false;
  const outside = withoutProlog.replace(tag, "");
  return !outside.includes("<");
}

/**
 * Reads Bun's JUnit output.
 *
 * Bun nests `testsuite` elements — one per file, then one per describe block —
 * so counting suite elements, or distinct suite `name` attributes, overcounts
 * files badly. The root `testsuites` element carries exact totals, and file
 * identity lives in the `file` attribute rather than `name`.
 *
 * Declared totals are cross-checked against the `testcase` elements actually
 * present, because a declaration is a claim and the elements are the evidence.
 */
export function parseJunit(xml) {
  if (!isWellFormedXml(xml)) return null;

  const root = /<testsuites([^>]*)>/.exec(xml);
  const cases = (xml.match(/<testcase/g) ?? []).length;
  if (!root && cases === 0) return null;

  const attrNum = (tag, name) => {
    const match = new RegExp(`${name}="([0-9]+)"`).exec(tag ?? "");
    return match ? Number(match[1]) : null;
  };

  const files = [
    ...new Set(
      [...xml.matchAll(/<testsuite[^>]*file="([^"]+)"/g)]
        .map((m) => normalizeTestFile(m[1]))
        .filter(Boolean),
    ),
  ];

  const declared = attrNum(root ? root[1] : null, "tests");
  const total = declared ?? cases;
  // A document declaring more cases than it contains is truncated or wrong;
  // either way its totals cannot be trusted.
  if (declared !== null && declared !== cases) return null;

  const failures =
    attrNum(root ? root[1] : null, "failures") ?? (xml.match(/<failure/g) ?? []).length;
  const skipped =
    attrNum(root ? root[1] : null, "skipped") ?? (xml.match(/<skipped/g) ?? []).length;

  return {
    files,
    collectedFiles: files.length || null,
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

  const files = [
    ...new Set(results.map((r) => normalizeTestFile(r.name ?? r.testFilePath)).filter(Boolean)),
  ];

  return {
    files,
    // `testResults` has one entry per FILE. `numTotalTestSuites` counts
    // describe blocks, so a single file with three describes reports 3 — which
    // then reads as covering more files than were dispatched. Neither framework
    // means "file" when it says "suite".
    collectedFiles: files.length || results.length || num(json.numTotalTestSuites),
    casesPassed: passed,
    casesFailed: failed,
    casesSkipped: (num(json.numPendingTests) ?? 0) + (num(json.numTodoTests) ?? 0),
    collectionErrors,
  };
}

/**
 * Reconciles a report against the invocation it is supposed to describe.
 *
 * Structural acceptance is not enough, and neither is matching arithmetic. The
 * report must describe *these* files: a set of totals that happens to add up
 * says nothing about whether the dispatched selection is what ran.
 */
export function validateAgainstInvocation(results, { files, exitCode }) {
  if (!results) {
    return { state: EVIDENCE.missing, results: null, problems: ["no report produced"] };
  }

  const problems = [];
  for (const [key, value] of Object.entries(results)) {
    if (key === "files" || value === null) continue;
    if (!Number.isInteger(value) || value < 0) {
      problems.push(`${key} is not a non-negative integer: ${value}`);
    }
  }

  const dispatched = files.map(normalizeTestFile).filter(Boolean);
  const reported = Array.isArray(results.files) ? results.files : [];

  // Files the report names that were never dispatched: the report describes a
  // different run.
  const foreign = reported.filter((r) => !dispatched.some((d) => samePath(r, d)));
  if (foreign.length > 0) {
    problems.push(`report covers file(s) that were not dispatched: ${foreign.join(", ")}`);
  }

  // Files dispatched that the report never mentions. Not necessarily an error —
  // a crashed or interrupted run legitimately covers less — but the results
  // then describe part of the selection, and must not certify all of it.
  const uncovered =
    reported.length > 0 ? dispatched.filter((d) => !reported.some((r) => samePath(r, d))) : [];

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

  if (problems.length > 0) {
    return { state: EVIDENCE.unparsable, results: null, problems };
  }

  if (uncovered.length > 0) {
    // Results are kept: partial evidence is still evidence of what it covers.
    // What it must not do is stand in for the whole selection.
    return {
      state: EVIDENCE.incomplete,
      results,
      problems: [`report does not cover dispatched file(s): ${uncovered.join(", ")}`],
    };
  }

  return { state: EVIDENCE.present, results, problems: [] };
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
    if (!parsed) {
      return {
        state: EVIDENCE.unparsable,
        results: null,
        problems: ["report is not a complete JUnit document, or its totals contradict its cases"],
      };
    }
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
