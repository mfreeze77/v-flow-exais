import { test } from "node:test";
import assert from "node:assert/strict";
import { createPhaseLedger } from "./managed-studio-diagnostics.mjs";
import {
  parseFreshnessMode,
  beginFreshnessEvidence,
  captureFreshnessBaseline,
  primeFreshnessEditor,
  finishFreshnessEvidence,
  snapshotDigest,
} from "./managed-freshness-mode.mjs";

const pid = "video-fixture";
const snapshot = () => ({
  manifest: { id: pid, revision: 0 },
  sources: { title: "<h1>Original</h1>" },
});
const view = () => ({ projectId: pid, revision: 0, revisionHash: "a".repeat(64) });
function setup(extra = []) {
  const mode = parseFreshnessMode(["--startup-only", ...extra]);
  const ledger = createPhaseLedger(() => 100);
  const evidence = {
    projectId: pid,
    phases: ledger.phases,
    pageErrors: [],
    blockedExternal: [],
    steps: [],
  };
  beginFreshnessEvidence(evidence, mode, ledger);
  captureFreshnessBaseline(evidence, { snapshot: snapshot() }, pid);
  const calls = [];
  const page = {
    async evaluate(fn) {
      calls.push(fn.name || fn.toString());
      if (fn.name === "sampleManagedStartup")
        return {
          url: `http://127.0.0.1:5190/#project/${pid}?editor=studio`,
          timelinePhase: "load-pending",
          headerPresent: true,
          frames: [],
          renderedClipCount: 0,
          timelineRoots: [],
          overlays: [],
        };
      if (fn.toString().includes("/editor`")) return view();
      return { snapshot: snapshot() };
    },
  };
  return { mode, ledger, evidence, calls, page };
}
function mounted(f, state) {
  f.evidence.phases[0].status = "passed";
  Object.assign(f.evidence.phases[1], {
    status: state,
    startedAt: 100,
    finishedAt: 200,
    ...(state === "failed" ? { error: "Wait timed out" } : {}),
  });
}

test("default mode cannot substitute a reused fixture", () => {
  assert.deepEqual(parseFreshnessMode([]), {
    enabled: false,
    reuseProjectId: null,
    editorPreflight: false,
    runId: null,
  });
  assert.throws(() => parseFreshnessMode(["--reuse-project", pid]));
  assert.throws(() => parseFreshnessMode(["--startup-editor-preflight"]));
});
for (const argv of [
  ["--startup-only", "--startup-only"],
  ["--startup-only", "--reuse-project"],
  ["--startup-only", "--reuse-project", "../../other"],
  ["--startup-only", "--reuse-project", pid, "--allow-create-test-project"],
  ["--startup-only", "--startup-run-id", "not-a-uuid"],
  ["--startup-run-id", "12345678-1234-1234-1234-123456789abc"],
])
  test(`invalid diagnostic options: ${argv.join(" ")}`, () =>
    assert.throws(() => parseFreshnessMode(argv)));

test("construction and baseline capture issue no request", () => {
  const f = setup();
  assert.deepEqual(f.calls, []);
  assert.equal(f.evidence.phases[0].name, "fixture-created");
});
test("reuse phase truthfully says reused, not created", () => {
  const f = setup(["--reuse-project", pid]);
  assert.equal(f.evidence.phases[0].name, "fixture-reused");
  assert.equal(f.evidence.startup.requestedProjectId, pid);
});
test("no-preflight does not add an awaitable browser request", async () => {
  const f = setup();
  await primeFreshnessEditor(f.page, f.evidence, f.mode);
  assert.deepEqual(f.calls, []);
});
test("editor preflight makes exactly the declared read", async () => {
  const f = setup(["--startup-editor-preflight"]);
  await primeFreshnessEditor(f.page, f.evidence, f.mode);
  assert.equal(f.calls.length, 1);
  assert(f.calls[0].includes("/editor`"));
  assert.deepEqual(f.evidence.startup.preflightView, view());
});
for (const state of ["passed", "failed"])
  test(`mount ${state} is observed once and remains diagnostic`, async () => {
    const f = setup();
    mounted(f, state);
    assert.equal(await finishFreshnessEvidence(f.page, f.evidence), 2);
    assert.equal(f.calls[0], "sampleManagedStartup");
    assert.equal(f.calls.length, 3);
    assert.equal(f.evidence.status, "diagnostic-only");
    assert.equal(f.evidence.startup.mount, state);
    // A late/nonready sample is distinct from what the original predicate observed.
    assert.equal(f.evidence.startup.observedReady, false);
    assert(f.evidence.phases.slice(2).every((p) => p.status === "not-run"));
    await assert.rejects(finishFreshnessEvidence(f.page, f.evidence), /cannot be retried/);
    assert.equal(f.calls.length, 3);
  });
test("changed fixture invalidates observation rather than replacing its baseline", async () => {
  const f = setup();
  mounted(f, "passed");
  const evaluate = f.page.evaluate;
  f.page.evaluate = async (fn) =>
    fn.name === "sampleManagedStartup" || fn.toString().includes("/editor`")
      ? evaluate(fn)
      : { snapshot: { ...snapshot(), sources: { title: "changed" } } };
  await assert.rejects(finishFreshnessEvidence(f.page, f.evidence), /changed/);
  assert.equal(f.evidence.startup.valid, false);
});
test("preflight and postflight revision identity must agree", async () => {
  const f = setup();
  mounted(f, "passed");
  f.evidence.startup.preflightView = { ...view(), revisionHash: "b".repeat(64) };
  await assert.rejects(finishFreshnessEvidence(f.page, f.evidence), /changed/);
});
test("page errors invalidate comparison even with a completed clip wait", async () => {
  const f = setup();
  mounted(f, "passed");
  f.evidence.pageErrors.push("uncaught");
  await assert.rejects(finishFreshnessEvidence(f.page, f.evidence), /Page errors/);
});
test("failure before mount cannot become an observed mount failure", async () => {
  const f = setup();
  await assert.rejects(finishFreshnessEvidence(f.page, f.evidence), /before the original mount/);
  assert.equal(f.evidence.startup.valid, false);
});
test("content digest ignores object prototype and key order but retains array order", () => {
  const nullProto = Object.assign(Object.create(null), { second: 2, first: [1, 2] });
  assert.equal(snapshotDigest(nullProto), snapshotDigest({ first: [1, 2], second: 2 }));
  assert.notEqual(snapshotDigest(nullProto), snapshotDigest({ first: [2, 1], second: 2 }));
});
