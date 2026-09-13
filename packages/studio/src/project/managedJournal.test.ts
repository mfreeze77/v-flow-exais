import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createManagedJournal, type JournalCommand } from "./managedJournal";
import { createJournalWriter, journalForWriter } from "./projectJournalProtocol";
import type { ProjectSnapshot } from "@hyperframes/project-model";

export function journalFixture(): ProjectSnapshot {
  return {
    manifest: {
      schemaVersion: 1,
      id: "project-test",
      title: "Mixed",
      revision: 0,
      documents: [
        { id: "title", kind: "native", path: "title.html", authoritative: true },
        { id: "notes", kind: "native", path: "notes.html", authoritative: true },
        { id: "diagram", kind: "architecture", path: "diagram.json", authoritative: true },
      ],
      scenes: [
        {
          id: "title-scene",
          documentId: "title",
          kind: "native",
          startFrame: 0,
          durationFrames: 60,
          presentation: { title: "Title", focusObjectIds: [], relationshipIds: [] },
        },
        {
          id: "diagram-scene",
          documentId: "diagram",
          kind: "diagram",
          startFrame: 60,
          durationFrames: 90,
          presentation: { title: "Diagram", focusObjectIds: ["a"], relationshipIds: [] },
        },
      ],
      output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
      policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
    },
    sources: {
      title: "<h1>A</h1>\r\n",
      notes: "<p>Notes</p>",
      diagram: {
        schema_version: 1,
        diagram_type: "architecture",
        meta: { title: "Diagram" },
        components: [{ id: "a", label: "A" }],
        connections: [],
      },
    },
  };
}

