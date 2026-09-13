import { afterEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import { nativeTitle } from "../../packages/studio-server/src/project/videoProposals";
import { projectApiError } from "../../packages/studio-server/src/project/projectApiError";
import {
  createManagedJournal,
  type JournalCommand,
} from "../../packages/studio/src/project/managedJournal";
import { readCommittedProject } from "../../packages/project-model/src/storage/revisions";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
async function fixture() {
  const home = mkdtempSync(join(tmpdir(), "afm-072-journal-"));
  dirs.push(home);
  const service = new UnifiedProjectService({ home, sourceRoots: [] });
  const { id } = await service.importDiagram({
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title: "Mixed", viewBox: [900, 570], legend: { mode: "hidden" } },
    components: [
      { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
      { id: "api", type: "backend", label: "API", pos: [320, 80], size: [180, 70] },
    ],
    connections: [{ id: "edge-a", from: "gateway", to: "api" }],
    cards: [],
  });
  const sent: JournalCommand[] = [];
  let loseAck = false,
    failRead = false,
    seq = 0;
  const send = async (cmd: JournalCommand) => {
    sent.push(structuredClone(cmd));
    let result;
    try {
      result = await service.command(id, cmd);
    } catch (error) {
      const mapped = projectApiError(error);
      throw Object.assign(new Error(mapped.body.error), { status: mapped.status });
    }
    if (loseAck) {
      loseAck = false;
      throw new Error("simulated lost HTTP acknowledgement AFTER the real commit");
    }
    return result;
  };
  const authority = createManagedJournal({
    projectId: id,
    read: async () => {
      if (failRead) throw new Error("read failed");
      return service.get(id);
    },
    send,
    newCommandId: () => `journal-${++seq}`,
  });
  authority.activate();
  await authority.refresh();
  const state = () => service.get(id).snapshot;
  const edit = (title = "Edited") =>
    authority.commitEdit({
      label: "Title",
      kind: "manual",
      files: {
        "title.html": {
          before: String(state().sources.title),
          after: nativeTitle(title, "Journal owned"),
        },
      },
    });
  return {
    id,
    home,
    service,
    authority,
    state,
    edit,
    sent,
    loseNextAck: () => {
      loseAck = true;
    },
    failReads: () => {
      failRead = true;
    },
  };
}

describe("AFM-072 real project journal through the editor authority", () => {
  it("a native edit adds one revision and one undo entry", async () => {
    const f = await fixture();
    await f.edit();
    const current = readCommittedProject(f.service.root(f.id));
    assert.equal(current.pointer.revision, 1);
    assert.equal(current.index.history?.undo.length, 1);
    assert.equal(f.sent.length, 1);
    assert.match(String(current.snapshot.sources.title), /Edited/);
  });
  it("combines native and semantic source changes in one source transaction", async () => {
    const f = await fixture();
    const before = f.state();
    const diagram = structuredClone(before.sources.diagram) as any;
    diagram.components[1].label = "Orders API";
    await f.authority.commitEdit({
      label: "Mixed source",
      kind: "source",
      files: {
        "title.html": {
          before: String(before.sources.title),
          after: nativeTitle("Orders", "One transaction"),
        },
        "source.architecture.json": {
          before: JSON.stringify(before.sources.diagram),
          after: JSON.stringify(diagram),
        },
      },
    });
    assert.equal(f.state().manifest.revision, 1);
    assert.equal(f.sent[0]?.operations.length, 2);
    await f.authority.undo();
    assert.equal((f.state().sources.diagram as any).components[1].label, "API");
    assert.doesNotMatch(String(f.state().sources.title), />Orders</);
  });
  it("interleaves semantic/native edits and undoes/redoes in actual user order", async () => {
    const f = await fixture();
    await f.service.command(f.id, {
      commandId: "semantic",
      projectId: f.id,
      origin: "ui",
      expectedRevision: 0,
      operations: [
        { type: "rename-object", documentId: "diagram", objectId: "api", label: "Orders" },
      ],
    });
    await f.authority.refresh();
    await f.edit();
    await f.authority.undo();
    assert.doesNotMatch(String(f.state().sources.title), />Edited</);
    assert.equal((f.state().sources.diagram as any).components[1].label, "Orders");
    await f.authority.undo();
    assert.equal((f.state().sources.diagram as any).components[1].label, "API");
    await f.authority.redo();
    await f.authority.redo();
    assert.equal((f.state().sources.diagram as any).components[1].label, "Orders");
    assert.match(String(f.state().sources.title), /Edited/);
  });
  it("lost acknowledgement replays the stored result without a second revision", async () => {
    const f = await fixture();
    f.loseNextAck();
    await assert.rejects(f.edit(), /lost HTTP/);
    const first = readCommittedProject(f.service.root(f.id)).pointer;
    await f.authority.retryPending();
    const second = readCommittedProject(f.service.root(f.id)).pointer;
    assert.deepEqual(second, first);
    assert.deepEqual(f.sent[1], f.sent[0]);
  });
  it("a failed compiler validation publishes no edit or history", async () => {
    const f = await fixture();
    const before = readCommittedProject(f.service.root(f.id)).pointer;
    await assert.rejects(
      f.authority.commitEdit({
        label: "Invalid",
        kind: "manual",
        files: {
          "title.html": { before: String(f.state().sources.title), after: "not a composition" },
        },
      }),
    );
    assert.deepEqual(readCommittedProject(f.service.root(f.id)).pointer, before);
  });
  it("post-commit read failure does not turn a saved edit into a rollback", async () => {
    const f = await fixture();
    f.failReads();
    await f.edit();
    assert.equal(f.state().manifest.revision, 1);
    assert.equal(f.sent.length, 1);
    assert.match(f.authority.getSnapshot().refreshError!, /Change saved/);
  });
  it("compiler output cannot be edited through the native gateway", async () => {
    const f = await fixture();
    const before = readCommittedProject(f.service.root(f.id)).pointer;
    await assert.rejects(
      f.authority.commitEdit({
        label: "Generated",
        kind: "manual",
        files: {
          "scene-1-diagram-scene.html": { before: "", after: nativeTitle("Bad", "Bad") },
        },
      }),
    );
    assert.deepEqual(readCommittedProject(f.service.root(f.id)).pointer, before);
    assert.equal(f.sent.length, 0);
  });
  it("reopening the editor reloads real persisted history without adding an edit", async () => {
    const f = await fixture();
    await f.edit();
    const before = readCommittedProject(f.service.root(f.id)).pointer;
    const reopened = new UnifiedProjectService({ home: f.home, sourceRoots: [] });
    const authority = createManagedJournal({
      projectId: f.id,
      read: async () => reopened.get(f.id),
      send: (cmd) => reopened.command(f.id, cmd),
    });
    authority.activate();
    await authority.refresh();
    assert.equal(authority.getSnapshot().canUndo, true);
    assert.deepEqual(readCommittedProject(f.service.root(f.id)).pointer, before);
    await authority.undo();
    assert.doesNotMatch(String(reopened.get(f.id).snapshot.sources.title), />Edited</);
  });
});
