import { isAbsolute, relative, resolve, win32 } from "node:path";

export const LANE_USAGE =
  "Usage: node scripts/run-test-lane.mjs <unit|integration> [bun|vitest] [--list] [--] [test-file-or-directory ...]";

/** Parse our own CLI; never silently swallow downstream runner flags. */
export function parseLaneArgs(argv) {
  const [lane, ...rest] = argv;
  if (lane !== "unit" && lane !== "integration") throw new Error(LANE_USAGE);
  const runner = rest[0] === "bun" || rest[0] === "vitest" ? rest.shift() : undefined;
  let list = false;
  let positionalOnly = false;
  const selectors = [];
  for (const arg of rest) {
    if (!positionalOnly && arg === "--list") {
      list = true;
    } else if (!positionalOnly && arg === "--") {
      positionalOnly = true;
    } else if (!arg || arg.startsWith("-")) {
      throw new Error(`Unsupported argument ${JSON.stringify(arg)}. ${LANE_USAGE}`);
    } else {
      selectors.push(arg);
    }
  }
  // A dangling delimiter must not turn an intended focused run into a full run.
  if (positionalOnly && selectors.length === 0)
    throw new Error(`Supply a test file or directory after --. ${LANE_USAGE}`);
  return { lane, runner, list, selectors };
}

function normalizeSelector(selector, producerRoot) {
  let value = selector.replaceAll("\\", "/");
  if (/[\0\r\n]/.test(value)) throw new Error("Test selectors cannot contain control characters.");
  // Accept paths copied from either the repository root or the producer package.
  if (value.startsWith("./")) value = value.slice(2);
  if (value.startsWith("packages/producer/")) value = value.slice("packages/producer/".length);
  if (win32.isAbsolute(value) && !isAbsolute(value))
    throw new Error(`Use a producer-relative path for this platform: ${selector}`);
  const file = relative(producerRoot, resolve(producerRoot, value)).replaceAll("\\", "/");
  if (file === ".." || file.startsWith("../") || isAbsolute(file))
    throw new Error(`Test selector is outside packages/producer: ${selector}`);
  return file;
}

/** Resolve exact files/directories against the classified inventory, not fuzzy filters. */
export function selectLaneTests(tests, request, producerRoot) {
  const eligible = tests.filter(
    (test) => test.lane === request.lane && (!request.runner || test.runner === request.runner),
  );
  if (!request.selectors.length) {
    if (!eligible.length) throw new Error(`No tests in ${request.lane}/${request.runner || "all"}.`);
    return eligible;
  }
  const selected = new Set();
  for (const selector of request.selectors) {
    const path = normalizeSelector(selector, producerRoot);
    const matches = tests.filter(
      (test) => !path || test.file === path || test.file.startsWith(`${path}/`),
    );
    if (!matches.length)
      throw new Error(
        `No classified test matches ${JSON.stringify(selector)}. Use an exact file or directory, not a glob or substring.`,
      );
    const allowed = matches.filter((test) => eligible.includes(test));
    if (!allowed.length)
      throw new Error(
        `${JSON.stringify(selector)} has no tests in ${request.lane}/${request.runner || "all"}; check the lane and runner.`,
      );
    for (const test of allowed) selected.add(test.file);
  }
  // Preserve discovery order and collapse overlapping/duplicate selections.
  return eligible.filter((test) => selected.has(test.file));
}

/**
 * Vitest positional paths are substring filters, even when they name a file.
 * Use absolute filters and refuse rare path collisions rather than loading an
 * unselected Bun/integration file. Bun gets explicit ./ paths instead.
 */
export function laneInvocations(tests, selected, producerRoot) {
  const vitestFiles = selected.filter((test) => test.runner === "vitest").map((test) => test.file);
  const absolute = (file) => resolve(producerRoot, file).replaceAll("\\", "/");
  const filters = vitestFiles.map(absolute);
  const wanted = new Set(vitestFiles);
  for (const test of tests) {
    const path = absolute(test.file).toLowerCase();
    if (!wanted.has(test.file) && filters.some((filter) => path.includes(filter.toLowerCase())))
      throw new Error(
        `Vitest's filename filters would also select ${test.file}. Refusing to widen this run.`,
      );
  }
  const commands = [];
  if (filters.length)
    commands.push({ files: vitestFiles, args: ["x", "--no-install", "vitest", "run", ...filters] });
  // Bun's mock.module registry is process-global: retain one process per file.
  for (const test of selected.filter((entry) => entry.runner === "bun"))
    commands.push({ files: [test.file], args: ["test", `./${test.file}`] });
  return commands;
}
