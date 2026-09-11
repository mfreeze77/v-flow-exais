/**
 * AFM-010 — installation contract and runtime diagnostics.
 *
 * Reports missing or broken runtimes and native dependencies *before* a render
 * is attempted, so an expensive capture does not die halfway through with a
 * confusing error.
 *
 * Two false-positive paths were found in review and are closed here, because
 * both turned "probably fine" into a green result:
 *
 *   1. The browser check only tested for file existence. A wrong-version or
 *      non-executable file passed as the pinned shell, and an invalid explicit
 *      override was concealed by silently validating the fallback instead.
 *   2. `which` succeeding was treated as "executable". When a binary was found
 *      but its version probe failed, the path was substituted and the check
 *      reported ok.
 *
 * Discovery and successful execution are now recorded separately, every probe
 * is bounded by a timeout, and an explicit override is never replaced by a
 * fallback. Diagnostics stay read-only: nothing here installs anything.
 */

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

/**
 * The tested runtime contract.
 *
 * Node 22 is the tested floor: every inherited package that declares an engine
 * requires >=22 and the image is built on node:22-bookworm-slim. Note that a
 * package's own engine field describes that package, not the workspace — the
 * binding statement for the combined product is this contract, together with
 * the recorded image identity in provenance/runtime-contract.json.
 *
 * chrome-headless-shell is pinned because each Chrome stable bump shifts pixel
 * output enough to fail PSNR against the golden baselines.
 */
export const RUNTIME_CONTRACT = {
  node: { minimumMajor: 22 },
  bun: { minimum: "1.3.13" },
  chromeHeadlessShell: { pinned: "148.0.7778.167" },
} as const;

/** Probes must not hang a diagnostic run. */
export const PROBE_TIMEOUT_MS = 10_000;

export type CheckSeverity = "required" | "render-only";
export type CheckState = "ok" | "missing" | "not-executable" | "probe-failed" | "unsupported";

export interface RuntimeCheck {
  name: string;
  severity: CheckSeverity;
  state: CheckState;
  /** Where the binary was found. Discovery only — never proof it runs. */
  discoveredAt: string | null;
  /** Version string from a *successful* execution, or null. */
  executedVersion: string | null;
  expected: string;
  remediation?: string;
}

export interface RuntimeReport {
  scope: string;
  checks: RuntimeCheck[];
  canBuild: boolean;
  canRender: boolean;
}

export interface ProbeResult {
  ok: boolean;
  stdout: string;
  reason?: "not-found" | "nonzero-exit" | "timeout" | "spawn-error";
}

/**
 * Runs a bounded version probe. Distinguishes every failure mode rather than
 * collapsing them to null, so the caller can report an actionable reason.
 */
export function probe(
  command: string,
  args: string[],
  timeoutMs = PROBE_TIMEOUT_MS,
): ProbeResult {
  try {
    const stdout = execFileSync(command, args, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
    });
    return { ok: true, stdout: stdout.trim() };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { status?: number; signal?: string };
    if (err.code === "ENOENT") return { ok: false, stdout: "", reason: "not-found" };
    if (err.code === "ETIMEDOUT" || err.signal === "SIGKILL")
      return { ok: false, stdout: "", reason: "timeout" };
    if (typeof err.status === "number" && err.status !== 0)
      return { ok: false, stdout: "", reason: "nonzero-exit" };
    return { ok: false, stdout: "", reason: "spawn-error" };
  }
}

