import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { Composition } from "@hyperframes/sdk";
import type { JournalHistoryDelegate } from "./journalHistoryTypes";
import {
  nativeInspectorTargets,
  commitNativeInspectorEdit,
  commitDiagramLabel,
  diagramObjectRows,
  assertInspectorDocument,
} from "./managedInspectorEdits";
import { managedStudioFixture } from "./managedStudio.fixture";

function harness() {
  const f = managedStudioFixture();
  const sent: any[] = [],
    opened: unknown[] = [],
    operations: any[] = [];
  let disposed = 0,
    allowed = true;
  let target: any = {
    id: "hf-title",
    scopedId: "hf-title",
    tag: "h1",
    text: "Original",
    children: [],
    attributes: { id: "heading" },
  };
  const session = {
    getElement: (id: string) => (id === target?.scopedId ? target : null),
    getElements: () => (target ? [target] : []),
    can: () => (allowed ? { ok: true } : { ok: false, message: "unsupported" }),
    dispatch: (op: any) => operations.push(op),
    serialize: () => '<h1 data-hf-id="hf-title">Edited</h1>',
    dispose: () => {
      disposed++;
    },
  } as unknown as Composition;
  const open = async (...args: unknown[]) => {
    opened.push(args);
    return session;
  };
  const journal = {
    projectId: "project-test",
    commitEdit: async (value: unknown) => {
      sent.push(value);
      return ["title.html"];
    },
  } as JournalHistoryDelegate;
  return {
    ...f,
    sent,
    opened,
    operations,
    open,
    journal,
    get disposed() {
      return disposed;
    },
    target: (value: any) => {
      target = value;
    },
    decline: () => {
      allowed = false;
    },
  };
}
describe("managed inspector atomic authoring preparation", () => {
  it("one native save uses original CRLF baseline, one command, no autonomous history", async () => {
    const h = harness();
    await commitNativeInspectorEdit({
      content: h.native,
      hfId: "hf-title",
      edit: { type: "text", value: "Edited" },
      journal: h.journal,
      open: h.open,
      assertCurrent() {},
    });
    assert.equal(h.sent.length, 1);
    assert.equal(h.operations.length, 1);
    assert.deepEqual(h.operations[0], { type: "setText", target: "hf-title", value: "Edited" });
    assert.equal(h.sent[0].files["title.html"].before, h.native.content);
    assert.deepEqual(h.opened[0], [h.native.content, { history: false }]);
    assert.equal(h.disposed, 1);
  });
  it("uses actual setStyle shape for the allowed property", async () => {
    const h = harness();
    await commitNativeInspectorEdit({
      content: h.native,
      hfId: "hf-title",
      edit: { type: "style", property: "fontSize", value: "80px" },
      journal: h.journal,
      open: h.open,
      assertCurrent() {},
    });
    assert.deepEqual(h.operations[0], {
      type: "setStyle",
      target: "hf-title",
      styles: { fontSize: "80px" },
    });
  });
  it("disposes after listing targets without committing anything", async () => {
    const h = harness();
    const targets = await nativeInspectorTargets(h.native, h.open);
    assert.equal(targets[0]?.hfId, "hf-title");
    assert.equal(h.disposed, 1);
    assert.equal(h.sent.length, 0);
  });
  it("does not open diagram JSON in the native SDK", async () => {
    const h = harness();
    await assert.rejects(nativeInspectorTargets(h.diagram, h.open));
    assert.equal(h.opened.length, 0);
  });
  it("fails before opening for a stale display", async () => {
    const h = harness();
    await assert.rejects(
      commitNativeInspectorEdit({
        content: h.native,
        hfId: "hf-title",
        edit: { type: "text", value: "Edited" },
        journal: h.journal,
        open: h.open,
        assertCurrent() {
          throw new Error("stale");
        },
      }),
    );
    assert.equal(h.sent.length, 0);
    assert.equal(h.opened.length, 0);
  });
  it("rechecks after async SDK preparation and disposes on stale selection", async () => {
    const h = harness();
    let checks = 0;
    await assert.rejects(
      commitNativeInspectorEdit({
        content: h.native,
        hfId: "hf-title",
        edit: { type: "text", value: "Edited" },
        journal: h.journal,
        open: h.open,
        assertCurrent() {
          if (++checks === 2) throw new Error("navigated");
        },
      }),
    );
    assert.equal(h.sent.length, 0);
    assert.equal(h.disposed, 1);
    assert.equal(h.operations.length, 0);
  });
  it("rechecks immediately before the command and preserves an unsubmitted draft", async () => {
    const h = harness();
    let checks = 0;
    await assert.rejects(
      commitNativeInspectorEdit({
        content: h.native,
        hfId: "hf-title",
        edit: { type: "text", value: "Edited" },
        journal: h.journal,
        open: h.open,
        assertCurrent() {
          if (++checks === 3) throw new Error("new revision");
        },
      }),
    );
    assert.equal(h.sent.length, 0);
    assert.equal(h.disposed, 1);
  });
  for (const [name, target] of [
    ["missing", null],
    ["container", { scopedId: "hf-title", tag: "div", text: "Parent", children: [{}] }],
    ["script", { scopedId: "hf-title", tag: "script", text: "code", children: [] }],
    ["no text", { scopedId: "hf-title", tag: "h1", text: null, children: [] }],
  ] as const)
    it(`rejects ${name} rather than broad rewriting`, async () => {
      const h = harness();
      h.target(target);
      await assert.rejects(
        commitNativeInspectorEdit({
          content: h.native,
          hfId: "hf-title",
          edit: { type: "text", value: "Edited" },
          journal: h.journal,
          open: h.open,
          assertCurrent() {},
        }),
      );
      assert.equal(h.sent.length, 0);
      assert.equal(h.disposed, 1);
    });
  it("SDK capability refusal prevents dispatch and commit", async () => {
    const h = harness();
    h.decline();
    await assert.rejects(
      commitNativeInspectorEdit({
        content: h.native,
        hfId: "hf-title",
        edit: { type: "text", value: "Edited" },
        journal: h.journal,
        open: h.open,
        assertCurrent() {},
      }),
    );
    assert.equal(h.sent.length, 0);
    assert.equal(h.operations.length, 0);
    assert.equal(h.disposed, 1);
  });
  it("commit rejection is not swallowed and candidate is disposed", async () => {
    const h = harness();
    let attempts = 0;
    h.journal.commitEdit = async () => {
      attempts++;
      throw new Error("conflict");
    };
    await assert.rejects(
      commitNativeInspectorEdit({
        content: h.native,
        hfId: "hf-title",
        edit: { type: "text", value: "Edited" },
        journal: h.journal,
        open: h.open,
        assertCurrent() {},
      }),
      /conflict/,
    );
    assert.equal(attempts, 1);
    assert.equal(h.disposed, 1);
  });
  it("foreign authoring content never reaches the SDK", async () => {
    const h = harness();
    h.native.projectId = "foreign";
    await assert.rejects(
      commitNativeInspectorEdit({
        content: h.native,
        hfId: "hf-title",
        edit: { type: "text", value: "Edited" },
        journal: h.journal,
        open: h.open,
        assertCurrent() {},
      }),
    );
    assert.equal(h.sent.length, 0);
    assert.equal(h.opened.length, 0);
  });
  it("diagram rename retains identity, endpoints, ordering and source baseline", async () => {
    const h = harness();
    const before = JSON.parse(h.diagram.content);
    await commitDiagramLabel({
      content: h.diagram,
      objectId: "gateway",
      label: "Edge Gateway",
      journal: h.journal,
      assertCurrent() {},
    });
    assert.equal(h.sent.length, 1);
    const edit = h.sent[0];
    assert.equal(edit.kind, "source");
    assert.equal(edit.files[h.diagram.path].before, h.diagram.content);
    const after = JSON.parse(edit.files[h.diagram.path].after);
    assert.deepEqual(after.connections, before.connections);
    assert.equal(after.components[0].id, "gateway");
    assert.equal(after.components[0].label, "Edge Gateway");
    assert.equal(after.components[1].label, "API");
  });
  for (const name of ["missing", "duplicate", "empty label", "native document"] as const)
    it(`rejects diagram ${name}`, async () => {
      const h = harness();
      let content = h.diagram,
        objectId = "gateway",
        label = "New";
      if (name === "missing") objectId = "absent";
      if (name === "duplicate") {
        const s = JSON.parse(content.content);
        s.components.push(s.components[0]);
        content.content = JSON.stringify(s);
      }
      if (name === "empty label") label = " ";
      if (name === "native document") content = h.native;
      await assert.rejects(
        commitDiagramLabel({ content, objectId, label, journal: h.journal, assertCurrent() {} }),
      );
      assert.equal(h.sent.length, 0);
    });
  it("uses the model's family-specific collection without guessing endpoints", () => {
    const h = harness();
    assert.deepEqual(
      diagramObjectRows(h.diagram).map((r) => r.id),
      ["gateway", "api"],
    );
  });
  it("document pin includes kind as well as identity and returned representation hash", () => {
    const h = harness();
    assert.doesNotThrow(() => assertInspectorDocument(h.native, h.view, "title"));
    for (const key of [
      "projectId",
      "documentId",
      "kind",
      "path",
      "revision",
      "revisionHash",
      "contentHash",
    ] as const) {
      const bad = { ...h.native, [key]: key === "revision" ? 7 : "wrong" };
      assert.throws(
        () => assertInspectorDocument(bad as typeof h.native, h.view, "title"),
        undefined,
        key,
      );
    }
  });
});
