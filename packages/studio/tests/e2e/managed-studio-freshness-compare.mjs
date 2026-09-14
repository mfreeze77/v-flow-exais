/** Eight diagnostic observations through the ORIGINAL editing harness.
 * Four explicitly authorized new fixtures, each followed by read-only reuse.
 * No product mutation after import, no export, no claim that a warm arm repairs startup.
 */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runStartupWorker } from "./managed-startup-process.mjs";
import {
  freshnessPlan,
  parseFreshnessCli,
  freshnessHarnessArgs,
  validateFreshnessTrial,
  summarizeFreshness,
  freshnessExit,
} from "./managed-freshness-contract.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
const HARNESS_FILES = [
  "managed-studio.mjs",
  "managed-studio-probe.mjs",
  "managed-studio-diagnostics.mjs",
  "managed-freshness-mode.mjs",
  "managed-startup-probe.mjs",
];
const INPUT_FILES = [
  ...HARNESS_FILES,
  "managed-studio-freshness-compare.mjs",
  "managed-freshness-contract.mjs",
  "managed-startup-process.mjs",
];
function git(args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", timeout: 30_000 }).trim();
}
function fingerprint() {
  if (git(["diff", "--name-only"]) || git(["diff", "--cached", "--name-only"]))
    throw new Error("Freeze the source in a local commit before running; tracked changes exist.");
  // New test files must also belong to the source checkpoint, not silently vary as untracked code.
  for (const name of INPUT_FILES)
    git(["ls-files", "--error-unmatch", `packages/studio/tests/e2e/${name}`]);
  const inputs = Object.fromEntries(
    INPUT_FILES.map((name) => [name, hash(readFileSync(join(here, name)))]),
  );
  return {
    commit: git(["rev-parse", "HEAD"]),
    tree: git(["rev-parse", "HEAD^{tree}"]),
    inputs,
    inputHash: hash(JSON.stringify(inputs)),
    harnessHashes: Object.fromEntries(HARNESS_FILES.map((name) => [name, inputs[name]])),
  };
}
function sameSource(expected) {
  const current = fingerprint();
  if (
    current.commit !== expected.commit ||
    current.tree !== expected.tree ||
    current.inputHash !== expected.inputHash
  )
    throw new Error("Source changed during the comparison. No mixed-tree result is valid.");
  return current;
}

async function worker(configPath) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  sameSource(config.source);
  const harness = join(here, "managed-studio.mjs");
  if (existsSync(config.harnessOutput)) throw new Error("The harness output must be NEW.");
  process.argv = [process.execPath, harness, ...freshnessHarnessArgs(config)];
  // The actual original executable creates the browser, installs every observer,
  // imports/reads the fixture, navigates and waits. This worker does none of those.
  await import(pathToFileURL(harness).href);
  sameSource(config.source);
}

