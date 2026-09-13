import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import {
  createPhaseLedger,
  MANAGED_JOURNEY_PHASES,
  attachNetworkDiagnostics,
} from "./managed-studio-diagnostics.mjs";
import { managedPhasePredicate, sampleManagedStudio } from "./managed-studio-probe.mjs";

test("all required phases must execute in order before completion", async () => {
  let now = 0;
  const ledger = createPhaseLedger(() => ++now);
  for (const name of MANAGED_JOURNEY_PHASES) await ledger.run(name, async () => 1);
  ledger.assertComplete();
  assert(ledger.phases.every((p) => p.status === "passed" && p.finishedAt > p.startedAt));
});
test("unstarted phases are not passing", () => {
  const ledger = createPhaseLedger();
  assert(ledger.phases.every((p) => p.status === "not-run"));
  assert.throws(() => ledger.assertComplete(), /incomplete/);
});
test("a failed assertion retains the original error and leaves later phases unrun", async () => {
  const ledger = createPhaseLedger();
  const error = new Error("target never populated");
  await assert.rejects(
    ledger.run(MANAGED_JOURNEY_PHASES[0], async () => {
      throw error;
    }),
    (e) => e === error,
  );
  assert.equal(ledger.phases[0].status, "failed");
  assert(ledger.phases.slice(1).every((p) => p.status === "not-run"));
  assert.throws(() => ledger.assertComplete());
});
test("later phases cannot bypass failed prerequisites", async () => {
  const ledger = createPhaseLedger();
  await assert.rejects(
    ledger.run(MANAGED_JOURNEY_PHASES[2], async () => {}),
    /Earlier phase/,
  );
});
test("a passing phase cannot be replayed into a second count", async () => {
  const ledger = createPhaseLedger();
  await ledger.run(MANAGED_JOURNEY_PHASES[0], async () => {});
  await assert.rejects(
    ledger.run(MANAGED_JOURNEY_PHASES[0], async () => {}),
    /Invalid phase/,
  );
});
test("a running phase is visible and concurrent phases are refused", async () => {
  const ledger = createPhaseLedger();
  let done;
  const task = ledger.run(
    MANAGED_JOURNEY_PHASES[0],
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  assert.equal(ledger.current(), MANAGED_JOURNEY_PHASES[0]);
  assert.equal(ledger.phases[0].status, "running");
  await assert.rejects(ledger.run(MANAGED_JOURNEY_PHASES[1], async () => {}));
  done();
  await task;
  assert.equal(ledger.current(), null);
});
test("unknown polling stages are rejected without executing code", () => {
  assert.throws(() => managedPhasePredicate("anything"), /Unknown/);
});

function networkFixture() {
  const page = new EventEmitter();
  const evidence = {};
  const pending = attachNetworkDiagnostics(page, evidence, () => "native-scene-loaded");
  const request = (scene = "title-scene") => ({
    url: () => `http://127.0.0.1:5190/view?sceneId=${scene}&v=1`,
    method: () => "GET",
    resourceType: () => "document",
    failure: () => ({ errorText: "ERR_ABORTED" }),
  });
  return { page, evidence, pending, request };
}
test("network records retain scene query and distinguish pending from responded", () => {
  const { page, evidence, pending, request } = networkFixture();
  const r = request();
  page.emit("request", r);
  page.emit("response", { request: () => r, status: () => 200 });
  assert.equal(pending().length, 1);
  assert.equal(evidence.network[0].search, "?sceneId=title-scene&v=1");
  assert.equal(evidence.network[0].state, "pending");
  page.emit("requestfinished", r);
  assert.equal(pending().length, 0);
  assert.equal(evidence.network[0].state, "finished");
});
test("same-URL attempts have different invocation identities", () => {
  const { page, evidence, pending, request } = networkFixture();
  const a = request(),
    b = request();
  page.emit("request", a);
  page.emit("request", b);
  page.emit("requestfailed", a);
  assert.notEqual(evidence.network[0].id, evidence.network[1].id);
  assert.equal(evidence.network[0].error, "ERR_ABORTED");
  assert.equal(pending().length, 1);
  assert.equal(pending()[0].id, evidence.network[1].id);
});
test("diagnostic warnings do not become successful or failed test counts", () => {
  const { page, evidence } = networkFixture();
  page.emit("console", { type: () => "warn", text: () => "warning" });
  page.emit("console", { type: () => "log", text: () => "ordinary log" });
  assert.equal(evidence.console.length, 1);
  assert.equal(Object.hasOwn(evidence, "status"), false);
});

// Structural DOM doubles exercise exact URL/pin validation. They are NOT browser
// evidence. Physical layout, shadow roots and trusted clicks are tested separately.
function snapshot(overrides = {}) {
  const projectId = "fixture",
    buildHash = "a".repeat(64),
    revisionHash = "b".repeat(64);
  const path = `/api/vflow/projects/${projectId}/editor/previews/${buildHash}/view`;
  const expected = { projectId, buildHash, revisionHash, sceneId: "title-scene" };
  const url = `http://127.0.0.1:5190${path}?sceneId=title-scene`;
  const rect = { x: 0, y: 0, width: 100, height: 60 };
  const owner = {
    getAttribute: (key) =>
      ({
        "data-vflow-scene-id": overrides.ownerScene ?? "title-scene",
        "data-vflow-document-id": "title",
      })[key] ?? null,
  };
  const doc = {
    URL: overrides.url ?? url,
    readyState: overrides.readyState ?? "complete",
    documentElement: {
      getAttribute: (key) =>
        ({
          "data-vflow-project-id": projectId,
          "data-vflow-build-hash": overrides.buildHash ?? buildHash,
          "data-vflow-revision-hash": overrides.revisionHash ?? revisionHash,
        })[key] ?? null,
    },
    querySelectorAll: () => [owner],
  };
  const frame = {
    tagName: "IFRAME",
    src: overrides.src ?? url,
    contentDocument: doc,
    getBoundingClientRect: () => rect,
  };
  const clip = {
    nodeType: 1,
    tagName: "DIV",
    id: "",
    getBoundingClientRect: () => rect,
    getAttribute: (key) => (key === "data-el-id" ? "index.html#el-0" : null),
    closest: () => null,
    contains: (target) => target === clip,
  };
  const select = {
    disabled: false,
    value: "",
    querySelectorAll: () => [{ value: "heading", textContent: "h1" }],
  };
  const inspector = { textContent: "Ready", querySelector: () => select };
  const document = {
    querySelectorAll: (selector) =>
      selector === "*" ? [frame] : selector.includes("[data-clip]") ? [clip] : [],
    querySelector: () => inspector,
    elementFromPoint: () => clip,
  };
  return runInNewContext(`(${sampleManagedStudio.toString()})(request)`, {
    document,
    window: {},
    innerWidth: 1000,
    innerHeight: 800,
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    location: { href: "http://127.0.0.1:5190/", origin: "http://127.0.0.1:5190" },
    URL,
    request: { clipId: "index.html#el-0", expected },
  });
}
test("matching loaded/requested URLs and pinned metadata satisfy the phase", () => {
  const result = snapshot();
  assert(result.ready["clip-interactable"]);
  assert(result.ready["scene-loaded"]);
  assert(result.ready["authoring-targets"]);
});
for (const [name, options] of [
  ["wrong build hash", { buildHash: "c".repeat(64) }],
  ["wrong revision hash", { revisionHash: "c".repeat(64) }],
  ["loaded about:blank", { url: "about:blank" }],
  ["uncommitted iframe src", { src: "about:blank" }],
  ["different scene owner", { ownerScene: "another-scene" }],
  ["loading document", { readyState: "loading" }],
  [
    "foreign origin",
    {
      url: `https://other.example/api/vflow/projects/fixture/editor/previews/${"a".repeat(64)}/view?sceneId=title-scene`,
    },
  ],
  [
    "wrong scene URL",
    {
      url: `http://127.0.0.1:5190/api/vflow/projects/fixture/editor/previews/${"a".repeat(64)}/view?sceneId=another-scene`,
    },
  ],
])
  test(`${name} cannot certify scene readiness`, () => {
    const result = snapshot(options);
    assert.equal(result.ready["scene-loaded"], false);
    assert.equal(result.ready["authoring-targets"], false);
  });
test("cache-busting query does not change the pinned scene identity", () => {
  const url = `http://127.0.0.1:5190/api/vflow/projects/fixture/editor/previews/${"a".repeat(64)}/view?sceneId=title-scene&t=123`;
  assert.equal(snapshot({ src: url, url }).ready["scene-loaded"], true);
});
