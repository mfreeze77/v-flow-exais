import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { editorPreviewFixture } from "../../../project-model/src/editorPreview.fixture";
import { createEditorPreviewClient, createPreviewPublicationGate } from "./editorPreviewClient";

describe("AFM-059 preview preparation and publication", () => {
  it("binds the request before fetch to the captured index digest", async () => {
    const { view, session } = editorPreviewFixture();
    const calls: any[] = [];
    const client = createEditorPreviewClient(view.projectId, async (url, init) => {
      calls.push({ url, init });
      return Response.json(session);
    });
    assert.deepEqual(await client.prepare(view), session);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      projectId: view.projectId,
      revision: view.revision,
      revisionHash: view.revisionHash,
    });
  });
  it("construction does not reject a hostile project ID during render", async () => {
    let calls = 0;
    const client = createEditorPreviewClient("../hostile", async () => {
      calls++;
      throw new Error("must not fetch");
    });
    await assert.rejects(client.prepare(editorPreviewFixture().view));
    assert.equal(calls, 0);
  });
  it("returns a request failure without a native-file fallback or retry", async () => {
    let calls = 0;
    const { view } = editorPreviewFixture();
    const client = createEditorPreviewClient(view.projectId, async () => {
      calls++;
      return Response.json({ code: "editor/stale-preview-request" }, { status: 409 });
    });
    await assert.rejects(
      client.prepare(view),
      (e: any) => e.code === "editor/stale-preview-request",
    );
    assert.equal(calls, 1);
  });
  it("keeps a captured view stable when its caller mutates the original while awaiting", async () => {
    const { view, session } = editorPreviewFixture();
    let release!: (r: Response) => void;
    const result = createEditorPreviewClient(
      view.projectId,
      () =>
        new Promise((r) => {
          release = r;
        }),
    ).prepare(view);
    view.revision++;
    view.scenes[0]!.durationFrames++;
    release(Response.json(session));
    assert.equal((await result).revision, 3);
  });
  it("rejects a newer build instead of rebasing a draft's context", async () => {
    const { view, session } = editorPreviewFixture();
    session.revision++;
    await assert.rejects(
      createEditorPreviewClient(view.projectId, async () => Response.json(session)).prepare(view),
      /different authoring/,
    );
  });
  it("rejects a different index at the same revision", async () => {
    const { view, session } = editorPreviewFixture();
    session.revisionHash = "e".repeat(64);
    await assert.rejects(
      createEditorPreviewClient(view.projectId, async () => Response.json(session)).prepare(view),
    );
  });
  it("rejects a response with a foreign project", async () => {
    const { view, session } = editorPreviewFixture();
    session.projectId = "foreign";
    await assert.rejects(
      createEditorPreviewClient(view.projectId, async () => Response.json(session)).prepare(view),
    );
  });
  it("rejects a plausible mapping to the wrong source document", async () => {
    const { view, session } = editorPreviewFixture();
    session.scenes[0]!.sourcePath = "other.html";
    await assert.rejects(
      createEditorPreviewClient(view.projectId, async () => Response.json(session)).prepare(view),
      /scene mapping/,
    );
  });
  it("rejects invalid JSON rather than reporting a preview ready", async () => {
    const { view } = editorPreviewFixture();
    await assert.rejects(
      createEditorPreviewClient(view.projectId, async () => new Response("{broken")).prepare(view),
    );
  });
  it("does not fetch after an already cancelled request", async () => {
    const { view } = editorPreviewFixture();
    const controller = new AbortController();
    controller.abort();
    let called = false;
    await assert.rejects(
      createEditorPreviewClient(view.projectId, async () => {
        called = true;
        throw new Error();
      }).prepare(view, controller.signal),
    );
    assert.equal(called, false);
  });
  it("does not accept a late response from a cancelled request", async () => {
    const { view, session } = editorPreviewFixture();
    const controller = new AbortController();
    const client = createEditorPreviewClient(view.projectId, async () => {
      controller.abort();
      return Response.json(session);
    });
    await assert.rejects(client.prepare(view, controller.signal));
  });
  it("an older response cannot publish after a newer request begins", () => {
    const gate = createPreviewPublicationGate();
    const old = gate.begin();
    const current = gate.begin();
    assert.equal(gate.isCurrent(old), false);
    assert.equal(gate.isCurrent(current), true);
  });
  it("a disposed workspace cannot publish or start another load", () => {
    const gate = createPreviewPublicationGate();
    const token = gate.begin();
    gate.dispose();
    assert.equal(gate.isCurrent(token), false);
    assert.throws(() => gate.begin());
  });
});
