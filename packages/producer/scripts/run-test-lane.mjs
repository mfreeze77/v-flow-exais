// V-Flow EXAIS modification: explicit producer test selection and dispatch evidence (AFM-012).
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverProducerTests, PRODUCER_ROOT } from "./test-classification.mjs";
import { laneInvocations, parseLaneArgs, selectLaneTests } from "./test-lane-selection.mjs";
import { buildLaneReport, classifyDispatch, DISPATCH, EVIDENCE } from "./lane-report.mjs";

/** Dependencies are injectable for runner-contract tests, not product/render evidence. */
export function runTestLane(
  argv,
  {
    discover = discoverProducerTests,
    producerRoot = PRODUCER_ROOT,
    spawn = spawnSync,
    env = process.env,
    log = console.log,
  } = {},
) {
  const request = parseLaneArgs(argv);
  const tests = discover();
  const selected = selectLaneTests(tests, request, producerRoot);
  const invocations = laneInvocations(tests, selected, producerRoot);
  const label = `${request.lane}/${request.runner || "all"}`;
  log(
    `[producer:${label}] Selected ${selected.length} test files${request.list ? " (list only)" : ""}.`,
  );
  for (const test of selected) log(`  ${test.runner} ${test.file}`);
  if (request.list) return 0;

  // Dispatch outcomes are recorded as they happen. Reconstructing them from
  // console output afterwards is how a derived count ends up contradicting what
  // the runner actually did.
  const attempts = [];
  const record = (invocation, dispatch, result) =>
    attempts.push({
      args: invocation.args,
      files: invocation.files,
      dispatch,
      exitCode: result?.status ?? null,
      signal: result?.signal ?? null,
      error: result?.error ? String(result.error.message ?? result.error) : null,
      // The wrapper cannot confirm which files a framework actually collected.
      // Leaving this absent keeps "dispatched" from masquerading as "executed".
      evidenceState: EVIDENCE.missing,
      frameworkResults: null,
    });

  let remaining = selected.length;
  let exitStatus = 0;
  for (const [index, invocation] of invocations.entries()) {
    const result = spawn("bun", invocation.args, {
      cwd: producerRoot,
      env: { ...env, HYPERFRAMES_TEST_LANE: request.lane },
      stdio: "inherit",
    });

    if (result.error) {
      record(invocation, DISPATCH.spawnFailed, result);
      for (const skipped of invocations.slice(index + 1)) {
        record(skipped, DISPATCH.notDispatched, null);
      }
      log(`[producer:${label}] Runner did not start; ${remaining} selected files not launched.`);
      emitReport(attempts);
      throw result.error;
    }

    record(invocation, classifyDispatch(result), result);
    remaining -= invocation.files.length;

    if (result.status !== 0 || result.signal) {
      const status = result.status ?? 1;
      for (const skipped of invocations.slice(index + 1)) {
        record(skipped, DISPATCH.notDispatched, null);
      }
      log(
        `[producer:${label}] Runner exited ${status}${result.signal ? ` (${result.signal})` : ""}; ${remaining} selected files not launched.`,
      );
      exitStatus = status;
      break;
    }
  }

  emitReport(attempts);
  return exitStatus;

  /** Writes the structured record when a destination is configured. */
  function emitReport(invocationRecords) {
    const destination = env.VFLOW_LANE_REPORT;
    if (!destination) return;
    const report = buildLaneReport({
      lane: request.lane,
      runner: request.runner,
      command: `bun run test:${request.lane}:${request.runner ?? "all"}`,
      runId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      revision: readRevision(producerRoot),
      runtime: { node: process.version, bun: env.BUN_VERSION ?? null },
      selected: selected.map((test) => test.file),
      invocations: invocationRecords,
    });
    try {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      log(`[producer:${label}] Wrote execution report to ${destination}`);
    } catch (error) {
      // Failing to write evidence must be visible, but must not convert a
      // passing lane into a failure or vice versa.
      log(`[producer:${label}] Could not write execution report: ${String(error)}`);
    }
  }
}

/** Records the revision, or a marker when the tree is dirty or unknown. */
function readRevision(cwd) {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
  if (head.status !== 0) return "unknown";
  const sha = head.stdout.trim();
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" });
  const isDirty = dirty.status === 0 && dirty.stdout.trim().length > 0;
  return isDirty ? `${sha}-dirty` : sha;
}

// Importing the module for tests must not discover or execute the product suite.
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = runTestLane(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
