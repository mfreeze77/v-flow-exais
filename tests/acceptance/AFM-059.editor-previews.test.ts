/** Real project store, compiler, Hono routes and file reads. Not a browser/render test. */
import { afterEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import {
  editorPreviewUrl,
  type EditorPreviewSession,
} from "../../packages/project-model/src/editorPreview";
import { readCommittedProject } from "../../packages/project-model/src/storage/revisions";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import { projectEditorView } from "../../packages/studio-server/src/project/editorProjection";
import { registerProjectEditorPreviewRoutes } from "../../packages/studio-server/src/routes/projectEditorPreview";
import type { StudioApiAdapter } from "../../packages/studio-server/src/types";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
async function fixture() {
  const home = mkdtempSync(join(tmpdir(), "afm-059-preview-"));
  roots.push(home);
  const service = new UnifiedProjectService({ home, sourceRoots: [] });
  const imported = await service.importDiagram({
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title: "Checkout", viewBox: [900, 570], legend: { mode: "hidden" } },
    components: [
      { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
      { id: "api", type: "backend", label: "API", pos: [320, 80], size: [180, 70] },
    ],
    connections: [{ id: "edge", from: "gateway", to: "api" }],
    cards: [],
  });
  const id = imported.id;
  const root = service.root(id);
  const api = new Hono();
  // Root bundling is injected to exercise routing and decoration, not assert runtime parity.
  registerProjectEditorPreviewRoutes(api, {
    projectService: service,
    runtimeUrl: "/api/runtime.js",
    bundle: async (dir: string) => readFileSync(join(dir, "index.html"), "utf8"),
  } as StudioApiAdapter);
  const app = new Hono().route("/api", api);
  const view = () => projectEditorView(readCommittedProject(root));
  const endpoint = `/api/vflow/projects/${id}/editor/previews`;
  const prepare = async (captured = view()) =>
    app.request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: id,
        revision: captured.revision,
        revisionHash: captured.revisionHash,
      }),
    });
  const session = async () => {
    const r = await prepare();
    assert.equal(r.status, 200, await r.clone().text());
    return (await r.json()) as EditorPreviewSession;
  };
  return { service, id, root, app, endpoint, prepare, session, view };
}

describe("AFM-059 build-pinned editor previews", () => {
  it("prepares mappings without publishing an authoring edit", async () => {
    const f = await fixture();
    const before = readFileSync(join(f.root, ".vflow/CURRENT"));
    const session = await f.session();
    assert.equal(session.scenes.length, 2);
    assert.equal(session.revision, f.view().revision);
    assert.equal(session.scenes[0]!.editOwner, "native-document");
    assert.equal(session.scenes[1]!.editOwner, "diagram-command");
    assert.deepEqual(readFileSync(join(f.root, ".vflow/CURRENT")), before);
  });
  it("refuses a stale captured revision before building", async () => {
    const f = await fixture();
    const before = f.view();
    await f.service.command(f.id, {
      commandId: "rename-project",
      projectId: f.id,
      origin: "ui",
      expectedRevision: before.revision,
      operations: [{ type: "set-project-title", title: "New title" }],
    });
    assert.equal((await f.prepare(before)).status, 409);
    assert.equal(existsSync(join(f.root, ".vflow/builds")), false);
  });
  it("refuses a different index digest at the same revision", async () => {
    const f = await fixture();
    const view = f.view();
    view.revisionHash = "f".repeat(64);
    assert.equal((await f.prepare(view)).status, 409);
  });
  it("rejects extra preparation fields instead of accepting a filesystem input", async () => {
    const f = await fixture();
    const v = f.view();
    const r = await f.app.request(f.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: f.id,
        revision: v.revision,
        revisionHash: v.revisionHash,
        path: "/tmp/foreign",
      }),
    });
    assert.equal(r.status, 400);
  });
  it("keeps an old scene tied to its original bytes after another edit commits", async () => {
    const f = await fixture();
    const session = await f.session();
    const scene = session.scenes.find((s) => s.kind === "diagram")!;
    const first = await f.app.request(editorPreviewUrl(session, scene.sceneId));
    assert.equal(first.status, 200);
    const initial = await first.text();
    await f.service.command(f.id, {
      commandId: "rename-node",
      projectId: f.id,
      origin: "ui",
      expectedRevision: session.revision,
      operations: [
        {
          type: "rename-object",
          documentId: scene.documentId,
          objectId: "gateway",
          label: "Changed gateway",
        },
      ],
    });
    const second = await f.app.request(editorPreviewUrl(session, scene.sceneId));
    assert.equal(second.status, 200);
    assert.equal(await second.text(), initial);
    assert.equal(second.headers.get("X-VFlow-Revision"), String(session.revision));
  });
  it("refuses an unknown scene rather than showing the current master", async () => {
    const f = await fixture();
    const s = await f.session();
    assert.equal((await f.app.request(`${editorPreviewUrl(s)}?sceneId=absent`)).status, 404);
  });
  it("returns owned script bytes under the immutable build URL", async () => {
    const f = await fixture();
    const s = await f.session();
    const response = await f.app.request(`${f.endpoint}/${s.buildHash}/assets/gsap.min.js`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type")!, /javascript/);
    assert.equal(
      await response.text(),
      readFileSync(join(f.root, ".vflow/builds", s.buildHash, "assets/gsap.min.js"), "utf8"),
    );
  });
  it("rejects corruption rather than rebuilding or falling back", async () => {
    const f = await fixture();
    const s = await f.session();
    writeFileSync(join(f.root, ".vflow/builds", s.buildHash, "assets/gsap.min.js"), "corrupt");
    const response = await f.app.request(`${f.endpoint}/${s.buildHash}/assets/gsap.min.js`);
    assert.equal(response.status, 409);
    assert.match(await response.text(), /no longer match/);
  });
  it("will not serve arbitrary files from an owned directory", async () => {
    const f = await fixture();
    const s = await f.session();
    assert.equal(
      (await f.app.request(`${f.endpoint}/${s.buildHash}/assets/build-receipt.json`)).status,
      404,
    );
  });
  it("decorates a scene without modifying its authored HTML", async () => {
    const f = await fixture();
    const s = await f.session();
    const native = s.scenes.find((x) => x.kind === "native")!;
    const before = readCommittedProject(f.root).snapshot.sources[native.documentId];
    const response = await f.app.request(editorPreviewUrl(s, native.sceneId));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /data-vflow-edit-owner="native-document"/);
    assert.equal(readCommittedProject(f.root).snapshot.sources[native.documentId], before);
  });
  it("does not provide a write endpoint for generated preview HTML", async () => {
    const f = await fixture();
    const s = await f.session();
    const before = readFileSync(join(f.root, ".vflow/CURRENT"));
    assert.equal(
      (await f.app.request(editorPreviewUrl(s), { method: "PUT", body: "overwrite" })).status,
      404,
    );
    assert.deepEqual(readFileSync(join(f.root, ".vflow/CURRENT")), before);
  });
  it("preserves the prepared view after a new service opens the same store", async () => {
    const f = await fixture();
    const s = await f.session();
    const reopened = new UnifiedProjectService({ home: join(f.root, "../.."), sourceRoots: [] });
    assert.equal(reopened.get(f.id).snapshot.manifest.revision, s.revision);
    const response = await f.app.request(editorPreviewUrl(s));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-VFlow-Build"), s.buildHash);
  });
});
