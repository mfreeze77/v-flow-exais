import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runTestLane } from "./run-test-lane.mjs";
import { laneInvocations, parseLaneArgs, selectLaneTests } from "./test-lane-selection.mjs";

const scripts = dirname(fileURLToPath(import.meta.url));
const root = resolve(scripts, "..");
// Synthetic inventory: these are dispatch/selection tests, not producer-test passes.
const inventory = [
  { file: "src/logger.test.ts", runner: "vitest", lane: "unit" },
  { file: "src/services/font retry.test.ts", runner: "bun", lane: "unit" },
  { file: "src/services/renderOrchestrator.test.ts", runner: "vitest", lane: "unit" },
  { file: "src/services/renderPlan.test.ts", runner: "bun", lane: "unit" },
  { file: "src/services/fileServer.test.ts", runner: "vitest", lane: "integration" },
  { file: "src/servicesExtra/unrelated.test.ts", runner: "bun", lane: "unit" },
];
const target = "src/services/renderOrchestrator.test.ts";
const select = (...args) => selectLaneTests(inventory, parseLaneArgs(args), root);
const files = (tests) => tests.map((test) => test.file);

function dispatch(argv, results = []) {
  const calls = [];
  const logs = [];
  const env = { RETAIN_ME: "yes", HYPERFRAMES_TEST_LANE: "stale" };
  const code = runTestLane(argv, {
    discover: () => inventory,
    producerRoot: root,
    spawn: (...args) => {
      calls.push(args);
      return results.shift() || { status: 0 };
    },
    env,
    log: (line) => logs.push(line),
  });
  return { calls, logs, code, env };
}

describe("producer lane arguments", () => {
  it("keeps the no-selector unit/integration interface", () => {
    assert.deepEqual(parseLaneArgs(["unit"]), {
      lane: "unit",
      runner: undefined,
      list: false,
      selectors: [],
    });
    assert.equal(parseLaneArgs(["integration", "bun"]).runner, "bun");
  });
  it("parses file selection without requiring a runner", () => {
    assert.deepEqual(parseLaneArgs(["unit", target]).selectors, [target]);
  });
  it("accepts a separator and list-only planning", () => {
    assert.deepEqual(parseLaneArgs(["unit", "vitest", "--list", "--", target]), {
      lane: "unit",
      runner: "vitest",
      list: true,
      selectors: [target],
    });
  });
  for (const argv of [
    [],
    ["browser"],
    ["unit", "--watch"],
    ["unit", "vitest", "--"],
    ["unit", ""],
    ["unit", "--", "--list"],
  ]) {
    it(`rejects malformed arguments ${JSON.stringify(argv)}`, () => {
      assert.throws(() => parseLaneArgs(argv), /Usage:/);
    });
  }
});

describe("classified file selection", () => {
  it("selects the requested file instead of the full Vitest lane (original regression)", () => {
    assert.deepEqual(files(select("unit", "vitest", target)), [target]);
  });
  it("retains both full-lane and runner-specific defaults", () => {
    assert.equal(select("unit").length, 5);
    assert.deepEqual(files(select("unit", "vitest")), ["src/logger.test.ts", target]);
    assert.deepEqual(files(select("integration")), ["src/services/fileServer.test.ts"]);
  });
  it("intersects directory selection with the selected lane and runner", () => {
    assert.deepEqual(files(select("unit", "src/services")), [
      inventory[1].file,
      target,
      inventory[3].file,
    ]);
    assert.deepEqual(files(select("unit", "vitest", "src/services/")), [target]);
  });
  it("deduplicates overlapping selectors without changing inventory order", () => {
    assert.deepEqual(
      files(select("unit", "vitest", target, "src/logger.test.ts", target, "src/services")),
      ["src/logger.test.ts", target],
    );
  });
  it("accepts package-relative, repository-relative, absolute and backslash paths", () => {
    for (const selector of [
      `./${target}`,
      `packages/producer/${target}`,
      `./packages/producer/${target}`,
      target.replaceAll("/", "\\"),
      resolve(root, target),
    ])
      assert.deepEqual(files(select("unit", "vitest", selector)), [target]);
  });
  it("accepts paths containing spaces as one argument", () => {
    assert.deepEqual(files(select("unit", "bun", inventory[1].file)), [inventory[1].file]);
  });
  it("rejects missing, abbreviated and glob selectors rather than falling back", () => {
    for (const selector of ["src/missing.test.ts", "renderOrchestrator", "src/*.test.ts", "jest"])
      assert.throws(() => select("unit", selector), /No classified test matches/);
  });
  it("rejects one invalid selector even if another selector matches", () => {
    assert.throws(
      () => select("unit", target, "src/missing.test.ts"),
      /No classified test matches/,
    );
  });
  it("rejects wrong-lane and wrong-runner files", () => {
    assert.throws(() => select("unit", "src/services/fileServer.test.ts"), /no tests in unit/);
    assert.throws(() => select("unit", "bun", target), /no tests in unit\/bun/);
  });
  it("rejects paths outside the producer package and control characters", () => {
    assert.throws(() => select("unit", "../core/src/a.test.ts"), /outside packages\/producer/);
    assert.throws(() => select("unit", "src/bad\nname.test.ts"), /control characters/);
    assert.throws(() => select("unit", "src/bad\0name.test.ts"), /control characters/);
  });
  it("fails rather than reports green when the requested lane is empty", () => {
    assert.throws(() => select("integration", "bun"), /No tests in integration\/bun/);
  });
  it("does not mutate the inventory", () => {
    const before = structuredClone(inventory);
    select("unit", target);
    assert.deepEqual(inventory, before);
  });
});

