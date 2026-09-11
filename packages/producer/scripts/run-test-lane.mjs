// V-Flow EXAIS modification: explicit producer test selection and dispatch evidence (AFM-012).
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { discoverProducerTests, PRODUCER_ROOT } from "./test-classification.mjs";
import { laneInvocations, parseLaneArgs, selectLaneTests } from "./test-lane-selection.mjs";

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

  let remaining = selected.length;
  for (const invocation of invocations) {
    const result = spawn("bun", invocation.args, {
      cwd: producerRoot,
      env: { ...env, HYPERFRAMES_TEST_LANE: request.lane },
      stdio: "inherit",
    });
    if (result.error) {
      log(`[producer:${label}] Runner did not start; ${remaining} selected files not launched.`);
      throw result.error;
    }
    remaining -= invocation.files.length;
    if (result.status !== 0) {
      const status = result.status ?? 1;
      log(
        `[producer:${label}] Runner exited ${status}${result.signal ? ` (${result.signal})` : ""}; ${remaining} selected files not launched.`,
      );
      return status;
    }
  }
  return 0;
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
