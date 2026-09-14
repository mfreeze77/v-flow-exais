import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STARTUP_PROFILES,
  STARTUP_TIMEOUT_MS,
  makeTrialPlan,
  profileChanges,
  readCli,
  loopbackOrigin,
  requestPermitted,
  summarizeStartupComparison,
} from "./managed-startup-contract.mjs";
import { startupIdentityMatches } from "./managed-startup-probe.mjs";
const A = "a".repeat(64),
  B = "b".repeat(64);
const plan = () => makeTrialPlan(["full", "without-console-diagnostics"]);
const rows = (p = plan()) =>
  p.map((r) => ({
    ...r,
    projectId: "test-project",
    browserVersion: "Chrome/test",
    localTree: A,
    beforeHash: B,
    afterHash: B,
    inputHash: A,
    expected: { revisionHash: A },
    afterRevisionHash: A,
    outcome: r.profile === "full" ? "mount-failed" : "ready",
    elapsedMs: 5,
    snapshot: {},
  }));
for (const name of Object.keys(STARTUP_PROFILES).filter((n) => n !== "full"))
  test(`${name} changes exactly one declared dimension`, () =>
    assert.equal(profileChanges(name).length, 1));
test("baseline retains the harness's RAF polling and stage timeout", () => {
  assert.equal(STARTUP_TIMEOUT_MS, 60000);
  assert.equal(STARTUP_PROFILES.full.polling, "raf");
});
test("the second round reverses order and returns to baseline", () => {
  const p = makeTrialPlan();
  const names = p.slice(0, p.length / 2).map((r) => r.profile);
  assert.deepEqual(
    p.slice(p.length / 2).map((r) => r.profile),
    names.toReversed(),
  );
  assert.equal(p[0].profile, "full");
  assert.equal(p.at(-1).profile, "full");
});
for (const names of [[], ["full"], ["full", "full"], ["no-console", "full"], ["full", "typo"]])
  test(`invalid trial plan ${JSON.stringify(names)} fails`, () =>
    assert.throws(() => makeTrialPlan(names)));
const cli = [
  "--project-id",
  "video-test",
  "--headless-shell",
  "/tmp/chrome",
  "--output",
  "/tmp/new",
];
test("CLI records defaults without changing source settings", () => {
  const c = readCli(cli);
  assert.equal(c.plan.length, 12);
  assert.equal(c.baseUrl, "http://127.0.0.1:5190");
});
for (const extra of [
  ["--timeout", "90000"],
  ["--output", "again"],
  ["--profiles"],
  ["--profiles", "full"],
])
  test(`CLI rejects ${JSON.stringify(extra)}`, () =>
    assert.throws(() => readCli([...cli, ...extra])));
for (const input of [
  "https://localhost:5190",
  "http://example.com",
  "http://localhost:5190/path",
  "http://u:p@localhost:5190",
  "http://localhost:5190/?x",
  "http://localhost:5190/#x",
])
  test(`noncanonical origin ${input} fails`, () => assert.throws(() => loopbackOrigin(input)));
for (const input of ["http://localhost:5190", "http://127.0.0.1:5190/", "http://[::1]:5190"])
  test(`loopback ${input} allowed`, () => assert.equal(loopbackOrigin(input).protocol, "http:"));
test("all diagnostic profiles keep the original request permission rule", () => {
  const origin = loopbackOrigin("http://127.0.0.1:5190");
  for (const url of [
    "http://127.0.0.1:5190/api",
    "about:blank",
    "data:text/plain,ok",
    "blob:http://127.0.0.1:5190/id",
  ])
    assert.equal(requestPermitted(url, origin), true);
  for (const url of [
    "http://127.0.0.1:5191/api",
    "https://example.com/x",
    "http://localhost:5190/api",
  ])
    assert.equal(requestPermitted(url, origin), false);
});
test("a repeatable difference is an association, not acceptance", () => {
  const report = summarizeStartupComparison(plan(), rows());
  assert.equal(report.interpretation, "repeatable-startup-difference");
  assert.equal(report.status, "diagnostic-only");
  assert.equal(report.associations.length, 1);
  assert.equal(report.acceptance.editing, "not-run");
  assert.equal(report.acceptance.export, "not-run");
});
test("a baseline that succeeds does not blame any instrumentation", () => {
  const r = rows().map((r) => ({ ...r, outcome: "ready" }));
  const report = summarizeStartupComparison(plan(), r);
  assert.equal(report.interpretation, "baseline-failure-not-reproduced");
  assert.deepEqual(report.associations, []);
});
test("a variable baseline is not a reproducible causal result", () => {
  const r = rows();
  r[0].outcome = "ready";
  const report = summarizeStartupComparison(plan(), r);
  assert.equal(report.interpretation, "baseline-is-variable");
  assert.deepEqual(report.associations, []);
});
test("every arm failing stays unexplained", () => {
  const r = rows().map((r) => ({ ...r, outcome: "mount-failed" }));
  assert.equal(
    summarizeStartupComparison(plan(), r).interpretation,
    "failure-not-isolated-to-these-dimensions",
  );
});
for (const field of [
  "browserVersion",
  "localTree",
  "beforeHash",
  "afterHash",
  "inputHash",
  "projectId",
])
  test(`changed ${field} invalidates comparison`, () => {
    const r = rows();
    r[1][field] = field.endsWith("Hash") ? A : "other";
    if (field === "inputHash") r[1][field] = B;
    const result = summarizeStartupComparison(plan(), r);
    assert.equal(result.interpretation, "invalid-comparison");
    assert.deepEqual(result.associations, []);
  });