export async function runFreshnessExperiment(options, dependencies = {}) {
  const execute = dependencies.execute ?? runStartupWorker;
  const captureSource = dependencies.fingerprint ?? fingerprint;
  const checkSource = dependencies.checkSource ?? sameSource;
  const output = resolve(options.output);
  if (existsSync(output)) throw new Error("Choose a NEW experiment directory.");
  const source = captureSource();
  const shellBytes = readFileSync(options.shell);
  const shellHash = hash(shellBytes);
  const sourceHash = () => {
    checkSource(source);
    if (hash(readFileSync(options.shell)) !== shellHash)
      throw new Error("Browser binary changed during comparison.");
  };
  const plan = freshnessPlan();
  mkdirSync(output, { recursive: true });
  const experimentId = randomUUID();
  write(join(output, "experiment.json"), {
    schemaVersion: 1,
    experimentId,
    status: "diagnostic-only",
    source,
    shell: options.shell,
    shellHash,
    baseUrl: options.baseUrl,
    plannedNewFixtures: 4,
    plan,
    serverAttestation:
      "Record serving process/image/source separately; a local Git hash is not server attestation.",
  });
  const rows = [],
    reports = [],
    fixtures = new Map();
  for (const item of plan) {
    const trialDir = join(output, item.directory);
    mkdirSync(trialDir);
    const config = {
      ...item,
      experimentId,
      runId: randomUUID(),
      source,
      projectId: item.fixtureKind === "fresh" ? null : fixtures.get(item.pair),
      baseUrl: options.baseUrl,
      shell: options.shell,
      harnessOutput: join(trialDir, "harness"),
    };
    const configPath = join(trialDir, "config.json");
    write(configPath, config);
    let processResult = null,
      raw = null;
    try {
      sourceHash();
      // Validate configuration before spawning a process that can authorize an import.
      freshnessHarnessArgs(config);
      processResult = await execute(fileURLToPath(import.meta.url), configPath, trialDir, {
        cwd: root,
      });
      write(join(trialDir, "process.json"), processResult);
      sourceHash();
      const resultPath = join(config.harnessOutput, "result.json");
      const bytes = readFileSync(resultPath);
      raw = JSON.parse(bytes);
      const row = validateFreshnessTrial(config, processResult, raw, source.harnessHashes);
      if (item.fixtureKind === "fresh") fixtures.set(item.pair, row.projectId);
      else {
        const first = rows.find((r) => r.pair === item.pair && r.fixtureKind === "fresh");
        if (
          !first ||
          row.beforeHash !== first.beforeHash ||
          row.revisionHash !== first.revisionHash
        )
          throw new Error("Paired reuse does not contain the unchanged fresh fixture.");
      }
      rows.push(row);
      reports.push({ file: `${item.directory}/harness/result.json`, sha256: hash(bytes) });
      write(join(output, "progress.json"), {
        status: "diagnostic-only",
        experimentId,
        completed: rows,
        retainedFixtures: [...fixtures.values()],
        remaining: plan.slice(item.index + 1).map((p) => ({ ...p, outcome: "not-run" })),
      });
      console.log(
        `${item.index + 1}/${plan.length} ${item.fixtureKind}/${item.preflight}: mount ${row.mount}; observed ${row.timelinePhase}`,
      );
    } catch (error) {
      const summary = {
        schemaVersion: 1,
        status: "diagnostic-only",
        interpretation: "invalid-comparison",
        experimentId,
        source,
        stoppedAt: item,
        error: String(error),
        process: processResult,
        retainedFixtures: [
          ...new Set([...fixtures.values(), ...(raw?.projectId ? [raw.projectId] : [])]),
        ],
        completed: rows,
        reports,
        remaining: plan.slice(item.index + 1).map((p) => ({ ...p, outcome: "not-run" })),
        acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
      };
      write(join(output, "comparison.json"), summary);
      return { summary, exitCode: 1 };
    }
  }
  try {
    sourceHash();
    const summary = {
      ...summarizeFreshness(rows),
      experimentId,
      source,
      shellHash,
      reports,
      retainedFixtures: [...fixtures.values()],
    };
    write(join(output, "comparison.json"), summary);
    return { summary, exitCode: freshnessExit(summary) };
  } catch (error) {
    const summary = {
      schemaVersion: 1,
      status: "diagnostic-only",
      interpretation: "invalid-comparison",
      experimentId,
      source,
      error: String(error),
      completed: rows,
      reports,
      remaining: [],
      retainedFixtures: [...fixtures.values()],
      acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
    };
    write(join(output, "comparison.json"), summary);
    return { summary, exitCode: 1 };
  }
}

export async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--worker") {
    if (argv.length !== 2) throw new Error("Malformed worker invocation.");
    await worker(argv[1]);
    return;
  }
  const options = parseFreshnessCli(argv);
  const result = await runFreshnessExperiment(options);
  process.exitCode = result.exitCode;
  console.log(
    JSON.stringify({
      status: result.summary.status,
      interpretation: result.summary.interpretation,
      exitCode: result.exitCode,
      output: options.output,
    }),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
