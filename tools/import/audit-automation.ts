/**
 * AFM-005 — Quarantine inherited publication, hooks and deployment.
 *
 * Audits the imported tree for automation that could execute or publish under
 * upstream identities: workflow triggers, package publication config, lifecycle
 * scripts, installed git hooks, registry/bucket/telemetry references and agent
 * hook configuration.
 *
 * The motivating failure is real and was observed during AFM-003: removing the
 * root `prepare` script was not enough, because the `lefthook` dependency
 * installs git hooks from its own postinstall. An audit that only reads
 * package.json would have reported clean while hooks were live.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type Severity = "blocked" | "review" | "ok";

export interface AutomationFinding {
  code:
    | "live-workflow"
    | "installed-git-hook"
    | "lifecycle-script"
    | "publish-config"
    | "registry-reference"
    | "auto-update"
    | "agent-hook-config";
  severity: Severity;
  path: string;
  detail: string;
}

export interface AutomationAudit {
  scope: string;
  findings: AutomationFinding[];
  summary: { blocked: number; review: number; ok: number };
  /** True when nothing can publish, deploy or execute without a later decision. */
  quarantined: boolean;
}

/** Lifecycle scripts that run automatically on install or publish. */
const DANGEROUS_LIFECYCLE = [
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepublish",
  "prepublishOnly",
  "prepack",
  "postpack",
  "publish",
  "postpublish",
];

/**
 * A lifecycle script that provably does nothing is not a finding. Upstream uses
 * `echo skip` as a deliberate no-op in five packages.
 */
function isInertScript(value: string): boolean {
  return /^\s*(echo\b[^&|;]*|true|:)\s*$/.test(value);
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "_sources",
  "dist",
  "build",
  "coverage",
  ".import-staging",
]);

function walk(root: string, onFile: (abs: string, rel: string) => void): void {
  const recurse = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(dir, name);
      let stats;
      try {
        stats = statSync(abs);
      } catch {
        continue;
      }
      if (stats.isDirectory()) recurse(abs);
      else onFile(abs, relative(root, abs).split(sep).join("/"));
    }
  };
  recurse(root);
}

/**
 * Scans the repository. `docs/upstream/` is deliberately excluded from
 * "live" checks: quarantined material is expected to contain workflow text,
 * and flagging it would make the audit permanently red for no reason.
 */
export function auditAutomation(root: string): AutomationAudit {
  const findings: AutomationFinding[] = [];

  // 1. Live workflows. Anything here runs on push/tag once a remote exists.
  const workflows = join(root, ".github/workflows");
  if (existsSync(workflows)) {
    for (const name of readdirSync(workflows)) {
      if (!/\.ya?ml$/.test(name)) continue;
      findings.push({
        code: "live-workflow",
        severity: "blocked",
        path: `.github/workflows/${name}`,
        detail: "Workflow is live: push or tag events could publish or deploy",
      });
    }
  }

  // 2. Installed git hooks. core.hooksPath redirection is what makes these
  //    inert, so report them as review rather than assuming they run.
  const hooksDir = join(root, ".git/hooks");
  if (existsSync(hooksDir)) {
    for (const name of readdirSync(hooksDir)) {
      if (name.endsWith(".sample")) continue;
      findings.push({
        code: "installed-git-hook",
        severity: "review",
        path: `.git/hooks/${name}`,
        detail: "Hook present in .git/hooks; inert only while core.hooksPath is redirected",
      });
    }
  }

  // 3. Manifests: lifecycle scripts and publication config.
  walk(root, (abs, rel) => {
    if (!rel.endsWith("package.json")) return;
    if (rel.startsWith("docs/upstream/")) return;

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      return;
    }

    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    for (const key of DANGEROUS_LIFECYCLE) {
      const value = scripts[key];
      if (typeof value !== "string") continue;
      if (isInertScript(value)) continue;
      findings.push({
        code: "lifecycle-script",
        severity: key === "prepublishOnly" || key.includes("pack") ? "review" : "blocked",
        path: rel,
        detail: `${key}: ${value}`,
      });
    }

    const publishConfig = pkg.publishConfig as Record<string, unknown> | undefined;
    if (publishConfig && pkg.private !== true) {
      const access = publishConfig.access;
      if (access === "public") {
        findings.push({
          code: "publish-config",
          severity: "review",
          path: rel,
          detail: `publishConfig.access=public for ${String(pkg.name)}; publication requires explicit authorization`,
        });
      }
    }
  });

  // 4. Auto-update and agent hook configuration.
  for (const candidate of [
    "lefthook.yml",
    "lefthook.yaml",
    ".husky",
    "renovate.json",
    ".github/renovate.json",
  ]) {
    const abs = join(root, candidate);
    if (!existsSync(abs)) continue;
    findings.push({
      code: candidate.includes("renovate") ? "auto-update" : "agent-hook-config",
      severity: "review",
      path: candidate,
      detail: candidate.includes("renovate")
        ? "Dependency auto-update config; inert without the app installed on a remote"
        : "Git hook manager config retained for review; hooks are redirected via core.hooksPath",
    });
  }

  const summary = {
    blocked: findings.filter((f) => f.severity === "blocked").length,
    review: findings.filter((f) => f.severity === "review").length,
    ok: findings.filter((f) => f.severity === "ok").length,
  };

  return {
    scope:
      "Inherited automation audit. Reports what could execute or publish; " +
      "does not itself disable anything.",
    findings,
    summary,
    quarantined: summary.blocked === 0,
  };
}

/**
 * Reads the effective git hooks path. Hooks in .git/hooks are inert when this
 * points elsewhere, which is how AFM-005 neutralises dependency-installed hooks
 * without deleting upstream configuration.
 */
export function effectiveHooksPath(root: string): string | null {
  const config = join(root, ".git/config");
  if (!existsSync(config)) return null;
  const match = /^\s*hooksPath\s*=\s*(.+)$/m.exec(readFileSync(config, "utf8"));
  return match ? match[1]!.trim() : null;
}