/** Transport simulator, NOT the product's storage implementation. Service tests live separately. */
function harness() {
  let server = journalFixture();
  let reads = 0,
    ids = 0;
  let readFault: (() => Promise<unknown>) | null = null;
  let sendFault: ((command: JournalCommand) => Promise<unknown>) | null = null;
  const calls: JournalCommand[] = [];
  const undo: ProjectSnapshot[] = [],
    redo: ProjectSnapshot[] = [];
  const receipts = new Map<string, any>();
  const read = async () => {
    reads++;
    if (readFault) return readFault();
    return { snapshot: structuredClone(server), canUndo: !!undo.length, canRedo: !!redo.length };
  };
  const apply = async (command: JournalCommand) => {
    const oldReceipt = receipts.get(command.commandId);
    if (oldReceipt) return { ...structuredClone(oldReceipt), replayed: true };
    if (command.expectedRevision !== server.manifest.revision)
      throw Object.assign(new Error("revision changed"), { status: 409 });
    const before = structuredClone(server);
    const nextRevision = before.manifest.revision + 1;
    const op = command.operations[0] as any;
    if (op.type === "undo") {
      redo.push(before);
      server = structuredClone(undo.pop()!);
    } else if (op.type === "redo") {
      undo.push(before);
      server = structuredClone(redo.pop()!);
    } else {
      undo.push(before);
      redo.length = 0;
      for (const operation of command.operations as any[]) {
        if (operation.type === "replace-native-source")
          server.sources[operation.documentId] = operation.html;
        else if (operation.type === "replace-diagram-source")
          server.sources[operation.documentId] = operation.source;
        else
          throw Object.assign(new Error("unsupported test transport operation"), { status: 400 });
      }
    }
    server.manifest.revision = nextRevision;
    const result = {
      pointer: {
        revision: nextRevision,
        directory: `${nextRevision}-00000000-0000-0000-0000-000000000000`,
        sha256: "a".repeat(64),
      },
      snapshot: structuredClone(server),
      replayed: false,
    };
    receipts.set(command.commandId, structuredClone(result));
    return result;
  };
  const send = async (command: JournalCommand) => {
    calls.push(structuredClone(command));
    return sendFault ? sendFault(command) : apply(command);
  };
  const authority = createManagedJournal({
    projectId: "project-test",
    read,
    send,
    newCommandId: () => `edit-${++ids}`,
  });
  return {
    authority,
    calls,
    read,
    send,
    apply,
    get server() {
      return server;
    },
    get reads() {
      return reads;
    },
    get ids() {
      return ids;
    },
    setRead: (value: typeof readFault) => {
      readFault = value;
    },
    setSend: (value: typeof sendFault) => {
      sendFault = value;
    },
    async open() {
      authority.activate();
      await authority.refresh();
      return this;
    },
    edit(after = "<h1>B</h1>") {
      return authority.commitEdit({
        label: "Edit title",
        kind: "manual",
        files: { "title.html": { before: "<h1>A</h1>\r\n", after } },
      });
    },
  };
}
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("managed journal lifecycle and history authority", () => {
  it("constructs without reading, sending or allocating IDs", () => {
    const h = harness();
    assert.equal(h.reads, 0);
    assert.equal(h.calls.length, 0);
    assert.equal(h.ids, 0);
  });
  it("returns a cached immutable status snapshot", () => {
    const h = harness();
    assert.equal(h.authority.getSnapshot(), h.authority.getSnapshot());
    assert.ok(Object.isFrozen(h.authority.getSnapshot()));
  });
  it("refuses mutations until the session is active and loaded", async () => {
    const h = harness();
    await assert.rejects(h.edit(), /inactive/);
    h.authority.activate();
    await assert.rejects(h.edit(), /not-loaded/);
    assert.equal(h.calls.length, 0);
  });
  it("loads history from the project, not an invented undo entry", async () => {
    const h = await harness().open();
    assert.equal(h.authority.getSnapshot().canUndo, false);
    assert.deepEqual(await h.authority.undo(), { ok: false, reason: "empty" });
    assert.equal(h.calls.length, 0);
  });
  it("one native edit creates one command and one revision", async () => {
    const h = await harness().open();
    await h.edit();
    assert.equal(h.calls.length, 1);
    assert.equal(h.server.manifest.revision, 1);
    assert.equal(h.authority.getSnapshot().canUndo, true);
    assert.equal(h.ids, 1);
  });
  it("undo and redo dispatch history operations, never file replacements", async () => {
    const h = await harness().open();
    await h.edit();
    const result = await h.authority.undo();
    assert.deepEqual(h.calls[1]?.operations, [{ type: "undo" }]);
    assert.equal(result.requiresFullReload, true);
    assert.equal(h.server.sources.title, "<h1>A</h1>\r\n");
    await h.authority.redo();
    assert.deepEqual(h.calls[2]?.operations, [{ type: "redo" }]);
    assert.equal(h.server.sources.title, "<h1>B</h1>");
    assert.equal(h.server.manifest.revision, 3);
  });
  it("a new controller reads the existing journal after reopen", async () => {
    const h = await harness().open();
    await h.edit();
    const reopened = createManagedJournal({
      projectId: "project-test",
      read: h.read,
      send: h.send,
    });
    reopened.activate();
    await reopened.refresh();
    assert.equal(reopened.getSnapshot().canUndo, true);
    await reopened.undo();
    assert.equal(h.server.sources.title, "<h1>A</h1>\r\n");
  });
  it("does not read the latest revision before undoing an observed state", async () => {
    const h = await harness().open();
    await h.edit();
    const before = h.reads;
    h.server.manifest.revision++;
    await assert.rejects(h.authority.undo(), /revision changed/);
    assert.equal(h.reads, before);
    assert.equal(h.calls.at(-1)?.expectedRevision, 1);
  });
  it("supports Strict Mode lease cleanup/reacquisition without permanent disposal", async () => {
    const h = harness();
    const release = h.authority.activate();
    release();
    release();
    h.authority.activate();
    await h.authority.refresh();
    await h.edit();
    assert.equal(h.calls.length, 1);
  });
  it("stale read completion cannot replace a newer loaded state", async () => {
    const h = harness();
    h.authority.activate();
    const first = deferred<unknown>();
    h.setRead(() => first.promise);
    const a = h.authority.refresh();
    h.setRead(null);
    h.server.manifest.revision = 3;
    await h.authority.refresh();
    first.resolve({ snapshot: journalFixture(), canUndo: false, canRedo: false });
    await a;
    assert.equal(h.authority.getSnapshot().revision, 3);
  });
  it("releasing the last lease prevents an old writer from mutating", async () => {
    const h = harness();
    const release = h.authority.activate();
    await h.authority.refresh();
    release();
    await assert.rejects(h.edit(), /inactive/);
    assert.equal(h.calls.length, 0);
  });
  it("an observer exception cannot make a confirmed commit fail", async () => {
    const h = await harness().open();
    h.authority.subscribe(() => {
      throw new Error("observer");
    });
    await h.edit();
    assert.equal(h.server.manifest.revision, 1);
  });
});

