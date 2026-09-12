import { afterEach, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import { conflictProjectFixture } from "../../packages/project-model/src/regenerationConflicts.fixture";
import type { ProjectCommand, ProjectOperation } from "../../packages/project-model/src/commands";
import type { DiagramSource } from "../../packages/project-model/src/project";
import {
  readCommittedProject,
  canonicalJson,
  sha256,
} from "../../packages/project-model/src/storage/revisions";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});
async function setup() {
  const home = mkdtempSync(join(tmpdir(), "afm-073-conflicts-"));
  homes.push(home);
  const service = new UnifiedProjectService({ home, sourceRoots: [] });
  const initial = conflictProjectFixture();
  const id = await service.create(initial);
  return { service, home, id, initial };
}
function deletion(service: UnifiedProjectService, id: string): ProjectCommand {
  const current = service.get(id).snapshot;
  const source = structuredClone(current.sources.diagram) as DiagramSource;
  source.connections = (source.connections as { id: string }[]).filter(
    (edge) => edge.id !== "edge-b",
  );
  return {
    commandId: "delete-edge",
    origin: "ui",
    projectId: id,
    expectedRevision: current.manifest.revision,
    operations: [{ type: "replace-diagram-source", documentId: "diagram", source }],
  };
}
async function edit(service: UnifiedProjectService, id: string, operations: ProjectOperation[]) {
  const revision = service.get(id).snapshot.manifest.revision;
  return service.command(id, {
    commandId: `edit-${revision}`,
    origin: "ui",
    projectId: id,
    expectedRevision: revision,
    operations,
  });
}
it("reopens with preserved intent and active targets still quarantined", async () => {
  const { service, home, id } = await setup();
  const result = await service.command(id, deletion(service, id));
  const reopened = new UnifiedProjectService({ home, sourceRoots: [] }).get(id);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflictOutcomeRecorded, true);
  assert.equal(reopened.unresolvedConflicts.length, 1);
  assert.deepEqual(reopened.unresolvedConflicts[0]!.originalTargets, ["edge-a", "edge-b"]);
  assert.deepEqual(reopened.snapshot.manifest.scenes[0]!.presentation.relationshipIds, ["edge-a"]);
  assert.equal(reopened.snapshot.manifest.revision, result.pointer.revision);
});
it("retries return the original outcome after later edits without re-execution", async () => {
  const { service, home, id } = await setup();
  const command = deletion(service, id);
  const first = await service.command(id, command);
  await edit(service, id, [{ type: "set-project-title", title: "Later edit" }]);
  const reopened = new UnifiedProjectService({ home, sourceRoots: [] });
  const before = reopened.get(id).snapshot;
  const replay = await reopened.command(id, command);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.pointer, first.pointer);
  assert.deepEqual(replay.conflicts, first.conflicts);
  assertSameValue(replay.snapshot, first.snapshot);
  assertSameValue(reopened.get(id).snapshot, before);
});
it("concurrent duplicate commands publish one revision and the same original conflicts", async () => {
  const { service, id } = await setup();
  const command = deletion(service, id);
  const settled = await Promise.allSettled([
    service.command(id, command),
    service.command(id, command),
  ]);
  const results = settled.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
  const a = results[0]!;
  const b = results[1]!;
  assert.deepEqual(a.pointer, b.pointer);
  assert.deepEqual(a.conflicts, b.conflicts);
  assert.deepEqual([a.replayed, b.replayed].sort(), [false, true]);
  assert.equal(service.get(id).snapshot.manifest.revision, 1);
  assert.equal(service.get(id).unresolvedConflicts.length, 1);
});
it("explicit discard keeps the source deletion and has normal undo/redo", async () => {
  const { service, id } = await setup();
  await service.command(id, deletion(service, id));
  const before = service.get(id).snapshot;
  const conflictId = before.manifest.regenerationConflicts![0]!.id;
  await edit(service, id, [{ type: "discard-regeneration-conflict", conflictId }]);
  assert.equal(service.get(id).unresolvedConflicts.length, 0);
  assert.deepEqual(service.get(id).snapshot.sources, before.sources);
  await edit(service, id, [{ type: "undo" }]);
  assert.deepEqual(service.get(id).unresolvedConflicts, before.manifest.regenerationConflicts);
  assert.deepEqual(service.get(id).snapshot.sources, before.sources);
  await edit(service, id, [{ type: "redo" }]);
  assert.equal(service.get(id).unresolvedConflicts.length, 0);
});
it("replaying an old deletion after discard does not resurrect its conflict", async () => {
  const { service, id } = await setup();
  const command = deletion(service, id);
  const first = await service.command(id, command);
  await edit(service, id, [
    {
      type: "discard-regeneration-conflict",
      conflictId: service.get(id).unresolvedConflicts[0]!.id,
    },
  ]);
  const replay = await service.command(id, command);
  assert.deepEqual(replay.conflicts, first.conflicts);
  assert.equal(service.get(id).unresolvedConflicts.length, 0);
});
it("restoration refuses a still-missing authored target without changing state", async () => {
  const { service, id } = await setup();
  await service.command(id, deletion(service, id));
  const before = service.get(id).snapshot;
  await assert.rejects(
    edit(service, id, [
      {
        type: "restore-regeneration-conflict",
        conflictId: service.get(id).unresolvedConflicts[0]!.id,
      },
    ]),
    /original authored target/,
  );
  assert.deepEqual(service.get(id).snapshot, before);
});
it("source repair and original-intent restoration are one undoable transaction", async () => {
  const { service, id, initial } = await setup();
  await service.command(id, deletion(service, id));
  const before = service.get(id).snapshot;
  await edit(service, id, [
    {
      type: "replace-diagram-source",
      documentId: "diagram",
      source: initial.sources.diagram as DiagramSource,
    },
    {
      type: "restore-regeneration-conflict",
      conflictId: service.get(id).unresolvedConflicts[0]!.id,
    },
  ]);
  assert.equal(service.get(id).unresolvedConflicts.length, 0);
  assert.deepEqual(service.get(id).snapshot.manifest.scenes[0]!.presentation.relationshipIds, [
    "edge-a",
    "edge-b",
  ]);
  await edit(service, id, [{ type: "undo" }]);
  assert.deepEqual(service.get(id).snapshot.sources, before.sources);
  assert.deepEqual(service.get(id).unresolvedConflicts, before.manifest.regenerationConflicts);
});
it("does not silently quarantine a newly requested unauthored target", async () => {
  const { service, id } = await setup();
  const before = service.get(id).snapshot;
  await assert.rejects(
    edit(service, id, [
      {
        type: "set-scene-presentation",
        sceneId: "first",
        presentation: { title: "Invalid", focusObjectIds: ["not-authored"], relationshipIds: [] },
      },
    ]),
    /unauthored target/,
  );
  assert.deepEqual(service.get(id).snapshot, before);
});
it("rejects unknown conflict IDs and stale revisions", async () => {
  const { service, id } = await setup();
  await service.command(id, deletion(service, id));
  const before = service.get(id).snapshot;
  await assert.rejects(
    edit(service, id, [{ type: "discard-regeneration-conflict", conflictId: "unknown" }]),
    /does not exist/,
  );
  await assert.rejects(
    service.command(id, {
      commandId: "stale",
      origin: "ui",
      projectId: id,
      expectedRevision: 0,
      operations: [
        {
          type: "discard-regeneration-conflict",
          conflictId: service.get(id).unresolvedConflicts[0]!.id,
        },
      ],
    }),
    /revision/i,
  );
  assert.deepEqual(service.get(id).snapshot, before);
});
/**
 * Compares by value, ignoring prototypes.
 *
 * The revision reader builds `sources` with `Object.create(null)` as a
 * deliberate prototype-pollution defence, and `node:assert/strict` compares
 * prototypes — so a read-back snapshot never deep-equals a plain literal even
 * when every value matches. These assertions are about content.
 */
