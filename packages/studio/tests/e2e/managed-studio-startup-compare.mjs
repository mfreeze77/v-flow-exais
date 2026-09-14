/** Diagnostic-only, read-only replay of one EXISTING failed fixture. No new project or edit. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STARTUP_SOURCE_BLOBS,
  readCli,
  managedProjectId,
  summarizeStartupComparison,
  startupComparisonExitCode,
} from "./managed-startup-contract.mjs";
import { runStartupTrial } from "./managed-startup-trial.mjs";
import { runStartupWorker } from "./managed-startup-process.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");
const sha256 = (v) => createHash("sha256").update(v).digest("hex");
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
function git(args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}
function fingerprint() {
  const inputs = {};
  for (const [name, expected] of Object.entries(STARTUP_SOURCE_BLOBS)) {
    const bytes = readFileSync(join(here, name));
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (actual !== expected)
      throw new Error(
        `Unreviewed startup-source change: ${name}. Review/update this experiment rather than guessing equivalence.`,
      );
    inputs[name] = sha256(bytes);
  }
  for (const name of [
    "managed-studio-startup-compare.mjs",
    "managed-startup-contract.mjs",
    "managed-startup-trial.mjs",
    "managed-startup-probe.mjs",
    "managed-startup-process.mjs",
  ])
    inputs[name] = sha256(readFileSync(join(here, name)));
  // These new files may be untracked while being verified. Tracked production code must be frozen.
  if (git(["diff", "--name-only"]) || git(["diff", "--cached", "--name-only"]))
    throw new Error(
      "Tracked source/index changes exist. Freeze or commit the implementation before comparing.",
    );
  return {
    commit: git(["rev-parse", "HEAD"]),
    tree: git(["rev-parse", "HEAD^{tree}"]),
    inputs,
    inputHash: sha256(JSON.stringify(inputs)),
  };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--worker") {
    if (argv.length !== 2) throw new Error("Malformed worker invocation.");
    const options = JSON.parse(readFileSync(argv[1], "utf8"));
    const current = fingerprint();
    if (current.tree !== options.localTree || current.inputHash !== options.inputHash)
      throw new Error("Source changed before the startup worker began.");
    const [{ default: puppeteer }, { attachNetworkDiagnostics }] = await Promise.all([
      import("puppeteer-core"),
      import("./managed-studio-diagnostics.mjs"),
    ]);
    const result = await runStartupTrial(options, {
      launch: (args) => puppeteer.launch(args),
      attachNetworkDiagnostics,
    });
    const after = fingerprint();
    if (after.tree !== current.tree || after.inputHash !== current.inputHash) {
      result.outcome = "invalid";
      result.error = "Local source changed during the trial.";
      write(join(options.output, "trial.json"), result);
    }
    process.exitCode = result.outcome === "invalid" ? 1 : 0;
    console.log(
      JSON.stringify({ profile: result.profile, outcome: result.outcome, output: options.output }),
    );
    return;
  }
  const options = readCli(argv);
  if (options.fromResult) {
    const previous = JSON.parse(readFileSync(resolve(options.fromResult), "utf8"));
    options.projectId = managedProjectId(previous.projectId);
  }
  const output = resolve(options.output);
  if (existsSync(output)) throw new Error("Output exists. Choose a NEW evidence directory.");
  const source = fingerprint();
  mkdirSync(output, { recursive: true });
  const plan = options.plan;
  write(join(output, "experiment.json"), {
    schemaVersion: 1,
    status: "diagnostic-only",
    ...source,
    projectId: options.projectId,
    baseUrl: options.baseUrl,
    shell: options.shell,
    plan,
    note: "Local source fingerprint is verified. Record the serving process/image independently; this is not an attestation of the server.",
  });
  const rows = [];
  for (const item of plan) {
    const directory = join(output, item.directory);
    mkdirSync(directory);
    const config = {
      ...item,
      baseUrl: options.baseUrl,
      projectId: options.projectId,
      shell: options.shell,
      output: directory,
      localTree: source.tree,
      inputHash: source.inputHash,
    };
    const configPath = join(directory, "config.json");
    write(configPath, config);
    const processResult = await runStartupWorker(
      fileURLToPath(import.meta.url),
      configPath,
      directory,
      { cwd: root },
    );
    write(join(directory, "process.json"), processResult);
    let row;
    try {
      row = JSON.parse(readFileSync(join(directory, "trial.json"), "utf8"));
    } catch {
      /* Reported below, not zero counts. */
    }
    if (
      processResult.code !== 0 ||
      processResult.timedOut ||
      processResult.interrupted ||
      !row ||
      row.outcome === "invalid"
    ) {
      write(join(output, "comparison.json"), {
        status: "diagnostic-only",
        interpretation: "invalid-comparison",
        stoppedAt: item,
        process: processResult,
        result: row ?? null,
        completedTrials: rows.length,
        remaining: plan.slice(item.index + 1).map((p) => ({ ...p, outcome: "not-run" })),
        acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
      });
      process.exitCode = 1;
      return;
    }
    rows.push(row);
    console.log(`${item.index + 1}/${plan.length} ${item.profile}: ${row.outcome}`);
  }
  const summary = summarizeStartupComparison(plan, rows);
  summary.source = source;
  summary.trialFiles = plan.map((p) => ({
    file: `${p.directory}/trial.json`,
    sha256: sha256(readFileSync(join(output, p.directory, "trial.json"))),
  }));
  write(join(output, "comparison.json"), summary);
  // 0 is a completed comparison with a repeatable difference, NEVER product acceptance.
  process.exitCode = startupComparisonExitCode(summary.interpretation);
  console.log(
    JSON.stringify({ status: summary.status, interpretation: summary.interpretation, output }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