describe("runner invocation contract", () => {
  it("uses absolute Vitest filters and prohibits automatic dependency installation", () => {
    const [command] = laneInvocations(inventory, [inventory[2]], root);
    assert.deepEqual(command.args, [
      "x",
      "--no-install",
      "vitest",
      "run",
      resolve(root, target).replaceAll("\\", "/"),
    ]);
  });
  it("preserves a fresh Bun process and explicit ./ file path for each file", () => {
    const { calls, code } = dispatch(["unit", "bun", "src/services"]);
    assert.equal(code, 0);
    assert.deepEqual(
      calls.map((call) => call[1]),
      [
        ["test", `./${inventory[1].file}`],
        ["test", `./${inventory[3].file}`],
      ],
    );
  });
  it("refuses a Vitest substring collision with any unselected classified file", () => {
    for (const collision of [`${target}.extra.test.ts`, target.toUpperCase()]) {
      const tests = [...inventory, { file: collision, runner: "bun", lane: "integration" }];
      assert.throws(() => laneInvocations(tests, [inventory[2]], root), /Refusing to widen/);
    }
  });
  it("lists the selected files without starting a process", () => {
    const { calls, logs, code } = dispatch(["unit", "vitest", "--list", target]);
    assert.equal(code, 0);
    assert.equal(calls.length, 0);
    assert.match(logs.join("\n"), /Selected 1 test files \(list only\)/);
    assert.match(logs.join("\n"), /renderOrchestrator/);
    assert.doesNotMatch(logs.join("\n"), /logger/);
  });
  it("uses the package cwd, preserves environment and overrides only the lane", () => {
    const { calls, env } = dispatch(["integration", "vitest"]);
    assert.equal(calls[0][0], "bun");
    assert.equal(calls[0][2].cwd, root);
    assert.deepEqual(calls[0][2].env, { RETAIN_ME: "yes", HYPERFRAMES_TEST_LANE: "integration" });
    assert.equal(calls[0][2].stdio, "inherit");
    assert.equal(calls[0][2].shell, undefined);
    assert.equal(env.HYPERFRAMES_TEST_LANE, "stale");
  });
  it("stops after a Vitest failure and reports unlaunched Bun files", () => {
    const { calls, logs, code } = dispatch(["unit"], [{ status: 23 }]);
    assert.equal(code, 23);
    assert.equal(calls.length, 1);
    assert.match(logs.at(-1), /3 selected files not launched/);
  });
  it("stops after a Bun failure without executing subsequent files", () => {
    const { calls, logs, code } = dispatch(["unit", "bun"], [{ status: 0 }, { status: 9 }]);
    assert.equal(code, 9);
    assert.equal(calls.length, 2);
    assert.match(logs.at(-1), /1 selected files not launched/);
  });
  it("treats a signalled runner as failure", () => {
    const { code, logs } = dispatch(["unit"], [{ status: null, signal: "SIGTERM" }]);
    assert.equal(code, 1);
    assert.match(logs.at(-1), /SIGTERM/);
  });
  it("propagates spawn errors and does not claim the failed launch executed files", () => {
    const error = new Error("spawn bun ENOENT");
    const logs = [];
    assert.throws(
      () =>
        runTestLane(["unit"], {
          discover: () => inventory,
          producerRoot: root,
          spawn: () => ({ error, status: null }),
          log: (line) => logs.push(line),
        }),
      (thrown) => thrown === error,
    );
    assert.match(logs.at(-1), /5 selected files not launched/);
  });
  it("validates every selector before spawning even one child", () => {
    let spawned = false;
    assert.throws(
      () =>
        runTestLane(["unit", target, "src/missing.test.ts"], {
          discover: () => inventory,
          producerRoot: root,
          spawn: () => {
            spawned = true;
            return { status: 0 };
          },
          log: () => {},
        }),
      /No classified test matches/,
    );
    assert.equal(spawned, false);
  });
});

