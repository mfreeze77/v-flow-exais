/** Real store + Hono routes. Run in the pinned workspace; no stand-in project service. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";
import { Hono } from "hono";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import { registerProjectEditorRoutes } from "../../packages/studio-server/src/routes/projectEditor";
import { readCommittedProject } from "../../packages/project-model/src/storage/revisions";
import type { EditorProjectView } from "../../packages/project-model/src/editorRead";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

async function setup() {
  const home = mkdtempSync(join(tmpdir(), "afm-059-editor-reads-"));
  homes.push(home);
  const service = new UnifiedProjectService({ home, sourceRoots: [] });
  const imported = await service.importDiagram({
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title: "Editor reads", viewBox: [900, 570], legend: { mode: "hidden" } },
    components: [
      { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
      { id: "api", type: "backend", label: "API", pos: [320, 80], size: [180, 70] },
    ],
    connections: [{ id: "request", from: "gateway", to: "api" }],
    cards: [],
  });
  const id = imported!.id,
    root = service.root(id),
    api = new Hono();
  api.onError(() => Response.json({ error: "Read failed" }, { status: 500 }));
  registerProjectEditorRoutes(api, service);
  const endpoint = `/vflow/projects/${id}/editor`;
  async function view(): Promise<EditorProjectView> {
    const response = await api.request(endpoint);
    assert.equal(response.status, 200);
    return response.json();
  }
  function documentUrl(v: EditorProjectView, docId: string) {
    return `${endpoint}/documents/${encodeURIComponent(docId)}?${new URLSearchParams({ revision: String(v.revision), revisionHash: v.revisionHash })}`;
  }
  return { home, service, id, root, api, endpoint, view, documentUrl };
}

function wav(): Buffer {
  const rate = 48000,
    data = Buffer.alloc(rate * 2),
    header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function rename(t: Awaited<ReturnType<typeof setup>>, label: string) {
  const snapshot = t.service.get(t.id).snapshot;
  const doc = snapshot.manifest.documents.find((d) => d.kind === "architecture")!;
  return t.service.command(t.id, {
    commandId: crypto.randomUUID(),
    projectId: t.id,
    origin: "ui",
    expectedRevision: snapshot.manifest.revision,
    operations: [{ type: "rename-object", documentId: doc.id, objectId: "api", label }],
  });
}

describe("AFM-059 committed editor read routes", () => {
  it("lists a real imported mixed project using portable authoring references", async () => {
    const t = await setup(),
      view = await t.view();
    assert.equal(view.documents.length, 2);
    assert.deepEqual(
      view.documents.map((d) => d.kind),
      ["native", "architecture"],
    );
    assert.equal(view.writeOwner, "project-command");
    assert.equal(JSON.stringify(view).includes(t.home), false);
  });
  it("does not compile, build, advance a revision or add history on reads", async () => {
    const t = await setup(),
      before = readFileSync(join(t.root, ".vflow/CURRENT"));
    t.service.build = async () => {
      throw new Error("A read must not build");
    };
    const view = await t.view();
    const response = await t.api.request(t.documentUrl(view, view.documents[0]!.documentId));
    assert.equal(response.status, 200);
    assert.deepEqual(readFileSync(join(t.root, ".vflow/CURRENT")), before);
    assert.equal(existsSync(join(t.root, ".vflow/LAST_BUILD.json")), false);
    assert.equal(Object.getPrototypeOf(readCommittedProject(t.root).snapshot.sources), null);
  });
  it("reads native content and its measured representation hash", async () => {
    const t = await setup(),
      view = await t.view(),
      doc = view.documents.find((d) => d.kind === "native")!;
    const response = await t.api.request(t.documentUrl(view, doc.documentId));
    const body = await response.json();
    assert.equal(body.content, t.service.get(t.id).snapshot.sources[doc.documentId]);
    assert.equal(createHash("sha256").update(body.content).digest("hex"), body.contentHash);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
  it("keeps a changed revision from being silently substituted into an older read", async () => {
    const t = await setup(),
      view = await t.view();
    await rename(t, "Changed API");
    const response = await t.api.request(t.documentUrl(view, view.documents[0]!.documentId));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "editor/stale-read");
  });
  it("rejects a wrong hash at the current revision", async () => {
    const t = await setup(),
      view = await t.view();
    const response = await t.api.request(
      t.documentUrl({ ...view, revisionHash: "0".repeat(64) }, view.documents[0]!.documentId),
    );
    assert.equal(response.status, 409);
  });
  it("requires both revision fields", async () => {
    const t = await setup(),
      view = await t.view();
    const response = await t.api.request(
      `${t.endpoint}/documents/${view.documents[0]!.documentId}`,
    );
    assert.equal(response.status, 400);
  });
  it("does not expose the revision-store files by guessing a document ID", async () => {
    const t = await setup(),
      view = await t.view();
    for (const guessed of ["CURRENT", "index.html", "scene-0-title-scene.html"])
      assert.equal((await t.api.request(t.documentUrl(view, guessed))).status, 404);
  });
  it("has no PUT or POST authoring bypass", async () => {
    const t = await setup(),
      view = await t.view(),
      before = readFileSync(join(t.root, ".vflow/CURRENT"));
    for (const method of ["PUT", "POST", "PATCH", "DELETE"])
      assert.equal(
        (
          await t.api.request(t.documentUrl(view, view.documents[0]!.documentId), {
            method,
            body: "changed",
          })
        ).status,
        404,
      );
    assert.deepEqual(readFileSync(join(t.root, ".vflow/CURRENT")), before);
  });
  it("serves owned asset bytes after the original input file is gone", async () => {
    const t = await setup(),
      input = join(t.home, "input.wav"),
      bytes = wav();
    writeFileSync(input, bytes);
    const attached = await t.service.attachAsset(t.id, input);
    rmSync(input);
    const view = await t.view();
    const response = await t.api.request(
      `${t.endpoint}/assets/${attached.asset.id}?${new URLSearchParams({ revision: String(view.revision), revisionHash: view.revisionHash })}`,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/wav");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  });
  it("fails rather than serving corrupted project-owned bytes", async () => {
    const t = await setup(),
      input = join(t.home, "input.wav");
    writeFileSync(input, wav());
    const attached = await t.service.attachAsset(t.id, input),
      view = await t.view();
    // Deliberate corruption of this disposable fixture's verified owned-store layout.
    writeFileSync(
      join(t.root, ".vflow/asset-blobs", attached.asset.sha256, "payload.wav"),
      "corrupt",
    );
    const response = await t.api.request(
      `${t.endpoint}/assets/${attached.asset.id}?${new URLSearchParams({ revision: String(view.revision), revisionHash: view.revisionHash })}`,
    );
    assert.equal(response.status, 500);
  });
  it("reads the same data after constructing a new service over the same home", async () => {
    const t = await setup(),
      before = await t.view();
    const reopened = new UnifiedProjectService({ home: t.home, sourceRoots: [] });
    const api = new Hono();
    registerProjectEditorRoutes(api, reopened);
    const after = await (await api.request(t.endpoint)).json();
    assert.deepEqual(after, before);
  });
  it("reports the journal's undo state after an edit without creating a parallel history", async () => {
    const t = await setup();
    await rename(t, "Orders API");
    assert.deepEqual((await t.view()).history, {
      owner: "project-journal",
      canUndo: true,
      canRedo: false,
    });
  });
});