function assertSameValue(actual: unknown, expected: unknown): void {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)));
}

it("undoing and redoing deletion restores source and conflict state together", async () => {
  const { service, id, initial } = await setup();
  await service.command(id, deletion(service, id));
  const records = service.get(id).unresolvedConflicts;
  await edit(service, id, [{ type: "undo" }]);
  assertSameValue(service.get(id).snapshot.sources, initial.sources);
  assert.equal(service.get(id).unresolvedConflicts.length, 0);
  await edit(service, id, [{ type: "redo" }]);
  assertSameValue(service.get(id).unresolvedConflicts, records);
});
it("tampering with a stored conflict is caught by the existing manifest hash", async () => {
  const { service, id } = await setup();
  await service.command(id, deletion(service, id));
  const root = service.root(id);
  const stored = readCommittedProject(root);
  const path = join(root, ".vflow/revisions", stored.pointer.directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.regenerationConflicts = [];
  writeFileSync(path, JSON.stringify(manifest));
  assert.throws(() => service.get(id), /modified outside/);
});
it("legacy receipts without outcomes remain readable and are explicitly unrecorded", async () => {
  const { service, id } = await setup();
  const command: ProjectCommand = {
    commandId: "legacy",
    origin: "ui",
    projectId: id,
    expectedRevision: 0,
    operations: [{ type: "set-project-title", title: "Legacy" }],
  };
  await service.command(id, command);
  // Make a self-consistent legacy fixture, not corrupted bytes: old indexes lacked outcome.
  const root = service.root(id);
  const current = readCommittedProject(root);
  const indexPath = join(root, ".vflow/revisions", current.pointer.directory, "index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  delete index.command.outcome;
  const bytes = canonicalJson(index);
  writeFileSync(indexPath, bytes);
  writeFileSync(
    join(root, ".vflow/CURRENT"),
    canonicalJson({ ...current.pointer, sha256: sha256(bytes) }),
  );
  const replay = await service.command(id, command);
  assert.equal(replay.replayed, true);
  assert.equal(replay.conflictOutcomeRecorded, false);
  assert.deepEqual(replay.conflicts, []);
  assert.equal(service.get(id).snapshot.manifest.revision, 1);
});