describe("ownership and atomic edit validation", () => {
  it("combines two native documents into one command", async () => {
    const h = await harness().open();
    await h.authority.commitEdit({
      label: "Pair",
      kind: "manual",
      files: {
        "title.html": { before: String(h.server.sources.title), after: "<h1>B</h1>" },
        "notes.html": { before: "<p>Notes</p>", after: "<p>New</p>" },
      },
    });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0]?.operations.length, 2);
  });
  it("a stale second document rejects the entire edit before command allocation", async () => {
    const h = await harness().open();
    await assert.rejects(
      h.authority.commitEdit({
        label: "Pair",
        kind: "manual",
        files: {
          "title.html": { before: String(h.server.sources.title), after: "<h1>B</h1>" },
          "notes.html": { before: "wrong", after: "<p>New</p>" },
        },
      }),
      /changed/,
    );
    assert.equal(h.calls.length, 0);
    assert.equal(h.ids, 0);
  });
  it("keeps exact native line endings in the baseline", async () => {
    const h = await harness().open();
    await assert.rejects(
      h.authority.commitEdit({
        label: "Edit",
        kind: "manual",
        files: { "title.html": { before: "<h1>A</h1>\n", after: "B" } },
      }),
      /changed/,
    );
    assert.equal(h.calls.length, 0);
  });
  it("permits an empty expected native document without treating it as omitted", async () => {
    const h = harness();
    h.server.sources.title = "";
    await h.open();
    await h.authority.commitEdit({
      label: "Edit",
      kind: "manual",
      files: { "title.html": { before: "", after: "B" } },
    });
    assert.equal(h.calls.length, 1);
  });
  it("rejects a missing baseline", async () => {
    const h = await harness().open();
    await assert.rejects(
      h.authority.commitEdit({
        label: "Edit",
        kind: "manual",
        files: { "title.html": { after: "B" } },
      } as any),
      /baseline-required/,
    );
    assert.equal(h.calls.length, 0);
  });
  it("rejects a generated filename instead of selecting the first native document", async () => {
    const h = await harness().open();
    await assert.rejects(
      h.authority.commitEdit({
        label: "Edit",
        kind: "manual",
        files: { "scene-0-title-scene.html": { before: "A", after: "B" } },
      }),
      /No authoritative document/,
    );
    assert.equal(h.calls.length, 0);
  });
  it("rejects manual/SDK edits against compiler-owned diagram source", async () => {
    const h = await harness().open();
    const before = JSON.stringify(h.server.sources.diagram);
    await assert.rejects(
      h.authority.commitEdit({
        label: "Edit",
        kind: "manual",
        files: { "diagram.json": { before, after: before } },
      }),
      /compiler-owned/,
    );
    assert.equal(h.calls.length, 0);
  });
  it("accepts explicitly source-owned diagram JSON while keeping its kind", async () => {
    const h = await harness().open();
    const before = JSON.stringify(h.server.sources.diagram);
    const after = structuredClone(h.server.sources.diagram) as any;
    after.components[0].label = "New";
    await h.authority.commitEdit({
      label: "Source",
      kind: "source",
      files: { "diagram.json": { before, after: JSON.stringify(after, null, 2) } },
    });
    // Asserted before indexing: `calls[0]?.operations[0]` throws a TypeError
    // when no command was sent, which reports as a crash rather than as the
    // real failure — that the edit never reached the journal.
    const sent = h.calls[0];
    assert.ok(sent, "the edit should have submitted a command");
    assert.equal((sent.operations[0] as any).type, "replace-diagram-source");
  });
  it("uses value comparison for diagram baselines without ignoring array order", async () => {
    const h = await harness().open();
    const source = h.server.sources.diagram as any;
    const before = JSON.stringify(Object.fromEntries(Object.entries(source).reverse()));
    await h.authority.commitEdit({
      label: "Source",
      kind: "source",
      files: { "diagram.json": { before, after: JSON.stringify(source, null, 2) } },
    });
    assert.equal(h.calls.length, 1);
  });
  it("rejects duplicate document aliases in a single batch", async () => {
    const h = await harness().open();
    const change = { before: String(h.server.sources.title), after: "B" };
    await assert.rejects(
      h.authority.commitEdit({
        label: "Alias",
        kind: "manual",
        files: { "title.html": change, "./title.html": change },
      }),
      /duplicate-document/,
    );
    assert.equal(h.calls.length, 0);
  });
  it("a no-op creates neither a command nor history", async () => {
    const h = await harness().open();
    const value = String(h.server.sources.title);
    assert.deepEqual(
      await h.authority.commitEdit({
        label: "Same",
        kind: "manual",
        files: { "title.html": { before: value, after: value } },
      }),
      [],
    );
    assert.equal(h.ids, 0);
  });
  it("bare managed writer calls fail before touching the transport", async () => {
    const h = await harness().open();
    await assert.rejects(h.authority.writer("title.html", "B", "A"), /atomic-edit-required/);
    assert.equal(h.calls.length, 0);
  });
  it("standalone native-history recording is rejected, not silently added", async () => {
    const h = await harness().open();
    await assert.rejects(
      h.authority.recordEdit({ label: "Wrong", kind: "manual", files: {} }),
      /unowned-record/,
    );
    assert.equal(h.calls.length, 0);
  });
  it("refuses empty and oversized edit batches", async () => {
    const h = await harness().open();
    await assert.rejects(
      h.authority.commitEdit({ label: "Empty", kind: "manual", files: {} }),
      /invalid-edit/,
    );
    const files = Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [`${i}`, { before: "A", after: "B" }]),
    );
    await assert.rejects(
      h.authority.commitEdit({ label: "Huge", kind: "manual", files }),
      /invalid-edit/,
    );
    assert.equal(h.ids, 0);
  });
});

