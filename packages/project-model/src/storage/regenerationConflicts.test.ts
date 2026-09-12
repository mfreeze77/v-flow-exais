import { afterEach, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyProjectCommand, type ProjectCommand } from "../commands";
import type { DiagramSource, RegenerationConflict } from "../project";
import { conflictProjectFixture } from "../regenerationConflicts.fixture";
import { commitWhileLocked, executeProjectCommand, type CommitFaultPoint } from "./commit";
import { canonicalJson, readCommittedProject, sha256 } from "./revisions";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), "vflow-conflict-commit-"));
  roots.push(root);
  const initial = conflictProjectFixture();
  commitWhileLocked(root, {
    snapshot: initial,
    expectedRevision: null,
    commandId: "initialize",
    fingerprint: sha256(canonicalJson(initial)),
  });
  const source = structuredClone(initial.sources.diagram) as DiagramSource;
  source.connections = (source.connections as { id: string }[]).filter(
    (edge) => edge.id !== "edge-b",
  );
  const command: ProjectCommand = {
    commandId: "remove-edge",
    origin: "ui",
    projectId: initial.manifest.id,
    expectedRevision: 0,
    operations: [{ type: "replace-diagram-source", documentId: "diagram", source }],
  };
  const snapshot = applyProjectCommand(initial, command);
  const request = {
    snapshot,
    expectedRevision: 0,
    commandId: command.commandId,
    fingerprint: sha256(canonicalJson(command)),
  };
  return { root, initial, command, request };
}
/**
 * Compares a committed snapshot by value, ignoring prototypes.
 *
 * `readRevision` and the commit path build `sources` with `Object.create(null)`
 * as a deliberate prototype-pollution defence when reading parsed JSON, and
 * `node:assert/strict` compares prototypes — so a read-back snapshot never
 * deep-equals a plain object literal even when every value matches. Normalising
 * both sides keeps the assertion on content, which is what these fault tests
 * are about, rather than on how the reader allocated its maps.
 */
function assertSameSnapshot(actual: unknown, expected: unknown): void {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)));
}

for (const point of ["after-document", "after-staging", "before-pointer"] as CommitFaultPoint[]) {
  it(`does not publish source or conflict when interrupted ${point}`, () => {
    const { root, initial, request } = setup();
    assert.throws(
      () =>
        commitWhileLocked(root, request, (at) => {
          if (at === point) throw Error("injected");
        }),
      /injected/,
    );
    assertSameSnapshot(readCommittedProject(root).snapshot, initial);
    const result = commitWhileLocked(root, request);
    assert.equal(result.pointer.revision, 1);
    assert.equal(readCommittedProject(root).snapshot.manifest.regenerationConflicts!.length, 1);
  });
}
it("lost acknowledgement after pointer publication replays the stored outcome without another commit", async () => {
  const { root, command, request } = setup();
  assert.throws(
    () =>
      commitWhileLocked(root, request, (at) => {
        if (at === "after-pointer") throw Error("lost reply");
      }),
    /lost reply/,
  );
  const before = readCommittedProject(root);
  assert.equal(before.index.command.outcome!.conflicts.length, 1);
  const conflicts: RegenerationConflict[] = [];
  const retried = await executeProjectCommand(root, command, undefined, conflicts);
  assert.equal(retried.replayed, true);
  assert.deepEqual(retried.pointer, before.pointer);
  assert.deepEqual(conflicts, before.index.command.outcome!.conflicts);
  assert.deepEqual(readCommittedProject(root).pointer, before.pointer);
});
it("does not return tentative conflicts if downstream validation fails", async () => {
  const { root, initial, command } = setup();
  const conflicts: RegenerationConflict[] = [];
  await assert.rejects(
    executeProjectCommand(
      root,
      command,
      () => {
        throw Error("compile failed");
      },
      conflicts,
    ),
    /compile failed/,
  );
  assert.deepEqual(conflicts, []);
  assertSameSnapshot(readCommittedProject(root).snapshot, initial);
});
