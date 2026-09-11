#!/usr/bin/env node
/**
 * Generates a checkpoint summary from recorded execution evidence.
 *
 * This replaces an earlier generator that could turn failures into passes. Its
 * defects are worth naming, because they define the rules here:
 *
 *   - It hard-coded `exitCode: 0` for the acceptance suite. A generator built to
 *     stop hand-entered numbers had a success value typed into it.
 *   - It decided pass/fail by scanning console text for patterns, so an empty
 *     log read as a pass and a log ending `EXIT=7` read as a pass.
 *   - Two of those patterns contained literal backspace bytes where word
 *     boundaries were intended, so `FAIL:` was never matched at all.
 *
 * The rule that prevents all three: **a check passes only if it recorded an
 * exit code and that exit code is 0.** Absent evidence is `unknown`, never
 * `pass`. Console text may add detail; it may never establish success.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

/** Terminal colour codes break numeric parsing; strip before reading anything. */
export function stripAnsi(text) {
  return text.replace(/\[[0-9;]*m/g, "");
}

/**
 * Reads the recorded exit code. Returns null when none was recorded, which is
 * materially different from zero.
 */
export function readExitCode(text) {
  const match = /^EXIT=(-?\d+)\s*$/m.exec(stripAnsi(text));
  return match ? Number(match[1]) : null;
}

/** A verdict derived from evidence, never from prose. */
export function verdictFor(text) {
  if (text === null || text === undefined) return { status: "unknown", reason: "log missing" };
  const stripped = stripAnsi(text).trim();
  if (stripped.length === 0) return { status: "unknown", reason: "log empty" };
  const exitCode = readExitCode(stripped);
  if (exitCode === null) {
    return { status: "unknown", reason: "no exit code recorded", exitCode: null };
  }
  return { status: exitCode === 0 ? "pass" : "fail", exitCode };
}

/**
 * Parses framework totals. Counts are null when absent, and a file reporting
 * failures contributes its failure count rather than being smoothed away.
 */
export function parseTotals(raw) {
  const text = stripAnsi(raw);

  // Bun prints one summary per file.
  const bunFiles = [...text.matchAll(/Ran \d+ tests? across/g)].length;
  if (bunFiles > 0) {
    const sum = (re) => [...text.matchAll(re)].reduce((acc, m) => acc + Number(m[1]), 0);
    return {
      runner: "bun",
      files: bunFiles,
      casesPassed: sum(/^\s*(\d+) pass/gm),
      casesFailed: sum(/^\s*(\d+) fail/gm),
      casesSkipped: sum(/^\s*(\d+) skip/gm),
    };
  }

  // Vitest prints one aggregate. Read the labelled lines, not any "N passed".
  const filesLine = /Test Files\s+(.+)/.exec(text);
  const testsLine = /Tests\s+(.+)/.exec(text);
  const pick = (line, label) => {
    if (!line) return null;
    const m = new RegExp(`(\\d+) ${label}`).exec(line);
    return m ? Number(m[1]) : null;
  };
  if (!filesLine && !testsLine) {
    return { runner: "unknown", files: null, casesPassed: null, casesFailed: null, casesSkipped: null };
  }
  return {
    runner: "vitest",
    // "2 failed | 40 passed (42)" — total files is the parenthesised figure.
    files: (() => {
      const total = filesLine ? /\((\d+)\)/.exec(filesLine[1]) : null;
      return total ? Number(total[1]) : pick(filesLine?.[1], "passed");
    })(),
    casesPassed: pick(testsLine?.[1], "passed"),
    casesFailed: pick(testsLine?.[1], "failed") ?? 0,
    casesSkipped: pick(testsLine?.[1], "skipped") ?? 0,
  };
}

/** Undispatched file count, reported by the lane runner itself. */
export function parseUnlaunched(raw) {
  const match = /(\d+) selected files not launched/.exec(stripAnsi(raw));
  return match ? Number(match[1]) : 0;
}

/**
 * Cross-checks the parsed totals against the recorded exit code.
 *
 * A lane claiming zero failures while exiting non-zero, or failures while
 * exiting zero, is internally inconsistent. Reporting either as a clean result
 * is how a broken run becomes a green summary.
 */
export function consistencyProblems(verdict, totals, unlaunched) {
  const problems = [];
  if (verdict.status === "pass") {
    if ((totals.casesFailed ?? 0) > 0) {
      problems.push(`exit 0 but ${totals.casesFailed} case(s) reported failing`);
    }
    if (unlaunched > 0) problems.push(`exit 0 but ${unlaunched} file(s) never launched`);
  }
  if (verdict.status === "fail" && totals.casesFailed === 0 && unlaunched === 0) {
    problems.push(`exit ${verdict.exitCode} but no failing cases or unlaunched files reported`);
  }
  for (const [key, value] of Object.entries(totals)) {
    if (typeof value === "number" && (value < 0 || !Number.isInteger(value))) {
      problems.push(`${key} is not a non-negative integer: ${value}`);
    }
  }
  return problems;
}

/**
 * Reads a lane's structured report, when the runner wrote one.
 *
 * This is the framework's own account of what executed, validated against
 * dispatch by packages/producer/scripts/framework-report.mjs. It is strictly
 * better evidence than parsing a console summary out of terminal output, so it
 * is preferred wherever it exists; the text parser remains the fallback for
 * checks that are not lanes.
 *
 * `evidenceComplete: false` means the runner could not confirm what ran. That
 * is a problem even when the process exited 0 — a clean exit with unverified
 * execution is precisely the shape this ticket exists to stop being called a
 * pass.
 */
export function readLaneReport(directory, name) {
  const path = join(directory, `${name}.report.json`);
  if (!existsSync(path)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { problems: [`lane report is not valid JSON: ${name}.report.json`] };
  }
  const execution = parsed?.execution ?? {};
  const undispatched = parsed?.dispatch?.undispatchedFiles ?? [];
  const problems = [];
  if (parsed?.evidenceComplete !== true) {
    problems.push("lane report does not confirm execution (evidenceComplete is not true)");
  }
  if (parsed?.status && parsed.status !== "complete") {
    problems.push(`lane report status is ${parsed.status}`);
  }
  if (undispatched.length > 0) {
    problems.push(`${undispatched.length} file(s) never launched: ${undispatched.join(", ")}`);
  }
  return {
    source: "framework",
    runner: parsed?.runner ?? "unknown",
    files: execution.collectedFiles ?? null,
    casesPassed: execution.casesPassed ?? null,
    casesFailed: execution.casesFailed ?? null,
    casesSkipped: execution.casesSkipped ?? null,
    collectionErrors: execution.collectionErrors ?? null,
    unlaunched: undispatched.length,
    problems,
  };
}

export function summarise(directory, { partitions = [], suites = [] } = {}) {
  const read = (name) => {
    const path = join(directory, `${name}.log`);
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  };

  const result = { generatedBy: "tools/evidence/checkpoint-summary.mjs", partitions: {}, suites: {}, rootChecks: {}, problems: [] };

  for (const name of partitions) {
    const raw = read(name);
    const verdict = verdictFor(raw);
    const lane = readLaneReport(directory, name);

    // The framework's own validated record wins over console text.
    const totals = lane
      ? lane
      : raw
        ? parseTotals(raw)
        : { runner: "unknown", files: null, casesPassed: null, casesFailed: null, casesSkipped: null };
    const unlaunched = lane ? lane.unlaunched : raw ? parseUnlaunched(raw) : 0;

    const problems = raw ? consistencyProblems(verdict, totals, unlaunched) : ["log missing"];
    if (lane?.problems) problems.push(...lane.problems);
    if (!lane) {
      // Every partition is a lane, and the lane runner is told where to write
      // its report. A missing one means that wiring broke — which is how four
      // fully green lanes came to be summarised with every Vitest total
      // unknown. Falling back to terminal text is the safe behaviour; doing it
      // silently is not.
      problems.push("no lane report; totals were parsed from terminal text");
    }
    const source = lane ? "framework" : "console-text";

    result.partitions[name] = { ...verdict, ...totals, unlaunched, source, problems };
    result.problems.push(...problems.map((p) => `${name}: ${p}`));
  }

  for (const name of suites) {
    const raw = read(name);
    const verdict = verdictFor(raw);
    const totals = raw ? parseTotals(raw) : {};
    result.suites[name] = { ...verdict, ...totals };
    if (verdict.status !== "pass") result.problems.push(`${name}: ${verdict.status} (${verdict.reason ?? verdict.exitCode})`);
  }

  const known = new Set([...partitions, ...suites].map((n) => `${n}.log`));
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".log"))) {
    if (known.has(file)) continue;
    const name = basename(file, ".log");
    const verdict = verdictFor(readFileSync(join(directory, file), "utf8"));
    result.rootChecks[name] = verdict;
    if (verdict.status !== "pass") {
      result.problems.push(`${name}: ${verdict.status}${verdict.reason ? ` (${verdict.reason})` : ` (exit ${verdict.exitCode})`}`);
    }
  }

  const totals = Object.values(result.partitions);
  const anyUnknown = totals.some((p) => p.casesPassed === null);
  result.totals = {
    casesPassed: anyUnknown ? null : totals.reduce((a, p) => a + p.casesPassed, 0),
    casesFailed: anyUnknown ? null : totals.reduce((a, p) => a + (p.casesFailed ?? 0), 0),
    casesSkipped: anyUnknown ? null : totals.reduce((a, p) => a + (p.casesSkipped ?? 0), 0),
    unlaunched: totals.reduce((a, p) => a + p.unlaunched, 0),
  };
  result.trustworthy = result.problems.length === 0;
  return result;
}

