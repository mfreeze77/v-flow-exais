import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  DECLARED_REMOVALS,
  ledgerTargets,
  reconcile,
  trackedFiles,
} from "./check-import-reconciliation.mjs";

/** A throwaway repository with a ledger, so removals can be staged for real. */
function repo(files, ledgerPaths) {
  const root = mkdtempSync(join(tmpdir(), "reconcile-"));
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Reconciliation Tests");
  git("config", "user.email", "reconcile@example.test");

  mkdirSync(join(root, "provenance"), { recursive: true });
  writeFileSync(
    join(root, "provenance/import-map.json"),
    JSON.stringify({
      entries: ledgerPaths.map((path) => ({
        targetPath: path,
        disposition: "retain-relocate-refactor-as-owned",
      })),
    }),
  );

  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  git("add", "-A");
  git("commit", "-qm", "fixture");
  return { root, git };
}

describe("import reconciliation — the failure that prompted this check", () => {
  it("fails when a ledger file stops being tracked without a declaration", () => {
    // The symlink `render-symlinked-assets/src/shared` was added correctly in
    // AFM-003 and removed by AFM-005, a commit about git hooks. Nothing in the
    // review surfaced it, because git on Windows cannot stat that path and
    // `git add -A` therefore stages it as deleted.
    const { root, git } = repo({ "a.txt": "a\n", "b.txt": "b\n" }, ["a.txt", "b.txt"]);
    git("rm", "-q", "b.txt");
    git("commit", "-qm", "an unrelated change that also dropped b.txt");

    const report = reconcile({ root, removals: [] });
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.undeclared.map((u) => u.path),
      ["b.txt"],
    );
  });

  it("passes when the same removal is declared with a reason", () => {
    const { root, git } = repo({ "a.txt": "a\n", "b.txt": "b\n" }, ["a.txt", "b.txt"]);
    git("rm", "-q", "b.txt");
    git("commit", "-qm", "deliberate removal");

    const report = reconcile({
      root,
      removals: [{ path: "b.txt", reason: "Deliberately removed, with a recorded reason." }],
    });
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.ok, true);
  });

  it("flags a declaration that no longer matches reality", () => {
    // A stale declaration is worse than none: it would absorb a future real
    // deletion of the same path and report nothing.
    const { root } = repo({ "a.txt": "a\n" }, ["a.txt"]);
    const report = reconcile({
      root,
      removals: [{ path: "a.txt", reason: "Claimed removed, but still tracked." }],
    });
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.ok, false);
    assert.deepEqual(report.resurrected, ["a.txt"]);
  });

  it("flags a declaration for a path the ledger never placed", () => {
    const { root } = repo({ "a.txt": "a\n" }, ["a.txt"]);
    const report = reconcile({
      root,
      removals: [{ path: "never-imported.txt", reason: "Not from the import at all." }],
    });
    rmSync(root, { recursive: true, force: true });

    assert.equal(report.ok, false);
    assert.deepEqual(report.unusedDeclarations, ["never-imported.txt"]);
  });
});

describe("import reconciliation — the real repository", () => {
  it("accounts for every file the import placed", () => {
    const report = reconcile();
    assert.deepEqual(report.undeclared, [], "a ledger file is untracked with no declared reason");
    assert.deepEqual(report.resurrected, []);
    assert.deepEqual(report.unusedDeclarations, []);
  });

  it("still tracks the symlink as a symlink, not as a regular file", () => {
    // Restoring it as a 100644 blob containing the text "../shared" would make
    // this check pass while leaving the working tree wrong.
    const entry = execFileSync(
      "git",
      ["ls-files", "-s", "packages/producer/tests/render-symlinked-assets/src/shared"],
      { encoding: "utf8" },
    ).trim();
    assert.match(entry, /^120000 /, `expected a symlink entry, got: ${entry || "(absent)"}`);
  });

  it("gives every declared removal a substantive reason", () => {
    for (const { path, reason } of DECLARED_REMOVALS) {
      assert.ok(reason && reason.length >= 40, `${path} needs a real reason, not a placeholder`);
    }
  });

  it("reads a ledger and a tracked set that are both non-trivial", () => {
    // Guards against the check passing because it compared two empty sets.
    assert.ok(ledgerTargets().size > 7000);
    assert.ok(trackedFiles().size > 7000);
  });
});
