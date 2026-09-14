/** A paired diagnostic is not a passing editing journey. Never select a successful arm as a bypass. */
import assert from "node:assert/strict";
import { MANAGED_JOURNEY_PHASES } from "./managed-studio-diagnostics.mjs";

const hash = /^[a-f0-9]{64}$/;
const id = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const REQUIRED_IMPORTS = 4;

export function freshnessPlan() {
  const plan = [];
  // Fresh always precedes its reuse: cache/age/previous observation are intentionally a bundle.
  // Reverse the preflight order, not that causal dependency, for the second round.
  for (const [round, preflights] of [
    [1, ["none", "editor-view"]],
    [2, ["editor-view", "none"]],
  ]) {
    for (const preflight of preflights) {
      const pair = `r${round}-${preflight}`;
      for (const fixtureKind of ["fresh", "reused"]) {
        const index = plan.length;
        plan.push({
          index,
          round,
          pair,
          preflight,
          fixtureKind,
          directory: `${String(index + 1).padStart(2, "0")}-${pair}-${fixtureKind}`,
        });
      }
    }
  }
  return plan;
}

export function parseFreshnessCli(argv) {
  const keys = new Set([
    "--base-url",
    "--headless-shell",
    "--output",
    "--allow-create-test-projects",
  ]);
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i],
      value = argv[i + 1];
    assert(
      keys.has(key) && !Object.hasOwn(values, key) && value && !value.startsWith("--"),
      `Unknown, duplicate or incomplete option: ${key}`,
    );
    values[key] = value;
  }
  const origin = new URL(values["--base-url"] ?? "http://127.0.0.1:5190");
  assert(
    origin.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) &&
      origin.pathname === "/" &&
      !origin.search &&
      !origin.hash &&
      !origin.username &&
      !origin.password,
    "A bare HTTP loopback origin is required.",
  );
  assert.equal(
    values["--allow-create-test-projects"],
    String(REQUIRED_IMPORTS),
    "This plan creates FOUR new retained test fixtures; authorize with --allow-create-test-projects 4.",
  );
  assert(
    values["--headless-shell"] && values["--output"],
    "--headless-shell and a NEW --output are required.",
  );
  return { baseUrl: origin.origin, shell: values["--headless-shell"], output: values["--output"] };
}

/** Exact original entry point; no additional startup driver with a different warm-up sequence. */
export function freshnessHarnessArgs(config) {
  assert(uuid.test(config.runId ?? ""), "Missing invocation identity.");
  assert(["none", "editor-view"].includes(config.preflight), "Invalid preflight.");
  assert(["fresh", "reused"].includes(config.fixtureKind), "Invalid fixture kind.");
  const argv = [
    "--base-url",
    config.baseUrl,
    "--headless-shell",
    config.shell,
    "--output",
    config.harnessOutput,
    "--startup-only",
    "--startup-run-id",
    config.runId,
  ];
  if (config.fixtureKind === "fresh") {
    assert.equal(config.projectId, null, "A fresh run cannot be supplied an existing project.");
    argv.push("--allow-create-test-project");
  } else {
    assert(
      id.test(config.projectId ?? ""),
      "The reuse must identify the fixture from its paired fresh trial.",
    );
    argv.push("--reuse-project", config.projectId);
  }
  if (config.preflight === "editor-view") argv.push("--startup-editor-preflight");
  return argv;
}

