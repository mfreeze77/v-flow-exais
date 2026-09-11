/**
 * AFM-010 — installation contract and runtime diagnostics.
 *
 * Reports missing runtimes and native dependencies *before* a render is
 * attempted. A render that dies halfway through because ffprobe is absent
 * wastes the expensive part and reports a confusing error; this reports the
 * real problem up front, names the exact requirement, and says how to fix it.
 *
 * Deliberately does not "helpfully" install anything. Initial downloads are an
 * approved setup step, not something a diagnostic performs behind the user.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * The tested runtime contract.
 *
 * Node 22 is not a preference. Every HyperFrames package that declares an
 * engine requires >=22, and the container image is built on node:22-bookworm.
 * Archify declared >=18, which was true of Archify alone and false of the
 * combined product — AFM-010 exists partly to stop that claim being inherited.
 *
 * chrome-headless-shell is pinned because each Chrome stable bump shifts pixel
 * output enough to fail PSNR against the golden baselines.
 */
export const RUNTIME_CONTRACT = {
  node: { minimumMajor: 22, testedMajor: 22 },
  bun: { minimum: "1.3.13", tested: "1.3.13" },
  chromeHeadlessShell: { pinned: "148.0.7778.167" },
} as const;

export type CheckSeverity = "required" | "render-only" | "optional";
export type CheckState = "ok" | "missing" | "unsupported" | "unknown";

export interface RuntimeCheck {
  name: string;
  severity: CheckSeverity;
  state: CheckState;
  /** What was actually found, or null when absent. */
  found: string | null;
  /** What is required. */
  expected: string;
  /** Concrete next step when not ok. */
  remediation?: string;
}

export interface RuntimeReport {
  scope: string;
  checks: RuntimeCheck[];
  /** True when everything required to build and run is present. */
  canBuild: boolean;
  /** True when everything required to produce a video is present. */
  canRender: boolean;
}

function which(command: string): string | null {
  try {
    const out = execFileSync(process.platform === "win32" ? "where" : "which", [command], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    const first = out.split(/\r?\n/).find((line) => line.trim().length > 0);
    return first ? first.trim() : null;
  } catch {
    return null;
  }
}

function version(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    })
      .split(/\r?\n/)[0]!
      .trim();
  } catch {
    return null;
  }
}

/** Extracts the leading integer of a version string, e.g. "v22.23.2" -> 22. */
export function majorVersion(text: string | null): number | null {
  if (!text) return null;
  const match = /(\d+)/.exec(text);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

/** Compares dotted versions. Returns true when `actual` >= `minimum`. */
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
  return {
    name: "node",
    severity: "required",
    state: major === null ? "unknown" : major >= required ? "ok" : "unsupported",
    found: actual,
    expected: `>=${required}`,
    remediation:
      major !== null && major < required
        ? `Node ${major} is below the tested floor. Every package that declares an engine requires >=${required}; run inside the container (docker compose run --rm workspace) or install Node ${required}.`
        : undefined,
  };
}

export function checkBun(actual: string | null): RuntimeCheck {
  const ok = meetsMinimum(actual, RUNTIME_CONTRACT.bun.minimum);
  return {
    name: "bun",
    severity: "required",
    state: actual === null ? "missing" : ok ? "ok" : "unsupported",
    found: actual,
    expected: `>=${RUNTIME_CONTRACT.bun.minimum}`,
    remediation: ok
      ? undefined
      : `Bun ${RUNTIME_CONTRACT.bun.tested} is the tested version and the one the lockfile was produced with. Run inside the container rather than installing on the host.`,
  };
}

function binaryCheck(
  name: string,
  args: string[],
  severity: CheckSeverity,
  remediation: string,
): RuntimeCheck {
  const path = which(name);
  const found = path ? (version(name, args) ?? path) : null;
  return {
    name,
    severity,
    state: found ? "ok" : "missing",
    found,
    expected: "present on PATH",
    remediation: found ? undefined : remediation,
  };
}

/**
 * Locates the pinned headless shell. Checked separately from `chromium`
 * because the two are not interchangeable: deterministic BeginFrame capture
 * requires the pinned shell, and silently falling back to system Chromium is
 * how golden baselines drift.
 */
export function checkHeadlessShell(envPath = process.env.PRODUCER_HEADLESS_SHELL_PATH): RuntimeCheck {
  const candidates = [
    envPath,
    `/root/.cache/puppeteer/chrome-headless-shell/linux-${RUNTIME_CONTRACT.chromeHeadlessShell.pinned}/chrome-headless-shell-linux64/chrome-headless-shell`,
  ].filter((c): c is string => typeof c === "string" && c.length > 0);

  const found = candidates.find((c) => existsSync(c)) ?? null;
  return {
    name: "chrome-headless-shell",
    severity: "render-only",
    state: found ? "ok" : "missing",
    found,
    expected: `pinned ${RUNTIME_CONTRACT.chromeHeadlessShell.pinned}`,
    remediation: found
      ? undefined
      : "Deterministic frame capture needs the pinned headless shell; the container image installs it. Do not substitute system Chromium: a different build shifts pixel output enough to fail the golden baselines.",
  };
}

export function runtimeReport(): RuntimeReport {
  const checks: RuntimeCheck[] = [
    checkNode(),
    checkBun(version("bun", ["--version"])),
    binaryCheck(
      "ffmpeg",
      ["-version"],
      "render-only",
      "ffmpeg encodes the rendered frames. The container image provides it; on a host, install ffmpeg and ensure it is on PATH.",
    ),
    binaryCheck(
      "ffprobe",
      ["-version"],
      "render-only",
      "ffprobe verifies the produced file's streams, dimensions and frame rate. Without it a render cannot be checked, only assumed.",
    ),
    checkHeadlessShell(),
  ];

  const bad = (c: RuntimeCheck) => c.state !== "ok";
  return {
    scope:
      "Runtime and native dependency diagnostics (AFM-010). Reports what is missing; installs nothing.",
    checks,
    canBuild: !checks.filter((c) => c.severity === "required").some(bad),
    canRender: !checks.filter((c) => c.severity !== "optional").some(bad),
  };
}

/** Formats a report for a terminal, newest problems first. */
export function formatReport(report: RuntimeReport): string {
  const lines: string[] = [];
  for (const check of report.checks) {
    const mark = check.state === "ok" ? "ok  " : check.state === "missing" ? "MISS" : "BAD ";
    lines.push(`  [${mark}] ${check.name.padEnd(22)} ${check.found ?? "(not found)"}`);
    if (check.remediation) lines.push(`         ${check.remediation}`);
  }
  lines.push("");
  lines.push(`  can build:  ${report.canBuild}`);
  lines.push(`  can render: ${report.canRender}`);
  return lines.join("\n");
}