for (const broken of [
  (r) => r.pop(),
  (r) => {
    r[1].index = 0;
  },
  (r) => {
    r[1].beforeHash = null;
  },
  (r) => {
    r[1].profile = "typo";
  },
  (r) => {
    r[1].outcome = "passed";
  },
])
  test("incomplete or misidentified evidence is rejected", () => {
    const r = rows();
    broken(r);
    assert.throws(() => summarizeStartupComparison(plan(), r));
  });
function readySnapshot() {
  return {
    truncated: false,
    timelinePhase: "ready",
    headerPresent: true,
    renderedClipCount: 3,
    timelineRoots: [{ layout: { width: 900, height: 360 }, elementCount: "3" }],
    overlays: [],
    frames: [
      {
        readyState: "complete",
        projectId: "video-test",
        buildHash: B,
        revisionHash: A,
        revision: "0",
        src: `http://127.0.0.1:5190/api/vflow/projects/video-test/editor/previews/${B}/view`,
        documentUrl: `http://127.0.0.1:5190/api/vflow/projects/video-test/editor/previews/${B}/view`,
        layout: { connected: true, width: 800, height: 450 },
      },
    ],
  };
}
const pin = {
  projectId: "video-test",
  revision: 0,
  revisionHash: A,
  origin: "http://127.0.0.1:5190",
};
test("positive startup snapshot requires real clips and matching frame", () =>
  assert.equal(startupIdentityMatches(readySnapshot(), pin), true));
for (const mutate of [
  (s) => {
    s.renderedClipCount = 0;
  },
  (s) => {
    s.timelinePhase = "timeline-pending";
  },
  (s) => {
    s.frames[0].revisionHash = B;
  },
  (s) => {
    s.frames[0].projectId = "other";
  },
  (s) => {
    s.frames[0].src += "?sceneId=title";
  },
  (s) => {
    s.frames[0].documentUrl = "about:blank";
  },
  (s) => {
    s.frames[0].layout.connected = false;
  },
  (s) => {
    s.timelineRoots[0].layout.width = 0;
  },
  (s) => {
    s.overlays = [{ layout: { display: "block", visibility: "visible", width: 900, height: 360 } }];
  },
  (s) => {
    s.frames.push(structuredClone(s.frames[0]));
  },
  (s) => {
    s.truncated = true;
  },
])
  test("incomplete, covered or wrong-pin readiness is not certified", () => {
    const s = readySnapshot();
    mutate(s);
    assert.equal(startupIdentityMatches(s, pin), false);
  });

test("from-result is explicit and mutually exclusive with project-id", () => {
  const c = readCli([
    "--from-result",
    "/tmp/failed.json",
    "--headless-shell",
    "/tmp/chrome",
    "--output",
    "/tmp/new",
  ]);
  assert.equal(c.projectId, null);
  assert.equal(c.fromResult, "/tmp/failed.json");
  assert.throws(() => readCli([...cli, "--from-result", "/tmp/failed.json"]));
});
test("same source bytes with a different revision index is not comparable", () => {
  const r = rows();
  r[1].afterRevisionHash = B;
  assert.equal(summarizeStartupComparison(plan(), r).interpretation, "invalid-comparison");
});

const { startupComparisonExitCode } = await import("./managed-startup-contract.mjs");
for (const [interpretation, expected] of [
  ["invalid-comparison", 1],
  ["repeatable-startup-difference", 0],
  ["baseline-failure-not-reproduced", 2],
  ["baseline-is-variable", 2],
  ["failure-not-isolated-to-these-dimensions", 2],
])
  test(`exit status preserves ${interpretation}`, () =>
    assert.equal(startupComparisonExitCode(interpretation), expected));
test("unknown comparison verdict cannot become success", () =>
  assert.throws(() => startupComparisonExitCode("passed")));
test("prototype names are not startup profiles", () =>
  assert.throws(() => makeTrialPlan(["full", "constructor"])));
