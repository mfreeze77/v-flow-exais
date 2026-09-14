/** Actual Node/Git parent+child execution with an explicitly fake Puppeteer package.
 * Verifies sequencing and evidence gating, not a real server, browser or product.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const files = [
  "managed-studio.mjs",
  "managed-studio-probe.mjs",
  "managed-studio-diagnostics.mjs",
  "managed-freshness-mode.mjs",
  "managed-freshness-contract.mjs",
  "managed-studio-freshness-compare.mjs",
  "managed-startup-probe.mjs",
  "managed-startup-process.mjs",
];
function setup() {
  const home = mkdtempSync(join(tmpdir(), "vflow-freshness-process-"));
  const repo = join(home, "repo"),
    scripts = join(repo, "packages/studio/tests/e2e");
  mkdirSync(scripts, { recursive: true });
  for (const name of files) cpSync(join(here, name), join(scripts, name));
  const provider = join(repo, "node_modules/puppeteer-core");
  mkdirSync(provider, { recursive: true });
  writeFileSync(
    join(provider, "package.json"),
    JSON.stringify({ name: "puppeteer-core", type: "module", exports: "./index.mjs" }),
  );
  cpSync(join(here, "fixtures/freshness-puppeteer.mjs"), join(provider, "index.mjs"));
  const git = (args) => execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
  git(["init", "-q"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["config", "user.name", "Diagnostic fixture"]);
  git(["add", "."]);
  git(["commit", "-qm", "isolated test fixture"]);
  const shell = join(home, "fake-browser");
  writeFileSync(shell, "TEST DOUBLE ONLY");
  const state = join(home, "state.json"),
    trace = join(home, "trace.jsonl");
  const env = {
    ...process.env,
    VFLOW_FRESHNESS_TEST_STATE: state,
    VFLOW_FRESHNESS_TEST_TRACE: trace,
  };
  const run = (name, args, additions = {}) =>
    spawnSync(process.execPath, [join(scripts, name), ...args], {
      cwd: repo,
      env: { ...env, ...additions },
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  return {
    home,
    repo,
    scripts,
    shell,
    state,
    trace,
    env,
    run,
    close: () => rmSync(home, { recursive: true, force: true }),
  };
}
for (const [pattern, interpretation, code] of [
  ["pass", "baseline-failure-not-reproduced", 2],
  ["fail", "failure-not-isolated-to-these-dimensions", 2],
  ["fresh-fail", "repeatable-startup-difference", 0],
  ["prime-fix", "repeatable-startup-difference", 0],
])
  test(`real worker pipeline with fake ${pattern} transport: ${interpretation}`, () => {
    const f = setup();
    try {
      const output = join(f.home, "out");
      const result = f.run(
        "managed-studio-freshness-compare.mjs",
        [
          "--base-url",
          "http://127.0.0.1:5190",
          "--headless-shell",
          f.shell,
          "--output",
          output,
          "--allow-create-test-projects",
          "4",
        ],
        { VFLOW_FRESHNESS_TEST_PATTERN: pattern },
      );
      assert.equal(
        result.status,
        code,
        `${result.stderr}\n${result.stdout}\n${result.error ?? ""}`,
      );
      const summary = JSON.parse(readFileSync(join(output, "comparison.json")));
      assert.equal(summary.interpretation, interpretation);
      assert.equal(summary.status, "diagnostic-only");
      assert.equal(summary.acceptance.editing, "not-run");
      assert.equal(summary.observations.length, 8);
      assert.equal(summary.retainedFixtures.length, 4);
      assert.equal(JSON.parse(readFileSync(f.state)).imports, 4);
      for (const row of summary.observations) {
        const raw = JSON.parse(readFileSync(join(output, row.directory, "harness/result.json")));
        assert.equal(raw.status, "diagnostic-only");
        assert.deepEqual(raw.steps, []);
        assert(raw.phases.slice(2).every((p) => p.status === "not-run"));
        assert.match(raw.verificationEnvironment.browser, /^FakeBrowser\//);
      }
    } finally {
      f.close();
    }
  });

test("post-mount content drift stops remaining workers and imports", () => {
  const f = setup();
  try {
    const output = join(f.home, "out");
    const result = f.run(
      "managed-studio-freshness-compare.mjs",
      ["--headless-shell", f.shell, "--output", output, "--allow-create-test-projects", "4"],
      { VFLOW_FRESHNESS_TEST_PATTERN: "drift" },
    );
    assert.equal(result.status, 1, result.stderr);
    const summary = JSON.parse(readFileSync(join(output, "comparison.json")));
    assert.equal(summary.interpretation, "invalid-comparison");
    assert.equal(summary.remaining.length, 7);
    assert.equal(JSON.parse(readFileSync(f.state)).imports, 1);
  } finally {
    f.close();
  }
});

test("the fresh control does not call editor view before its original mount wait", () => {
  const f = setup();
  try {
    const result = f.run("managed-studio.mjs", [
      "--headless-shell",
      f.shell,
      "--output",
      join(f.home, "out"),
      "--allow-create-test-project",
      "--startup-only",
    ]);
    assert.equal(result.status, 2, result.stderr);
    const trace = readFileSync(f.trace, "utf8").trim().split("\n").map(JSON.parse);
    const wait = trace.findIndex((e) => e.event === "waitFunction");
    assert(wait > 0);
    assert.deepEqual(
      trace
        .slice(0, wait)
        .filter((e) => e.event === "fetch")
        .map((e) => `${e.method} ${e.path}`),
      ["POST /api/vflow/import-diagram", "GET /api/vflow/projects/PROJECT"],
    );
    assert.equal(trace[wait].options.timeout, 60000);
    assert.equal(trace[wait].options.polling, undefined);
    assert.equal(
      trace.filter((e) => e.event === "fetch" && e.path.endsWith("/editor/previews")).length,
      0,
    );
  } finally {
    f.close();
  }
});

test("preflight arm changes exactly one request before mount, without preparing a preview", () => {
  const f = setup();
  try {
    const result = f.run("managed-studio.mjs", [
      "--headless-shell",
      f.shell,
      "--output",
      join(f.home, "out"),
      "--allow-create-test-project",
      "--startup-only",
      "--startup-editor-preflight",
    ]);
    assert.equal(result.status, 2, result.stderr);
    const trace = readFileSync(f.trace, "utf8").trim().split("\n").map(JSON.parse);
    const wait = trace.findIndex((e) => e.event === "waitFunction");
    assert.deepEqual(
      trace
        .slice(0, wait)
        .filter((e) => e.event === "fetch")
        .map((e) => `${e.method} ${e.path}`),
      [
        "POST /api/vflow/import-diagram",
        "GET /api/vflow/projects/PROJECT",
        "GET /api/vflow/projects/PROJECT/editor",
      ],
    );
  } finally {
    f.close();
  }
});

test("reuse without startup-only fails before starting a browser or importing", () => {
  const f = setup();
  try {
    const result = f.run("managed-studio.mjs", [
      "--headless-shell",
      f.shell,
      "--output",
      join(f.home, "out"),
      "--reuse-project",
      "video-existing",
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /diagnostic-only/);
  } finally {
    f.close();
  }
});
