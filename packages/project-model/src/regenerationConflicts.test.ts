import { it } from "vitest";
import assert from "node:assert/strict";
import type { ProjectSnapshot, RegenerationConflict } from "./project";
import {
  assertCommandOutcome,
  outcomeForCommand,
  regenerationConflictProblems,
  rememberOrphanedIntents,
  restoredTargetOrder,
} from "./regenerationConflicts";
import { conflictProjectFixture } from "./regenerationConflicts.fixture";

const event = (): RegenerationConflict => ({
  kind: "orphaned-target",
  sceneId: "first",
  targetId: "edge-b",
  field: "relationshipIds",
  detail: "The animated relationship was removed. No replacement was inferred.",
});
function prepared() {
  const snapshot = conflictProjectFixture();
  const requested = structuredClone(snapshot.manifest.scenes);
  snapshot.manifest.revision = 1;
  snapshot.manifest.scenes[0]!.presentation.relationshipIds = ["edge-a"];
  rememberOrphanedIntents(snapshot, [event()], requested, "remove-edge");
  return { snapshot, requested };
}

it("stores original ordered intent separately from active targets", () => {
  const { snapshot } = prepared();
  assert.deepEqual(snapshot.manifest.scenes[0]!.presentation.relationshipIds, ["edge-a"]);
  assert.deepEqual(snapshot.manifest.regenerationConflicts![0]!.originalTargets, [
    "edge-a",
    "edge-b",
  ]);
  assert.equal(snapshot.manifest.regenerationConflicts![0]!.documentId, "diagram");
});
it("roundtrips the complete persistent record as project JSON", () => {
  const { snapshot } = prepared();
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
});
it("does not add an empty extension to untouched legacy projects", () => {
  const snapshot = conflictProjectFixture();
  const before = JSON.stringify(snapshot);
  rememberOrphanedIntents(snapshot, [], snapshot.manifest.scenes, "no-conflicts");
  assert.equal(JSON.stringify(snapshot), before);
});
it("does not alias event or requested-scene arrays", () => {
  const snapshot = conflictProjectFixture();
  snapshot.manifest.revision = 1;
  const scenes = structuredClone(snapshot.manifest.scenes);
  const incident = event();
  rememberOrphanedIntents(snapshot, [incident], scenes, "one");
  incident.detail = "mutated";
  scenes[0]!.presentation.relationshipIds.length = 0;
  assert.notEqual(snapshot.manifest.regenerationConflicts![0]!.detail, "mutated");
  assert.equal(snapshot.manifest.regenerationConflicts![0]!.originalTargets.length, 2);
});
it("preserves records through unrelated later revisions", () => {
  const { snapshot } = prepared();
  const old = structuredClone(snapshot.manifest.regenerationConflicts);
  snapshot.manifest.revision = 2;
  rememberOrphanedIntents(snapshot, [], snapshot.manifest.scenes, "later");
  assert.deepEqual(snapshot.manifest.regenerationConflicts, old);
});
it("records two scene appearances independently", () => {
  const snapshot = conflictProjectFixture();
  snapshot.manifest.scenes.push({
    ...structuredClone(snapshot.manifest.scenes[0]!),
    id: "second",
    startFrame: 180,
  });
  snapshot.manifest.revision = 1;
  rememberOrphanedIntents(
    snapshot,
    [event(), { ...event(), sceneId: "second" }],
    snapshot.manifest.scenes,
    "one",
  );
  const records = snapshot.manifest.regenerationConflicts!;
  assert.equal(new Set(records.map((item) => item.id)).size, 2);
  assert.deepEqual(
    records.map((item) => item.sceneId),
    ["first", "second"],
  );
});
it("fails before publication when an event has no scene", () => {
  const snapshot = conflictProjectFixture();
  assert.throws(() =>
    rememberOrphanedIntents(snapshot, [{ ...event(), sceneId: "missing" }], [], "one"),
  );
  assert.equal(snapshot.manifest.regenerationConflicts, undefined);
});
it("does not manufacture original intent for an unknown target", () => {
  const snapshot = conflictProjectFixture();
  assert.throws(() =>
    rememberOrphanedIntents(
      snapshot,
      [{ ...event(), targetId: "unknown" }],
      snapshot.manifest.scenes,
      "one",
    ),
  );
  assert.equal(snapshot.manifest.regenerationConflicts, undefined);
});
it("rejects a repeated mint at the same revision instead of changing IDs", () => {
  const { snapshot, requested } = prepared();
  const old = JSON.stringify(snapshot);
  assert.throws(
    () => rememberOrphanedIntents(snapshot, [event()], requested, "remove-edge"),
    /collision/,
  );
  assert.equal(JSON.stringify(snapshot), old);
});
it("accepts contextual records even after the original source target returns", () => {
  assert.deepEqual(regenerationConflictProblems(prepared().snapshot), []);
});
for (const [name, mutate] of [
  [
    "duplicate record id",
    (s: ProjectSnapshot) =>
      s.manifest.regenerationConflicts!.push(
        structuredClone(s.manifest.regenerationConflicts![0]!),
      ),
  ],
  [
    "missing scene",
    (s: ProjectSnapshot) => {
      s.manifest.regenerationConflicts![0]!.sceneId = "missing";
    },
  ],
  [
    "wrong document",
    (s: ProjectSnapshot) => {
      s.manifest.regenerationConflicts![0]!.documentId = "other";
    },
  ],
  [
    "future revision",
    (s: ProjectSnapshot) => {
      s.manifest.regenerationConflicts![0]!.detectedRevision = 99;
    },
  ],
  [
    "lost original target",
    (s: ProjectSnapshot) => {
      s.manifest.regenerationConflicts![0]!.originalTargets = ["edge-a"];
    },
  ],
] as const) {
  it(`rejects ${name} in persisted state`, () => {
    const { snapshot } = prepared();
    mutate(snapshot);
    assert.ok(regenerationConflictProblems(snapshot).length > 0);
  });
}
it("derives the original event outcome from persisted records", () => {
  const { snapshot } = prepared();
  const outcome = outcomeForCommand(snapshot, "remove-edge");
  assert.deepEqual(outcome, { schemaVersion: 1, conflicts: [event()] });
  assertCommandOutcome(outcome);
});
it("does not re-emit earlier incidents for a later unrelated command", () => {
  const { snapshot } = prepared();
  snapshot.manifest.revision = 2;
  assert.deepEqual(outcomeForCommand(snapshot, "later"), { schemaVersion: 1, conflicts: [] });
  assert.deepEqual(outcomeForCommand(snapshot, "remove-edge").conflicts, []);
});
it("does not alias a returned event into durable state", () => {
  const { snapshot } = prepared();
  outcomeForCommand(snapshot, "remove-edge").conflicts[0]!.detail = "mutated";
  assert.equal(snapshot.manifest.regenerationConflicts![0]!.detail, event().detail);
});
it("validates an explicitly recorded empty outcome", () => {
  assertCommandOutcome({ schemaVersion: 1, conflicts: [] });
});
for (const [name, value] of [
  ["absent legacy data", undefined],
  ["array", []],
  ["missing counts", {}],
  ["wrong version", { schemaVersion: 2, conflicts: [] }],
  ["unknown root field", { schemaVersion: 1, conflicts: [], extra: 1 }],
  ["null event", { schemaVersion: 1, conflicts: [null] }],
  ["unknown event field", { schemaVersion: 1, conflicts: [{ ...event(), extra: 1 }] }],
  ["invalid target id", { schemaVersion: 1, conflicts: [{ ...event(), targetId: "bad\n" }] }],
  ["wrong intent field", { schemaVersion: 1, conflicts: [{ ...event(), field: "position" }] }],
] as const) {
  it(`rejects ${name} as a recorded command outcome`, () =>
    assert.throws(() => assertCommandOutcome(value)));
}
for (const [name, active, original, target, expected] of [
  ["between surviving neighbors", ["a", "c"], ["a", "b", "c"], "b", ["a", "b", "c"]],
  ["at start", ["b"], ["a", "b"], "a", ["a", "b"]],
  ["at end", ["a"], ["a", "b"], "b", ["a", "b"]],
  ["into empty list", [], ["a", "b"], "b", ["b"]],
  ["without duplicating", ["a", "b"], ["a", "b"], "b", ["a", "b"]],
  ["keeping newly added targets", ["x", "c"], ["a", "b", "c"], "b", ["x", "b", "c"]],
] as const) {
  it(`restores ${name}`, () =>
    assert.deepEqual(restoredTargetOrder(active, original, target), expected));
}
it("restores two removed targets in reverse action order without swapping authored order", () => {
  const first = restoredTargetOrder(["c"], ["a", "b", "c"], "b");
  assert.deepEqual(restoredTargetOrder(first, ["a", "b", "c"], "a"), ["a", "b", "c"]);
});
it("rejects restoration of an unpreserved target", () => {
  assert.throws(() => restoredTargetOrder(["a"], ["a", "b"], "c"));
});

it("refuses ambiguous ordering instead of moving surviving targets", () => {
  assert.throws(
    () => restoredTargetOrder(["c", "a"], ["a", "b", "c"], "b"),
    /repair it explicitly/,
  );
});
