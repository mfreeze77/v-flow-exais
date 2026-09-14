import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { MANAGED_JOURNEY_PHASES } from "./managed-studio-diagnostics.mjs";
const here = dirname(fileURLToPath(import.meta.url));

/** Actual parent and child Node processes. The child journey and tool versions
 * are deliberate fixtures. Any browser launch or export after rejection fails. */
for (const scenario of [
  "child-failed",
  "status-failed",
  "empty-phases",
  "missing-phase",
  "duplicate-phase",
  "unrun-phase",
  "foreign-id",
]) {
  test(`delivery stops without rendering when ${scenario}`, () => {
    const home = mkdtempSync(join(tmpdir(), "vflow-delivery-stop-"));
    try {
      for (const name of [
        "managed-studio-delivery.mjs",
        "managed-delivery-contract.mjs",
        "managed-studio-diagnostics.mjs",
        "managed-studio-probe.mjs",
      ])
        copyFileSync(join(here, name), join(home, name));
      const pkg = join(home, "node_modules/puppeteer-core");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        join(pkg, "package.json"),
        JSON.stringify({ type: "module", exports: "./index.mjs" }),
      );
      writeFileSync(
        join(pkg, "index.mjs"),
        `import {writeFileSync} from 'node:fs';export default {launch(){writeFileSync(${JSON.stringify(join(home, "LAUNCHED"))},'bad');throw Error('must not launch')}};`,
      );
      const phases = MANAGED_JOURNEY_PHASES.map((name) => ({ name, status: "passed" }));
      if (scenario === "missing-phase") phases.pop();
      if (scenario === "duplicate-phase") phases[1] = { ...phases[0] };
      if (scenario === "unrun-phase") phases[1].status = "not-run";
      const outcome = {
        status: scenario === "status-failed" ? "failed" : "passed",
        projectId: scenario === "foreign-id" ? "../../existing" : "video-aabbcc",
        phases: scenario === "empty-phases" ? [] : phases,
      };
      writeFileSync(
        join(home, "managed-studio.mjs"),
        `import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';const dir=process.argv[process.argv.indexOf('--output')+1];mkdirSync(dir);writeFileSync(join(dir,'result.json'),${JSON.stringify(JSON.stringify(outcome))});process.exitCode=${scenario === "child-failed" ? 1 : 0};`,
      );
      const tool = join(home, "version-tool");
      writeFileSync(tool, "#!/bin/sh\nprintf 'controlled-version\\n'\n", { mode: 0o700 });
      const output = join(home, "output");
      const run = spawnSync(
        process.execPath,
        [
          join(home, "managed-studio-delivery.mjs"),
          "--allow-create-test-project",
          "--headless-shell",
          "/unused",
          "--ffmpeg",
          tool,
          "--ffprobe",
          tool,
          "--output",
          output,
        ],
        { encoding: "utf8", timeout: 10000 },
      );
      assert.equal(run.status, 1, run.stderr);
      const evidence = JSON.parse(readFileSync(join(output, "result.json"), "utf8"));
      assert.equal(evidence.status, "failed");
      assert.equal(evidence.editingJourney, "failed");
      assert.equal(evidence.export, "not-run");
      assert.equal(evidence.probe, "not-run");
      assert.equal(existsSync(join(home, "LAUNCHED")), false);
      assert.equal(existsSync(join(output, "managed-studio.mp4")), false);
      assert.equal(
        evidence.commands.filter((command) => command.name === "editing-journey").length,
        1,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
}
