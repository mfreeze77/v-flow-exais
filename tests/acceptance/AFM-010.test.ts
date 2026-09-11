/**
 * AFM-010 — tested installation contract and runtime diagnostics.
 *
 * Acceptance:
 *   - A frozen-lockfile install succeeds on the declared test matrix.
 *   - Missing runtimes or native dependencies are reported before attempting a
 *     render.
 *   - No claim that any Node >=18 installation runs the combined product.
 *
 * The negative cases below exist because an earlier version of the doctor
 * passed all of them: it checked for file existence rather than executing
 * anything, and treated "found on PATH" as "works".
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import {
  checkExecutable,
  checkHeadlessShell,
  checkNode,
  extractVersion,
  meetsMinimum,
  probe,
  runtimeReport,
  RUNTIME_CONTRACT,
  PROBE_TIMEOUT_MS,
  type ProbeResult,
} from "../../tools/doctor/runtime.ts";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "afm010-"));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** A runner stub, so failure modes are exercised without real broken binaries. */
const stub = (result: ProbeResult) => () => result;

describe("AFM-010: the runtime contract is declared, not assumed", () => {
  it("requires Node 22 across the workspace", () => {
    expect(RUNTIME_CONTRACT.node.minimumMajor).toBe(22);
    const root = JSON.parse(readFileSync("package.json", "utf8"));
    expect(root.engines.node).toBe(">=22");
    expect(root.engines.bun).toBe(">=1.3.13");
  });

  it("makes no Node >=18 claim anywhere in the workspace", () => {
    // The diagram engine inherited >=18 from Archify. That was true of Archify
    // alone and false of the combined product, which is the claim this ticket
    // forbids. Note this is a support-policy statement: a package's engine
    // field describes that package, and does not by itself explain any build
    // failure.
    const engine = JSON.parse(readFileSync("packages/diagram-engine/package.json", "utf8"));
    expect(engine.engines.node).toBe(">=22");
  });

  it("pins the headless shell version used for deterministic capture", () => {
    expect(RUNTIME_CONTRACT.chromeHeadlessShell.pinned).toBe("148.0.7778.167");
  });

  it("compares versions correctly", () => {
    expect(meetsMinimum("1.3.13", "1.3.13")).toBe(true);
    expect(meetsMinimum("1.4.0", "1.3.13")).toBe(true);
    expect(meetsMinimum("1.3.12", "1.3.13")).toBe(false);
    expect(meetsMinimum(null, "1.3.13")).toBe(false);
  });
});

describe("AFM-010: this environment satisfies the contract", () => {
  it("reports a usable build and render environment", () => {
    const report = runtimeReport();
    const failing = report.checks.filter((c) => c.state !== "ok");
    expect(failing.map((c) => `${c.name}:${c.state}`)).toEqual([]);
    expect(report.canBuild).toBe(true);
    expect(report.canRender).toBe(true);
  }, 120_000);

  it("records an executed version for every dependency, not just a path", () => {
    // The old implementation could report ok with only a pathname. A check that
    // passed without executing anything proved nothing.
    for (const check of runtimeReport().checks) {
      expect(check.executedVersion).toBeTruthy();
    }
  }, 120_000);

  it("confirms the running headless shell is the pinned build", () => {
    const check = checkHeadlessShell();
    expect(check.state).toBe("ok");
    expect(check.executedVersion).toContain(RUNTIME_CONTRACT.chromeHeadlessShell.pinned);
  }, 60_000);
});