/** Execute the real CLI in a separate Node process with a recorded child boundary.
 * The classified inventory and child runners are fixtures, not live Bun/Vitest.
 */
function cliFixture(argv, status = 0, symlink = false) {
  const fixture = mkdtempSync(join(tmpdir(), "vflow lane fixture "));
  try {
    const producer = join(fixture, "packages", "producer");
    const directory = join(producer, "scripts");
    mkdirSync(directory, { recursive: true });
    for (const file of ["run-test-lane.mjs", "test-lane-selection.mjs"])
      cpSync(join(scripts, file), join(directory, file));
    writeFileSync(
      join(directory, "test-classification.mjs"),
      `
      export const PRODUCER_ROOT = ${JSON.stringify(producer)};
      export const discoverProducerTests = () => ${JSON.stringify(inventory)};
    `,
    );
    const record = join(fixture, "children.jsonl");
    const preload = join(fixture, "record-children.mjs");
    writeFileSync(
      preload,
      `
      import childProcess from "node:child_process";
      import { appendFileSync } from "node:fs";
      import { syncBuiltinESMExports } from "node:module";
      childProcess.spawnSync = (command, args, options) => {
        appendFileSync(${JSON.stringify(record)}, JSON.stringify({ command, args, cwd: options.cwd, lane: options.env.HYPERFRAMES_TEST_LANE }) + "\\n");
        return { status: ${status} };
      };
      syncBuiltinESMExports();
    `,
    );
    let entry = join(directory, "run-test-lane.mjs");
    if (symlink) {
      const alias = join(fixture, "lane entry.mjs");
      symlinkSync(entry, alias);
      entry = alias;
    }
    const result = spawnSync(process.execPath, ["--import", preload, entry, ...argv], {
      cwd: fixture,
      encoding: "utf8",
      timeout: 15_000,
    });
    if (result.error) throw result.error;
    const calls = existsSync(record)
      ? readFileSync(record, "utf8").trim().split("\n").map(JSON.parse)
      : [];
    return { ...result, calls, producer };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe("CLI process wiring", () => {
  it("passes exactly one selected file through real process.argv from an unrelated cwd", () => {
    const result = cliFixture(["unit", "vitest", target]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.calls[0].args, [
      "x",
      "--no-install",
      "vitest",
      "run",
      resolve(result.producer, target).replaceAll("\\", "/"),
    ]);
    assert.equal(result.calls[0].cwd, result.producer);
  });
  it("executes a symlinked entry rather than exiting successfully without tests", () => {
    const result = cliFixture(["unit", "vitest", target], 0, true);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.calls.length, 1);
  });
  it("exits nonzero for a typo without launching any runner", () => {
    const result = cliFixture(["unit", "vitest", "src/not-a-test.test.ts"]);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 0);
    assert.match(result.stderr, /No classified test matches/);
  });
  it("list-only CLI does not launch children", () => {
    const result = cliFixture(["unit", "--list", target]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.calls.length, 0);
    assert.match(result.stdout, /list only/);
  });
  it("preserves the failing child exit status at the CLI boundary", () => {
    const result = cliFixture(["unit"], 17);
    assert.equal(result.status, 17);
    assert.equal(result.calls.length, 1);
    assert.match(result.stdout, /3 selected files not launched/);
  });
});

it("runs the new regressions from the existing classification script", () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.match(
    manifest.scripts["test:classification"],
    /node --test scripts\/test-classification\.test\.mjs scripts\/run-test-lane\.test\.mjs && node scripts\/check-test-classification\.mjs/,
  );
});
