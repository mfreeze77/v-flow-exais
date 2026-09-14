import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STARTUP_PROFILES } from "./managed-startup-contract.mjs";
import {
  diagnosticPageFacade,
  attachLoopbackGuard,
  runStartupTrial,
} from "./managed-startup-trial.mjs";
const A = "a".repeat(64),
  B = "b".repeat(64);
for (const name of Object.keys(STARTUP_PROFILES))
  test(`${name}: observer groups are explicit`, () => {
    const e = new EventEmitter(),
      profile = STARTUP_PROFILES[name];
    const facade = diagnosticPageFacade(e, profile);
    for (const type of ["request", "response", "requestfinished", "requestfailed", "console"])
      facade.on(type, () => {});
    assert.equal(e.listenerCount("request"), Number(profile.network));
    assert.equal(e.listenerCount("console"), Number(profile.console));
  });
test("guard survives disabled diagnostic groups and resolves only permitted URLs", async () => {
  const page = new EventEmitter();
  const evidence = { blockedExternal: [], instrumentationErrors: [] };
  const remove = attachLoopbackGuard(page, new URL("http://127.0.0.1:5190"), evidence);
  const calls = [];
  for (const url of ["http://127.0.0.1:5190/a", "https://example.com/b"])
    page.emit("request", {
      url: () => url,
      isInterceptResolutionHandled: () => false,
      continue: async () => calls.push("continue"),
      abort: async () => calls.push("abort"),
    });
  await Promise.resolve();
  assert.deepEqual(calls, ["continue", "abort"]);
  assert.deepEqual(evidence.blockedExternal, ["https://example.com/b"]);
  remove();
  assert.equal(page.listenerCount("request"), 0);
});
test("a request resolved before the guard is an evidence error", () => {
  const page = new EventEmitter(),
    evidence = { blockedExternal: [], instrumentationErrors: [] };
  attachLoopbackGuard(page, new URL("http://127.0.0.1:5190"), evidence);
  page.emit("request", {
    url: () => "http://127.0.0.1:5190/a",
    isInterceptResolutionHandled: () => true,
    continue: () => assert.fail("must not re-resolve"),
    abort: () => assert.fail("must not re-resolve"),
  });
  assert.equal(evidence.instrumentationErrors.length, 1);
});
test("resolution promise rejection is not silently lost", async () => {
  const page = new EventEmitter(),
    evidence = { blockedExternal: [], instrumentationErrors: [] };
  attachLoopbackGuard(page, new URL("http://127.0.0.1:5190"), evidence);
  page.emit("request", {
    url: () => "http://127.0.0.1:5190/a",
    continue: async () => {
      throw Error("failed continuation");
    },
    abort: async () => {},
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.match(evidence.instrumentationErrors[0], /failed continuation/);
});
function snapshot(ready = true) {
  return {
    timelinePhase: ready ? "ready" : "runtime-pending",
    headerPresent: true,
    timelineRoots: [{ elementCount: ready ? "3" : "0", layout: { width: 900, height: 360 } }],
    renderedClipCount: ready ? 3 : 0,
    overlays: [],
    truncated: false,
    frames: [
      {
        src: `http://127.0.0.1:5190/api/vflow/projects/video-test/editor/previews/${B}/view`,
        documentUrl: `http://127.0.0.1:5190/api/vflow/projects/video-test/editor/previews/${B}/view`,
        projectId: "video-test",
        revision: "0",
        revisionHash: A,
        buildHash: B,
        readyState: "complete",
        layout: { connected: true, width: 800, height: 450 },
      },
    ],
  };
}
function fixture(settings = {}) {
  const page = new EventEmitter();
  let screenshot = false,
    reads = 0;
  const calls = [];
  const project = { manifest: { id: "video-test", revision: 0 }, sources: Object.create(null) };
  Object.assign(page, {
    setViewport: async (value) => calls.push(["viewport", value]),
    setRequestInterception: async (value) => calls.push(["interception", value]),
    goto: async (url) => calls.push(["goto", url]),
    waitForSelector: async () => ({ dispose: async () => {} }),
    waitForFunction: async (fn, options) => {
      calls.push(["wait", options]);
      if (settings.timeout) throw Error("Waiting failed: 60000ms exceeded");
      return { dispose: async () => {} };
    },
    evaluate: async (fn) => {
      if (fn.name === "sampleManagedStartup") return snapshot(!settings.timeout || screenshot);
      if (fn.toString().includes("/editor`"))
        return {
          projectId: "video-test",
          revision: 0,
          revisionHash: A,
          origin: "http://127.0.0.1:5190",
        };
      reads++;
      const current = structuredClone(project);
      if (settings.authoringChanges && reads > 1) current.manifest.revision++;
      return current;
    },
    screenshot: async () => {
      screenshot = true;
    },
  });
  const browser = {
    newPage: async () => page,
    version: async () => "fake-browser-explicit-test-double",
    close: async () => calls.push(["closed"]),
  };
  const attachNetworkDiagnostics = (facade, evidence) => {
    evidence.network = [];
    evidence.console = [];
    for (const event of ["request", "response", "requestfinished", "requestfailed", "console"])
      facade.on(event, () => {});
    return () => [];
  };
  return { calls, launch: async () => browser, attachNetworkDiagnostics };
}
async function run(profile, settings = {}) {
  const output = mkdtempSync(join(tmpdir(), "vflow-startup-unit-"));
  const h = fixture(settings);
  try {
    const result = await runStartupTrial(
      {
        profile,
        index: 0,
        round: 1,
        output,
        shell: "/fake/chrome",
        projectId: "video-test",
        baseUrl: "http://127.0.0.1:5190",
        localTree: A,
        inputHash: B,
      },
      h,
    );
    return { result, calls: h.calls, checkpoint: existsSync(join(output, "checkpoint.json")) };
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}
for (const name of Object.keys(STARTUP_PROFILES))
  test(`${name}: runs read-only sequence with original viewport`, async () => {
    const { result, calls } = await run(name);
    assert.equal(result.outcome, "ready", result.error);
    assert.deepEqual(calls.find(([name]) => name === "viewport")[1], { width: 1600, height: 1000 });
    const options = calls.find(([name]) => name === "wait")[1];
    assert.equal(options.timeout, 60000);
    assert.equal(options.polling, name === "interval-polling" ? 100 : undefined);
    assert.equal(result.beforeHash, result.afterHash);
    assert.equal(result.acceptance.export, "not-run");
    assert.equal(result.status, "diagnostic-only");
  });
test("only the checkpoint-write profile omits intermediate disk checkpoints", async () => {
  assert.equal((await run("full")).checkpoint, true);
  assert.equal((await run("without-checkpoint-writes")).checkpoint, false);
});
test("a screenshot-induced later ready state cannot erase a failed wait", async () => {
  const { result } = await run("full", { timeout: true });
  assert.equal(result.originalMountWait, "failed");
  assert.equal(result.outcome, "mount-failed");
  assert.equal(result.snapshot.timelinePhase, "runtime-pending");
  assert.equal(result.afterScreenshot.timelinePhase, "ready");
});
test("an authoring change invalidates a seemingly ready trial", async () => {
  const { result } = await run("full", { authoringChanges: true });
  assert.equal(result.outcome, "invalid");
  assert.notEqual(result.beforeHash, result.afterHash);
});