describe("acknowledgements, races, failures and replay", () => {
  it("holds one in-flight action and rejects concurrent authoring rather than rebasing", async () => {
    const h = await harness().open();
    const hold = deferred<unknown>();
    h.setSend(() => hold.promise);
    const first = h.edit();
    await assert.rejects(h.edit("C"), /uncertain|busy/);
    hold.resolve(await h.apply(h.calls[0]!));
    await first;
    assert.equal(h.calls.length, 1);
  });
  it("preserves the exact command identity and payload after a lost acknowledgement", async () => {
    const h = await harness().open();
    h.setSend(async (cmd) => {
      await h.apply(cmd);
      throw new Error("network lost after save");
    });
    await assert.rejects(h.edit(), /network lost/);
    assert.equal(h.server.manifest.revision, 1);
    assert.equal(h.authority.getSnapshot().uncertain, true);
    h.setSend(null);
    await h.authority.retryPending();
    assert.deepEqual(h.calls[0], h.calls[1]);
    assert.equal(h.server.manifest.revision, 1);
    assert.equal(h.ids, 1);
  });
  it("cannot mutate the pending payload through the transport argument", async () => {
    const h = await harness().open();
    h.setSend(async (cmd) => {
      (cmd.operations[0] as any).html = "forged";
      throw new Error("lost");
    });
    await assert.rejects(h.edit(), /lost/);
    h.setSend(null);
    await h.authority.retryPending();
    const retried = h.calls[1];
    assert.ok(retried, "the retry should have submitted the original command again");
    assert.equal((retried.operations[0] as any).html, "<h1>B</h1>");
  });
  it("blocks new edits and reload while the command outcome is unknown", async () => {
    const h = await harness().open();
    h.setSend(async () => {
      throw new Error("timeout");
    });
    await assert.rejects(h.edit());
    await assert.rejects(h.edit("C"), /uncertain/);
    await assert.rejects(h.authority.refresh(), /busy/);
    assert.equal(h.calls.length, 1);
  });
  it("an explicit refusal does not retry or advance the locally observed baseline", async () => {
    const h = await harness().open();
    h.setSend(async () => {
      throw Object.assign(new Error("conflict"), { status: 409 });
    });
    await assert.rejects(h.edit(), /conflict/);
    assert.equal(h.authority.getSnapshot().uncertain, false);
    assert.equal(h.authority.getSnapshot().loaded, false);
    assert.equal(h.calls.length, 1);
  });
  it("treats a server 5xx as an uncertain outcome", async () => {
    const h = await harness().open();
    h.setSend(async () => {
      throw Object.assign(new Error("server"), { status: 500 });
    });
    await assert.rejects(h.edit());
    assert.equal(h.authority.getSnapshot().uncertain, true);
  });
  it("a malformed acknowledgement cannot certify a commit", async () => {
    const h = await harness().open();
    h.setSend(async () => ({ snapshot: h.server }));
    await assert.rejects(h.edit(), /invalid-acknowledgement/);
    assert.equal(h.authority.getSnapshot().uncertain, true);
  });
  it("a response from another project is not published", async () => {
    const h = await harness().open();
    h.setSend(async (cmd) => {
      const r = await h.apply(cmd);
      r.snapshot.manifest.id = "other";
      return r;
    });
    await assert.rejects(h.edit(), /invalid-state/);
    assert.equal(h.authority.getSnapshot().revision, 0);
  });
  it("post-commit read failure reports saved, not failed, and performs no rollback", async () => {
    const h = await harness().open();
    h.setRead(async () => {
      throw new Error("read failed");
    });
    await h.edit();
    assert.equal(h.server.manifest.revision, 1);
    assert.equal(h.calls.length, 1);
    assert.match(h.authority.getSnapshot().refreshError!, /Change saved/);
    assert.equal(h.authority.getSnapshot().uncertain, false);
  });
  it("a newer post-commit read is not silently accepted as the editor's baseline", async () => {
    const h = await harness().open();
    h.setRead(async () => {
      const latest = structuredClone(h.server);
      latest.manifest.revision++;
      return { snapshot: latest, canUndo: true, canRedo: false };
    });
    await h.edit();
    assert.equal(h.authority.getSnapshot().revision, 1);
    assert.equal(h.authority.getSnapshot().loaded, false);
    assert.match(h.authority.getSnapshot().refreshError!, /stale-refresh/);
  });
  it("requires an actual unresolved command for retry", async () => {
    const h = await harness().open();
    await assert.rejects(h.authority.retryPending(), /no-uncertain-command/);
    assert.equal(h.calls.length, 0);
  });
  it("rejects missing history booleans instead of inventing them", async () => {
    const h = harness();
    h.authority.activate();
    h.setRead(async () => ({ snapshot: h.server }));
    await assert.rejects(h.authority.refresh(), /history availability/);
    assert.equal(h.authority.getSnapshot().loaded, false);
  });
  it("accepts null-prototype source maps without removing their defence", async () => {
    const h = harness();
    h.server.sources = Object.assign(Object.create(null), h.server.sources);
    await h.open();
    await h.edit();
    assert.equal(h.calls.length, 1);
  });
  it("rejects a missing native source instead of overwriting it", async () => {
    const h = harness();
    delete h.server.sources.title;
    h.authority.activate();
    await assert.rejects(h.authority.refresh(), /invalid authoring document/);
  });
});

describe("writer capability", () => {
  it("does not reinterpret native writer functions", () => {
    assert.equal(
      journalForWriter(async () => {}),
      null,
    );
  });
  it("is immutable and bound to the controller's project", () => {
    const h = harness();
    assert.equal(journalForWriter(h.authority.writer)?.projectId, "project-test");
    assert.equal(
      Object.getOwnPropertyDescriptor(h.authority.writer, "vflowProjectJournal")?.writable,
      false,
    );
  });
  it("rejects a malformed capability instead of falling back to native persistence", () => {
    const writer = Object.assign(async () => {}, { vflowProjectJournal: { owner: "wrong" } });
    assert.throws(() => journalForWriter(writer), /invalid-capability/);
  });
  it("does not call a commit handler through the bare-writer compatibility signature", async () => {
    let calls = 0;
    const writer = createJournalWriter({
      owner: "project-journal",
      projectId: "p",
      commitEdit: async () => {
        calls++;
        return [];
      },
    });
    await assert.rejects(writer("a", "b", "c"), /atomic-edit-required/);
    assert.equal(calls, 0);
  });
});