describe("AFM-010: a located-but-broken binary fails", () => {
  it("fails when the version probe exits non-zero", () => {
    // Previously: which() found it, version() returned null, the path was
    // substituted and the check reported ok.
    const check = checkExecutable(
      "ffmpeg",
      ["-version"],
      "render-only",
      "hint",
      stub({ ok: false, stdout: "", reason: "nonzero-exit" }),
    );
    expect(check.state).toBe("probe-failed");
    expect(check.executedVersion).toBeNull();
    expect(check.remediation).toContain("exited non-zero");
  });

  it("fails when the version probe times out", () => {
    const check = checkExecutable(
      "ffprobe",
      ["-version"],
      "render-only",
      "hint",
      stub({ ok: false, stdout: "", reason: "timeout" }),
    );
    expect(check.state).toBe("probe-failed");
    expect(check.remediation).toContain(`${PROBE_TIMEOUT_MS}ms`);
  });

  it("reports missing separately from broken", () => {
    const check = checkExecutable(
      "ffmpeg",
      ["-version"],
      "render-only",
      "hint",
      stub({ ok: false, stdout: "", reason: "not-found" }),
    );
    expect(check.state).toBe("missing");
    expect(check.discoveredAt).toBeNull();
  });

  it("never reports ok without a successful execution", () => {
    for (const reason of ["not-found", "nonzero-exit", "timeout", "spawn-error"] as const) {
      const check = checkExecutable(
        "x",
        [],
        "render-only",
        "hint",
        stub({ ok: false, stdout: "", reason }),
      );
      expect(check.state).not.toBe("ok");
      expect(check.executedVersion).toBeNull();
    }
  });

  it("fails a probe that exits zero but prints nothing", () => {
    // Exiting successfully is not answering. This previously reported ok with
    // executedVersion null - a green result carrying no evidence.
    const check = checkExecutable(
      "ffmpeg",
      ["-version"],
      "render-only",
      "hint",
      stub({ ok: true, stdout: "" }),
    );
    expect(check.state).toBe("probe-failed");
    expect(check.executedVersion).toBeNull();
    expect(check.remediation).toContain("no version output");
  });

  it("bounds a real probe with a timeout", () => {
    const started = Date.now();
    const result = probe("sleep", ["30"], 1_000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("timeout");
    // Must return near the timeout, not after the full sleep.
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 30_000);
});

describe("AFM-010: the headless shell is verified, not merely located", () => {
  it("fails when the path does not exist", () => {
    const check = checkHeadlessShell(join(tmp, "nope", "chrome-headless-shell"));
    expect(check.state).toBe("missing");
    expect(check.executedVersion).toBeNull();
  });

  it("fails when the path is a directory rather than a binary", () => {
    const dir = join(tmp, "as-directory");
    mkdirSync(dir, { recursive: true });
    const check = checkHeadlessShell(dir);
    expect(check.state).toBe("not-executable");
  });

  it("fails when the binary cannot be executed", () => {
    const file = join(tmp, "not-executable");
    writeFileSync(file, "#!/bin/sh\nexit 1\n");
    chmodSync(file, 0o644);
    const check = checkHeadlessShell(file, stub({ ok: false, stdout: "", reason: "spawn-error" }));
    expect(check.state).toBe("not-executable");
    expect(check.executedVersion).toBeNull();
  });

  it("fails when the binary reports the wrong version", () => {
    // The critical case: a real, working browser of the wrong build. It exists,
    // it runs, and it would silently shift pixel output against the baselines.
    const file = join(tmp, "wrong-version");
    writeFileSync(file, "#!/bin/sh\necho wrong\n");
    chmodSync(file, 0o755);
    const check = checkHeadlessShell(
      file,
      stub({ ok: true, stdout: "Chrome Headless Shell 131.0.6778.85" }),
    );
    expect(check.state).toBe("unsupported");
    expect(check.executedVersion).toContain("131.0.6778.85");
    expect(check.remediation).toContain(RUNTIME_CONTRACT.chromeHeadlessShell.pinned);
  });

  it("fails when the probe hangs", () => {
    const file = join(tmp, "hangs");
    writeFileSync(file, "#!/bin/sh\nsleep 600\n");
    chmodSync(file, 0o755);
    const check = checkHeadlessShell(file, stub({ ok: false, stdout: "", reason: "timeout" }));
    expect(check.state).toBe("probe-failed");
  });

  it("never conceals an invalid explicit override behind the fallback", () => {
    // The old code took the first existing candidate, so a broken explicit
    // override was masked by validating the default path instead - reporting
    // the renderer healthy while it was configured to use something else.
    const check = checkHeadlessShell(join(tmp, "explicitly-wrong"));
    expect(check.state).toBe("missing");
    expect(check.remediation).toContain("explicit override is never replaced");
  });

  it("rejects a longer version that merely contains the pin", () => {
    // "148.0.7778.1670" contains "148.0.7778.167" but is a different build.
    // A substring comparison accepted it; golden baselines are build-specific.
    const file = join(tmp, "longer");
    writeFileSync(file, "#!/bin/sh");
    chmodSync(file, 0o755);
    const check = checkHeadlessShell(
      file,
      stub({ ok: true, stdout: "Google Chrome for Testing 148.0.7778.1670" }),
    );
    expect(check.state).toBe("unsupported");
    expect(check.executedVersion).toContain("1670");
  });

  it("rejects a banner with no parsable version", () => {
    const file = join(tmp, "nover");
    writeFileSync(file, "#!/bin/sh");
    chmodSync(file, 0o755);
    const check = checkHeadlessShell(file, stub({ ok: true, stdout: "Chrome Headless Shell" }));
    expect(check.state).toBe("unsupported");
    expect(check.remediation).toContain("no parsable version");
  });

  it("extracts full dotted versions and compares by equality", () => {
    expect(extractVersion("Google Chrome for Testing 148.0.7778.167")).toBe("148.0.7778.167");
    expect(extractVersion("Google Chrome for Testing 148.0.7778.1670")).toBe("148.0.7778.1670");
    expect(extractVersion("no digits here")).toBeNull();
  });

  it("accepts the pinned version when it actually runs", () => {
    const pinned = RUNTIME_CONTRACT.chromeHeadlessShell.pinned;
    const file = join(tmp, "correct");
    writeFileSync(file, "#!/bin/sh\n");
    chmodSync(file, 0o755);
    const check = checkHeadlessShell(
      file,
      stub({ ok: true, stdout: `Chrome Headless Shell ${pinned}` }),
    );
    expect(check.state).toBe("ok");
    expect(check.executedVersion).toContain(pinned);
  });
});

describe("AFM-010: unsupported runtimes are rejected", () => {
  it("rejects Node below the tested floor", () => {
    const check = checkNode(stub({ ok: true, stdout: "v18.20.4" }));
    expect(check.state).toBe("unsupported");
    expect(check.remediation).toContain("below the tested floor");
  });

  it("accepts Node at or above the floor", () => {
    expect(checkNode(stub({ ok: true, stdout: "v22.23.2" })).state).toBe("ok");
    expect(checkNode(stub({ ok: true, stdout: "v24.3.0" })).state).toBe("ok");
  });

  it("probes the real node binary rather than process.version", () => {
    // Under `bun run`, process.version reports Bun's Node-compatibility version
    // (v24.3.0), not the installed Node. Reading it made the doctor report a
    // version no binary on the system had, contradicting the runtime contract.
    const check = checkNode();
    const contract = JSON.parse(readFileSync("provenance/runtime-contract.json", "utf8"));
    expect(check.executedVersion).toBe(contract.tested.node);
  }, 30_000);

  it("fails when the node binary cannot be executed", () => {
    const check = checkNode(stub({ ok: false, stdout: "", reason: "not-found" }));
    expect(check.state).toBe("missing");
    expect(check.executedVersion).toBeNull();
  });

  it("marks a required failure as unable to build", () => {
    const report = runtimeReport(stub({ ok: false, stdout: "", reason: "not-found" }));
    expect(report.canBuild).toBe(false);
    expect(report.canRender).toBe(false);
  });
});
