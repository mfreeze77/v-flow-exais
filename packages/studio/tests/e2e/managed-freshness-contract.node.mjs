import { test } from "node:test";
import assert from "node:assert/strict";
import { MANAGED_JOURNEY_PHASES } from "./managed-studio-diagnostics.mjs";
import {
  freshnessPlan,
  parseFreshnessCli,
  freshnessHarnessArgs,
  validateFreshnessTrial,
  summarizeFreshness,
  freshnessExit,
} from "./managed-freshness-contract.mjs";

const hashes = { "managed-studio.mjs": "a".repeat(64) };
function sample(kind = "fresh", preflight = "none") {
  const pid = "video-fixture";
  const config = {
    ...freshnessPlan().find((p) => p.fixtureKind === kind && p.preflight === preflight),
    runId: "12345678-1234-1234-1234-123456789abc",
    projectId: kind === "fresh" ? null : pid,
    baseUrl: "http://127.0.0.1:5190",
    shell: "/pinned/chrome",
    harnessOutput: "/new/output",
  };
  const phases = MANAGED_JOURNEY_PHASES.map((name, i) => ({
    name: i === 0 && kind === "reused" ? "fixture-reused" : name,
    status: i < 2 ? "passed" : "not-run",
    ...(i < 2 ? { startedAt: 100, finishedAt: 200 } : {}),
  }));
  const view = { projectId: pid, revision: 0, revisionHash: "b".repeat(64) };
  const evidence = {
    status: "diagnostic-only",
    projectId: pid,
    phases,
    steps: [],
    pageErrors: [],
    blockedExternal: [],
    harnessSourceHashes: hashes,
    verificationEnvironment: { browser: "FakeBrowser/contract", node: "v22.test" },
    startup: {
      schemaVersion: 1,
      valid: true,
      finalizationAttempted: true,
      runId: config.runId,
      fixtureKind: kind,
      preflight,
      projectId: pid,
      requestedProjectId: config.projectId,
      revision: 0,
      beforeHash: "c".repeat(64),
      afterHash: "c".repeat(64),
      afterView: view,
      mount: "passed",
      elapsedMs: 100,
      observedAt: 210,
      observedReady: true,
      observation: {
        url: `${config.baseUrl}/#project/${pid}?editor=studio`,
        timelinePhase: "ready",
        renderedClipCount: 3,
      },
      acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
      ...(preflight === "editor-view"
        ? { preflightView: view, preflightStartedAt: 80, preflightFinishedAt: 90 }
        : {}),
    },
  };
  const processResult = { code: 2, signal: null, timedOut: false, interrupted: false, error: null };
  return { config, evidence, processResult };
}
function rows(outcome) {
  return freshnessPlan().map((p) => ({
    ...p,
    projectId: `video-${p.pair}`,
    mount: outcome(p),
    observedReady: outcome(p) === "passed",
    beforeHash: "a".repeat(64),
    afterHash: "a".repeat(64),
    revisionHash: "b".repeat(64),
    browser: "FakeBrowser/test",
    node: "node/test",
    elapsedMs: 100,
  }));
}

test("plan has four fresh imports, each reused once, with preflight order reversed", () => {
  const p = freshnessPlan();
  assert.equal(p.length, 8);
  assert.equal(p.filter((r) => r.fixtureKind === "fresh").length, 4);
  assert.deepEqual(
    p.map((r) => `${r.fixtureKind}/${r.preflight}`),
    [
      "fresh/none",
      "reused/none",
      "fresh/editor-view",
      "reused/editor-view",
      "fresh/editor-view",
      "reused/editor-view",
      "fresh/none",
      "reused/none",
    ],
  );
});
test("CLI demands explicit authorization for FOUR retained fixtures", () => {
  const a = ["--output", "/new", "--headless-shell", "/pinned/chrome"];
  assert.throws(() => parseFreshnessCli(a));
  assert.throws(() => parseFreshnessCli([...a, "--allow-create-test-projects", "1"]));
  assert.equal(
    parseFreshnessCli([...a, "--allow-create-test-projects", "4"]).baseUrl,
    "http://127.0.0.1:5190",
  );
});
for (const origin of [
  "https://example.com",
  "http://127.0.0.1/other",
  "http://u:p@localhost",
  "http://localhost/?x=1",
])
  test(`reject nonlocal/ambiguous origin ${origin}`, () =>
    assert.throws(() =>
      parseFreshnessCli([
        "--base-url",
        origin,
        "--output",
        "/new",
        "--headless-shell",
        "/chrome",
        "--allow-create-test-projects",
        "4",
      ]),
    ));