if (process.argv[1] && process.argv[1].endsWith("checkpoint-summary.mjs")) {
  const directory = process.argv[2];
  if (!directory) {
    console.error("Usage: node tools/evidence/checkpoint-summary.mjs <evidence-directory>");
    process.exitCode = 2;
  } else {
    const summary = summarise(directory, {
      partitions: ["unit-bun", "unit-vitest", "integration-bun", "integration-vitest"],
      suites: ["acceptance"],
    });
    writeFileSync(join(directory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    for (const [name, p] of Object.entries(summary.partitions)) {
      console.log(`  ${name.padEnd(20)} ${p.status.padEnd(8)} exit=${p.exitCode} files=${p.files} pass=${p.casesPassed} fail=${p.casesFailed} skip=${p.casesSkipped} unlaunched=${p.unlaunched} via=${p.source}`);
    }
    for (const [name, v] of Object.entries(summary.rootChecks)) {
      console.log(`  ${name.padEnd(28)} ${v.status}${v.reason ? ` (${v.reason})` : ""}`);
    }
    if (summary.problems.length > 0) {
      console.error(`\n${summary.problems.length} problem(s):`);
      for (const p of summary.problems) console.error(`  ${p}`);
    }
    console.log(`\n${summary.trustworthy ? "PASS" : "NOT TRUSTWORTHY"}`);
    process.exitCode = summary.trustworthy ? 0 : 1;
  }
}