export function validateFreshnessTrial(config, processResult, evidence, expectedHarnessHashes) {
  assert.equal(
    processResult.code,
    2,
    "Child must finish as diagnostic-only, not an accepted journey.",
  );
  assert(
    !processResult.signal &&
      !processResult.timedOut &&
      !processResult.interrupted &&
      !processResult.error,
    "Worker was interrupted, killed or failed to start.",
  );
  assert.equal(evidence?.status, "diagnostic-only");
  const item = evidence.startup;
  assert(
    item?.schemaVersion === 1 && item.valid === true && item.finalizationAttempted === true,
    "Incomplete startup observation.",
  );
  assert.equal(item.runId, config.runId, "Stale or foreign startup record.");
  assert.equal(item.fixtureKind, config.fixtureKind);
  assert.equal(item.preflight, config.preflight);
  assert(id.test(evidence.projectId ?? "") && item.projectId === evidence.projectId);
  assert.equal(item.requestedProjectId, config.projectId);
  if (config.fixtureKind === "reused") assert.equal(evidence.projectId, config.projectId);
  assert.equal(item.revision, 0);
  assert(
    hash.test(item.beforeHash ?? "") && item.beforeHash === item.afterHash,
    "Unchanged snapshot evidence is absent.",
  );
  assert.equal(item.afterView?.projectId, evidence.projectId);
  assert.equal(item.afterView?.revision, 0);
  assert(hash.test(item.afterView?.revisionHash ?? ""));
  if (config.preflight === "none")
    assert.equal(
      item.preflightView,
      undefined,
      "The no-preflight control performed an unexpected editor read.",
    );
  else {
    assert.deepEqual(item.preflightView, item.afterView);
    assert(
      Number.isFinite(item.preflightStartedAt) &&
        item.preflightFinishedAt >= item.preflightStartedAt,
    );
  }
  assert.deepEqual(
    evidence.harnessSourceHashes,
    expectedHarnessHashes,
    "Harness source differs between observations.",
  );
  assert(
    typeof evidence.verificationEnvironment?.browser === "string" &&
      evidence.verificationEnvironment.browser.length > 0,
  );
  assert(
    typeof evidence.verificationEnvironment?.node === "string" &&
      evidence.verificationEnvironment.node.length > 0,
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.blockedExternal, []);
  assert.equal(item.acceptance?.editing, "not-run");
  assert.equal(item.acceptance?.export, "not-run");
  assert.equal(item.acceptance?.visualReview, "not-performed");
  assert.deepEqual(evidence.steps, [], "A diagnostic unexpectedly executed editing actions.");
  const expectedNames = [...MANAGED_JOURNEY_PHASES];
  if (config.fixtureKind === "reused") expectedNames[0] = "fixture-reused";
  assert.deepEqual(
    evidence.phases?.map((p) => p.name),
    expectedNames,
    "Phase inventory mismatch.",
  );
  assert.equal(evidence.phases[0].status, "passed");
  assert(["passed", "failed"].includes(item.mount));
  assert.equal(evidence.phases[1].status, item.mount);
  assert(
    evidence.phases.slice(2).every((p) => p.status === "not-run"),
    "Later acceptance was credited.",
  );
  const phase = evidence.phases[1];
  assert(
    Number.isFinite(phase.startedAt) &&
      Number.isFinite(phase.finishedAt) &&
      phase.finishedAt >= phase.startedAt,
  );
  assert.equal(item.elapsedMs, phase.finishedAt - phase.startedAt);
  assert(item.observedAt >= phase.finishedAt && typeof item.observedReady === "boolean");
  assert(item.observation && typeof item.observation.url === "string");
  const actual = new URL(item.observation.url),
    origin = new URL(config.baseUrl);
  assert.equal(actual.origin, origin.origin);
  assert.equal(actual.hash, `#project/${encodeURIComponent(evidence.projectId)}?editor=studio`);
  if (item.mount === "failed") assert(typeof phase.error === "string" && phase.error.length);
  return {
    ...config,
    projectId: evidence.projectId,
    mount: item.mount,
    observedReady: item.observedReady,
    elapsedMs: item.elapsedMs,
    beforeHash: item.beforeHash,
    afterHash: item.afterHash,
    revisionHash: item.afterView.revisionHash,
    browser: evidence.verificationEnvironment.browser,
    node: evidence.verificationEnvironment.node,
    timelinePhase: item.observation.timelinePhase ?? null,
    renderedClips: item.observation.renderedClipCount ?? null,
  };
}

export function summarizeFreshness(rows) {
  const plan = freshnessPlan();
  assert.equal(rows.length, plan.length, "Every planned observation must exist.");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (const key of ["index", "round", "pair", "preflight", "fixtureKind"])
      assert.equal(row[key], plan[i][key], `Trial ${i} has a foreign ${key}.`);
    assert(["passed", "failed"].includes(row.mount));
    assert(hash.test(row.beforeHash ?? "") && row.beforeHash === row.afterHash);
    assert(hash.test(row.revisionHash ?? "") && id.test(row.projectId ?? ""));
    assert(row.browser && row.node && row.browser === rows[0].browser && row.node === rows[0].node);
  }
  const fresh = rows.filter((row) => row.fixtureKind === "fresh");
  assert.equal(
    new Set(fresh.map((row) => row.projectId)).size,
    REQUIRED_IMPORTS,
    "Fresh controls reused an earlier fixture.",
  );
  for (let i = 0; i < rows.length; i += 2) {
    for (const key of ["projectId", "beforeHash", "revisionHash"])
      assert.equal(rows[i][key], rows[i + 1][key], `Paired reuse differs in ${key}.`);
  }
  const controls = fresh.filter((row) => row.preflight === "none");
  const allPass = controls.every((r) => r.mount === "passed");
  const allFail = controls.every((r) => r.mount === "failed");
  const associations = [];
  if (allFail) {
    const reuses = rows.filter((r) => r.fixtureKind === "reused" && r.preflight === "none");
    if (reuses.every((r) => r.mount === "passed"))
      associations.push({
        dimension: "prior-startup-and-reuse",
        outcome: "Both fresh controls fail and both paired reuses mount.",
      });
    const primed = fresh.filter((r) => r.preflight === "editor-view");
    if (primed.every((r) => r.mount === "passed"))
      associations.push({
        dimension: "pre-navigation-editor-read",
        outcome: "Both fresh controls fail and both fresh editor-read arms mount.",
      });
  }
  const interpretation = allPass
    ? "baseline-failure-not-reproduced"
    : !allFail
      ? "baseline-is-variable"
      : associations.length
        ? "repeatable-startup-difference"
        : "failure-not-isolated-to-these-dimensions";
  return {
    schemaVersion: 1,
    status: "diagnostic-only",
    interpretation,
    associations,
    observations: rows,
    acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
    limitations: [
      "The original harness executable and instrumentation are shared; added bookkeeping cannot promise identical scheduling.",
      "Reuse follows its fresh trial and post-observation reads; it combines age, completed startup, and server/build-cache history.",
      "An editor-view GET changes both work and elapsed time. A difference does not establish which matters.",
      "A timing-sensitive failure may still be a product race, not a harness bug.",
      "Local Git and harness hashes do not independently attest the serving process or image.",
      "Two observations per condition establish a repeated association, not statistical proof or universal exclusion.",
    ],
  };
}
export function freshnessExit(summary) {
  return summary.interpretation === "repeatable-startup-difference" ? 0 : 2;
}