export function majorVersion(text: string | null): number | null {
  if (!text) return null;
  const match = /(\d+)/.exec(text);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

export function meetsMinimum(actual: string | null, minimum: string): boolean {
  if (!actual) return false;
  const parse = (v: string) =>
    (/(\d+)\.(\d+)\.(\d+)/.exec(v) ?? []).slice(1, 4).map((n) => Number.parseInt(n, 10));
  const a = parse(actual);
  const b = parse(minimum);
  if (a.length < 3 || b.length < 3) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return true;
}

export function checkNode(actual: string | null = process.version): RuntimeCheck {
  const major = majorVersion(actual);
  const required = RUNTIME_CONTRACT.node.minimumMajor;
  const ok = major !== null && major >= required;
  return {
    name: "node",
    severity: "required",
    state: ok ? "ok" : "unsupported",
    discoveredAt: process.execPath,
    executedVersion: actual,
    expected: `>=${required}`,
    remediation: ok
      ? undefined
      : `Node ${major ?? "unknown"} is below the tested floor of ${required}. Run inside the container (docker compose run --rm workspace).`,
  };
}

/**
 * Checks a binary by running it, not by locating it. `which` succeeding proves
 * a path exists; it does not prove the file is executable or functional.
 */
export function checkExecutable(
  name: string,
  args: string[],
  severity: CheckSeverity,
  remediation: string,
  runner: (command: string, args: string[]) => ProbeResult = probe,
): RuntimeCheck {
  const result = runner(name, args);
  if (result.ok) {
    return {
      name,
      severity,
      state: "ok",
      discoveredAt: name,
      executedVersion: result.stdout.split("\n")[0]!.trim() || null,
      expected: "present and executable",
    };
  }

  const state: CheckState = result.reason === "not-found" ? "missing" : "probe-failed";
  const because =
    result.reason === "not-found"
      ? "not found on PATH"
      : result.reason === "timeout"
        ? `version probe exceeded ${PROBE_TIMEOUT_MS}ms`
        : result.reason === "nonzero-exit"
          ? "version probe exited non-zero"
          : "could not be executed";

  return {
    name,
    severity,
    state,
    discoveredAt: null,
    executedVersion: null,
    expected: "present and executable",
    remediation: `${name} ${because}. ${remediation}`,
  };
}

/**
 * Verifies the pinned headless shell by executing it and comparing versions.
 *
 * An explicitly configured path is authoritative: if it is set and invalid, the
 * check fails rather than quietly validating a different binary. Substituting a
 * fallback would report the renderer is fine while it is configured to use
 * something that is not.
 */
export function checkHeadlessShell(
  envPath: string | undefined = process.env.PRODUCER_HEADLESS_SHELL_PATH,
  runner: (command: string, args: string[]) => ProbeResult = probe,
): RuntimeCheck {
  const pinned = RUNTIME_CONTRACT.chromeHeadlessShell.pinned;
  const base = {
    name: "chrome-headless-shell",
    severity: "render-only" as const,
    expected: `pinned ${pinned}, executable`,
  };

  const fallback = `/root/.cache/puppeteer/chrome-headless-shell/linux-${pinned}/chrome-headless-shell-linux64/chrome-headless-shell`;
  const explicit = typeof envPath === "string" && envPath.length > 0;
  const candidate = explicit ? envPath : fallback;

  let stats;
  try {
    stats = statSync(candidate);
  } catch {
    return {
      ...base,
      state: "missing",
      discoveredAt: null,
      executedVersion: null,
      remediation: explicit
        ? `PRODUCER_HEADLESS_SHELL_PATH points at ${candidate}, which does not exist. An explicit override is never replaced by a fallback: fix the path or unset it.`
        : `No headless shell at ${candidate}. The container image installs the pinned build; do not substitute system Chromium, whose different build shifts pixel output enough to fail the golden baselines.`,
    };
  }

  if (!stats.isFile()) {
    return {
      ...base,
      state: "not-executable",
      discoveredAt: candidate,
      executedVersion: null,
      remediation: `${candidate} is not a regular file. Expected the chrome-headless-shell binary.`,
    };
  }

  const result = runner(candidate, ["--version"]);
  if (!result.ok) {
    return {
      ...base,
      state: result.reason === "timeout" ? "probe-failed" : "not-executable",
      discoveredAt: candidate,
      executedVersion: null,
      remediation:
        result.reason === "timeout"
          ? `${candidate} did not respond to --version within ${PROBE_TIMEOUT_MS}ms.`
          : `${candidate} exists but could not be executed (${result.reason}).`,
    };
  }

  const reported = result.stdout.split("\n")[0]!.trim();
  if (!reported.includes(pinned)) {
    return {
      ...base,
      state: "unsupported",
      discoveredAt: candidate,
      executedVersion: reported,
      remediation: `Expected pinned ${pinned} but the binary reports "${reported}". Golden baselines are version-specific: a different build fails PSNR. Bump the pin and regenerate baselines in one commit, or restore the pinned build.`,
    };
  }

  return { ...base, state: "ok", discoveredAt: candidate, executedVersion: reported };
}

export function runtimeReport(
  runner: (command: string, args: string[]) => ProbeResult = probe,
): RuntimeReport {
  const bunProbe = runner("bun", ["--version"]);
  const bunVersion = bunProbe.ok ? bunProbe.stdout.split("\n")[0]!.trim() : null;
  const bunOk = bunProbe.ok && meetsMinimum(bunVersion, RUNTIME_CONTRACT.bun.minimum);

  const checks: RuntimeCheck[] = [
    checkNode(),
    {
      name: "bun",
      severity: "required",
      state: !bunProbe.ok ? (bunProbe.reason === "not-found" ? "missing" : "probe-failed") : bunOk ? "ok" : "unsupported",
      discoveredAt: bunProbe.ok ? "bun" : null,
      executedVersion: bunVersion,
      expected: `>=${RUNTIME_CONTRACT.bun.minimum}`,
      remediation: bunOk
        ? undefined
        : `Bun ${RUNTIME_CONTRACT.bun.minimum} is the tested version and produced the lockfile. Run inside the container.`,
    },
    checkExecutable(
      "ffmpeg",
      ["-version"],
      "render-only",
      "It encodes the rendered frames; the container image provides it.",
      runner,
    ),
    checkExecutable(
      "ffprobe",
      ["-version"],
      "render-only",
      "It verifies a produced file's streams, dimensions and frame rate. Without it a render can only be assumed, not checked.",
      runner,
    ),
    checkHeadlessShell(undefined, runner),
  ];

  const bad = (c: RuntimeCheck) => c.state !== "ok";
  return {
    scope:
      "Runtime and native dependency diagnostics (AFM-010). Executes each dependency to verify it works; installs nothing.",
    checks,
    canBuild: !checks.filter((c) => c.severity === "required").some(bad),
    canRender: !checks.some(bad),
  };
}

export function formatReport(report: RuntimeReport): string {
  const lines: string[] = [];
  for (const check of report.checks) {
    const mark = check.state === "ok" ? "ok  " : "FAIL";
    lines.push(
      `  [${mark}] ${check.name.padEnd(22)} ${check.executedVersion ?? check.discoveredAt ?? "(not found)"}`,
    );
    if (check.state !== "ok") lines.push(`         state: ${check.state}`);
    if (check.remediation) lines.push(`         ${check.remediation}`);
  }
  lines.push("");
  lines.push(`  can build:  ${report.canBuild}`);
  lines.push(`  can render: ${report.canRender}`);
  return lines.join("\n");
}