for (const kind of ["fresh", "reused"])
  for (const prime of ["none", "editor-view"])
    test(`${kind}/${prime} uses only explicit options on the original entry point`, () => {
      const s = sample(kind, prime),
        args = freshnessHarnessArgs(s.config);
      assert(args.includes("--startup-only"));
      assert.equal(args.includes("--allow-create-test-project"), kind === "fresh");
      assert.equal(args.includes("--reuse-project"), kind === "reused");
      assert.equal(args.includes("--startup-editor-preflight"), prime === "editor-view");
      assert.equal(
        validateFreshnessTrial(s.config, s.processResult, s.evidence, hashes).mount,
        "passed",
      );
    });
const corruptions = [
  [
    "accepted child is not diagnostic",
    (s) => {
      s.processResult.code = 0;
      s.evidence.status = "passed";
    },
  ],
  [
    "missing run identity",
    (s) => {
      delete s.evidence.startup.runId;
    },
  ],
  [
    "foreign invocation",
    (s) => {
      s.evidence.startup.runId = "f".repeat(36);
    },
  ],
  [
    "incomplete collection",
    (s) => {
      s.evidence.startup.valid = false;
    },
  ],
  [
    "altered source",
    (s) => {
      s.evidence.harnessSourceHashes = {};
    },
  ],
  [
    "mutated fixture",
    (s) => {
      s.evidence.startup.afterHash = "d".repeat(64);
    },
  ],
  [
    "hidden preflight",
    (s) => {
      s.evidence.startup.preflightView = s.evidence.startup.afterView;
    },
  ],
  [
    "undisclosed editing",
    (s) => {
      s.evidence.phases[8].status = "passed";
    },
  ],
  [
    "positive status without matching phase",
    (s) => {
      s.evidence.startup.mount = "failed";
    },
  ],
  [
    "foreign selected project",
    (s) => {
      s.evidence.startup.observation.url = "http://127.0.0.1:5190/#project/other?editor=studio";
    },
  ],
  [
    "interrupted worker",
    (s) => {
      s.processResult.interrupted = true;
    },
  ],
  [
    "page error",
    (s) => {
      s.evidence.pageErrors.push("Error");
    },
  ],
  [
    "missing phase",
    (s) => {
      s.evidence.phases.pop();
    },
  ],
  [
    "foreign fixture",
    (s) => {
      s.evidence.startup.projectId = "other";
    },
  ],
];
for (const [name, corrupt] of corruptions)
  test(`reject ${name}`, () => {
    const s = sample();
    corrupt(s);
    assert.throws(() => validateFreshnessTrial(s.config, s.processResult, s.evidence, hashes));
  });

test("all passing controls remain inconclusive, not instrumentation exoneration", () => {
  const summary = summarizeFreshness(rows(() => "passed"));
  assert.equal(summary.interpretation, "baseline-failure-not-reproduced");
  assert.deepEqual(summary.associations, []);
  assert.equal(freshnessExit(summary), 2);
  assert.equal(summary.acceptance.export, "not-run");
});
test("mixed fresh controls remain variable", () => {
  const summary = summarizeFreshness(rows((p) => (p.index === 0 ? "failed" : "passed")));
  assert.equal(summary.interpretation, "baseline-is-variable");
  assert.equal(freshnessExit(summary), 2);
});
test("fresh failures plus passing reuse identifies prior-startup association only", () => {
  const summary = summarizeFreshness(
    rows((p) => (p.fixtureKind === "fresh" ? "failed" : "passed")),
  );
  assert.equal(summary.interpretation, "repeatable-startup-difference");
  assert.deepEqual(
    summary.associations.map((a) => a.dimension),
    ["prior-startup-and-reuse"],
  );
  assert.equal(freshnessExit(summary), 0);
  assert.equal(summary.status, "diagnostic-only");
});
test("preflight-dependent fresh startup is identified separately", () => {
  const summary = summarizeFreshness(rows((p) => (p.preflight === "none" ? "failed" : "passed")));
  assert.deepEqual(
    summary.associations.map((a) => a.dimension),
    ["pre-navigation-editor-read"],
  );
});
test("all failed waits do not invent a differentiating factor", () => {
  assert.equal(
    summarizeFreshness(rows(() => "failed")).interpretation,
    "failure-not-isolated-to-these-dimensions",
  );
});
for (const [name, change] of [
  ["partial plan", (r) => r.pop()],
  [
    "duplicated fixture",
    (r) => {
      r[2].projectId = r[0].projectId;
      r[3].projectId = r[0].projectId;
    },
  ],
  [
    "changed paired content",
    (r) => {
      r[1].beforeHash = "d".repeat(64);
      r[1].afterHash = "d".repeat(64);
    },
  ],
  [
    "different browser",
    (r) => {
      r[7].browser = "another";
    },
  ],
  [
    "wrong pair",
    (r) => {
      r[1].pair = "other";
    },
  ],
])
  test(`comparison rejects ${name}`, () => {
    const r = rows(() => "passed");
    change(r);
    assert.throws(() => summarizeFreshness(r));
  });
