/** Real store, compiler, SDK and Hono integration. This is not a browser/visual run. */
import { afterEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import { parseHTML } from "linkedom";
// Workspace source path, as the other acceptance tests use: only
// @hyperframes/player is linked into the root node_modules, so a bare
// workspace specifier cannot resolve from tests/.
import { openComposition } from "../../packages/sdk/src/index";
import { createStudioApi } from "../../packages/studio-server/src/createStudioApi";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import type { StudioApiAdapter } from "../../packages/studio-server/src/types";
import { readCommittedProject } from "../../packages/project-model/src/storage/revisions";
import {
  projectEditorDocument,
  projectEditorView,
} from "../../packages/studio-server/src/project/editorProjection";
import { createManagedJournal } from "../../packages/studio/src/project/managedJournal";
import {
  nativeInspectorTargets,
  commitNativeInspectorEdit,
  commitDiagramLabel,
} from "../../packages/studio/src/project/managedInspectorEdits";
import {
  editorPreviewUrl,
  type EditorPreviewSession,
} from "../../packages/project-model/src/editorPreview";

const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});
async function fixture() {
  const home = mkdtempSync(join(tmpdir(), "afm-059-managed-studio-"));
  roots.push(home);
  const service = new UnifiedProjectService({ home, sourceRoots: [] });
  const { id } = await service.importDiagram({
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title: "Managed Studio fixture", viewBox: [900, 570], legend: { mode: "hidden" } },
    components: [
      { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
      { id: "api", type: "backend", label: "API", pos: [320, 80], size: [180, 70] },
    ],
    connections: [{ id: "edge-a", from: "gateway", to: "api" }],
    cards: [],
  });
  let nativeResolutions = 0;
  const adapter = {
    projectService: service,
    runtimeUrl: "/api/runtime.js",
    listProjects: () => [],
    resolveProject: () => {
      nativeResolutions++;
      return null;
    },
    // Intentionally raw master bytes. The standalone helper and SDK below are real;
    // this adapter does NOT prove browser runtime parity or exported video.
    bundle: async (dir: string) => readFileSync(join(dir, "index.html"), "utf8"),
    lint: () => ({ findings: [] }),
    rendersDir: () => {
      throw new Error("unexpected render");
    },
    startRender: () => {
      throw new Error("unexpected render");
    },
  } as StudioApiAdapter;
  const app = new Hono().route("/api", createStudioApi(adapter));
  const root = service.root(id);
  const read = () => readCommittedProject(root);
  const content = (documentId: string) => {
    const c = read();
    return projectEditorDocument(c, projectEditorView(c), documentId);
  };
  const authority = createManagedJournal({
    projectId: id,
    read: async () => service.get(id),
    send: (command) => service.command(id, command),
  });
  const release = authority.activate();
  await authority.refresh();
  return {
    home,
    id,
    root,
    app,
    service,
    read,
    content,
    authority,
    release,
    nativeResolutions: () => nativeResolutions,
  };
}
describe("AFM-059 guarded managed Studio integration", () => {
  it("publishes the fence handshake without changing a revision", async () => {
    const f = await fixture();
    const before = f.read().pointer;
    const response = await f.app.request(`/api/vflow/projects/${f.id}/editor/studio-access`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.projectId, f.id);
    assert.equal(body.nativeRoutes, "blocked-except-authoring-reads");
    assert.deepEqual(f.read().pointer, before);
    f.release();
  });
  for (const method of ["POST", "PUT", "PATCH", "DELETE"])
    it(`blocks ${method} before native filesystem handlers`, async () => {
      const f = await fixture();
      const before = f.read().pointer;
      for (const path of [
        "files/title.html",
        "file-mutations/remove-element/title.html",
        "gsap-mutations/title.html",
        "upload",
        "registry/install",
        "render",
      ]) {
        const response = await f.app.request(`/api/projects/${f.id}/${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        assert.equal(response.status, 409, `${method} ${path}: ${await response.clone().text()}`);
        // Two guards refuse these, and which one fires depends on the path.
        // `installLocalApiPolicy` runs before the fence and already rejects any
        // non-GET legacy route for a managed project — but it exempts `/render`,
        // which only the fence covers. Asserting a single code therefore failed
        // for five of the six paths while the request was, correctly, refused.
        // The properties that matter are asserted in full: 409, no native
        // handler resolved the project, and no revision moved.
        assert.ok(
          ["editor/native-route-blocked", "project/managed-output"].includes(
            (await response.json()).code,
          ),
          `${method} ${path} was refused without a managed-block code`,
        );
      }
      assert.equal(f.nativeResolutions(), 0);
      assert.deepEqual(f.read().pointer, before);
      f.release();
    });
  it("blocks GET preview/thumbnail housekeeping before a legacy handler resolves the project", async () => {
    const f = await fixture();
    const before = f.read().pointer;
    for (const path of [
      "preview",
      "preview/comp/title.html",
      "thumbnail/title.html",
      "signature",
      "gsap-animations/title.html",
    ]) {
      const response = await f.app.request(`/api/projects/${f.id}/${path}`);
      assert.equal(response.status, 409, path);
    }
    assert.equal(f.nativeResolutions(), 0);
    assert.deepEqual(f.read().pointer, before);
    f.release();
  });
  it("adapts native helper reads from authoritative content without handing out generated files", async () => {
    const f = await fixture();
    const before = f.read();
    const response = await f.app.request(`/api/projects/${f.id}/files/title.html`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.content, before.snapshot.sources.title);
    assert.equal(body.version, f.content("title").contentHash);
    assert.equal(
      (await f.app.request(`/api/projects/${f.id}/files/scene-0-title-scene.html`)).status,
      404,
    );
    assert.equal((await f.app.request(`/api/projects/${f.id}/files/.vflow%2FCURRENT`)).status, 400);
    assert.equal(f.nativeResolutions(), 0);
    assert.deepEqual(f.read().pointer, before.pointer);
    f.release();
  });
  it("does not apply the managed fence to a native project", async () => {
    const f = await fixture();
    await f.app.request("/api/projects/native/files/title.html");
    assert.equal(f.nativeResolutions(), 1);
    f.release();
  });
  it("corrupt CURRENT never falls through to a native root", async () => {
    const f = await fixture();
    writeFileSync(join(f.root, ".vflow/CURRENT"), "{");
    const response = await f.app.request(`/api/projects/${f.id}/files/title.html`);
    assert.equal(response.status, 500);
    assert.equal(f.nativeResolutions(), 0);
    f.release();
  });
  it("native scene preview IDs match the actual SDK without modifying source or build", async () => {
    const f = await fixture();
    const current = f.read();
    const view = projectEditorView(current);
    const prepared = await f.app.request(`/api/vflow/projects/${f.id}/editor/previews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: f.id,
        revision: view.revision,
        revisionHash: view.revisionHash,
      }),
    });
    assert.equal(prepared.status, 200, await prepared.clone().text());
    const session = (await prepared.json()) as EditorPreviewSession;
    const scene = session.scenes.find((s) => s.kind === "native")!;
    const storedPath = join(f.root, ".vflow/builds", session.buildHash, scene.outputPath);
    const buildBefore = readFileSync(storedPath);
    const response = await f.app.request(editorPreviewUrl(session, scene.sceneId));
    assert.equal(response.status, 200, await response.clone().text());
    const document = parseHTML(await response.text()).document;
    const source = f.content("title");
    const comp = await openComposition(source.content, { history: false });
    try {
      const heading = comp.getElements().find((e) => e.tag.toLowerCase() === "h1")!;
      assert(heading);
      assert.equal(document.querySelector("h1")?.getAttribute("data-hf-id"), heading.id);
      assert.equal(
        document.documentElement.getAttribute("data-vflow-build-hash"),
        session.buildHash,
      );
    } finally {
      comp.dispose();
    }
    assert.deepEqual(readFileSync(storedPath), buildBefore);
    assert.equal(f.read().snapshot.sources.title, current.snapshot.sources.title);
    assert.deepEqual(f.read().pointer, current.pointer);
    f.release();
  });
  it("actual SDK text + diagram label share one journal and undo in user order", async () => {
    const f = await fixture();
    const source = f.content("title");
    const target = (await nativeInspectorTargets(source)).find(
      (t) => t.tag.toLowerCase() === "h1",
    )!;
    assert(target);
    await commitNativeInspectorEdit({
      content: source,
      hfId: target.hfId,
      edit: { type: "text", value: "Native edit" },
      journal: f.authority,
      assertCurrent() {},
    });
    assert.equal(f.read().pointer.revision, 1);
    assert.equal(f.read().index.history?.undo.length, 1);
    await commitDiagramLabel({
      content: f.content("diagram"),
      objectId: "gateway",
      label: "Edited gateway",
      journal: f.authority,
      assertCurrent() {},
    });
    assert.equal(f.read().pointer.revision, 2);
    assert.equal(f.read().index.history?.undo.length, 2);
    await f.authority.undo();
    assert.match(String(f.read().snapshot.sources.title), /Native edit/);
    assert.equal((f.read().snapshot.sources.diagram as any).components[0].label, "Gateway");
    await f.authority.undo();
    assert.equal(f.read().snapshot.sources.title, source.content);
    await f.authority.redo();
    await f.authority.redo();
    assert.equal((f.read().snapshot.sources.diagram as any).components[0].label, "Edited gateway");
    f.release();
  });
  it("actual SDK rejects a stale baseline without publishing an edit", async () => {
    const f = await fixture();
    const old = f.content("title");
    const target = (await nativeInspectorTargets(old)).find((t) => t.tag.toLowerCase() === "h1")!;
    assert(target);
    await f.service.command(f.id, {
      commandId: "other",
      origin: "ui",
      projectId: f.id,
      expectedRevision: 0,
      operations: [
        {
          type: "replace-native-source",
          documentId: "title",
          html: old.content.replace("Managed Studio fixture", "Other writer"),
        },
      ],
    });
    await f.authority.refresh();
    const before = f.read().pointer;
    await assert.rejects(
      commitNativeInspectorEdit({
        content: old,
        hfId: target.hfId,
        edit: { type: "text", value: "Stale edit" },
        journal: f.authority,
        assertCurrent() {},
      }),
    );
    assert.deepEqual(f.read().pointer, before);
    f.release();
  });
  it("native style uses real SDK and reopening retains journal ownership", async () => {
    const f = await fixture();
    const source = f.content("title");
    const target = (await nativeInspectorTargets(source)).find(
      (t) => t.tag.toLowerCase() === "h1",
    )!;
    assert(target);
    await commitNativeInspectorEdit({
      content: source,
      hfId: target.hfId,
      edit: { type: "style", property: "color", value: "#12ab34" },
      journal: f.authority,
      assertCurrent() {},
    });
    const saved = f.read().pointer;
    f.release();
    const reopened = new UnifiedProjectService({ home: f.home, sourceRoots: [] });
    assert.match(String(reopened.get(f.id).snapshot.sources.title), /#12ab34/);
    const read = readCommittedProject(reopened.root(f.id));
    assert.deepEqual(read.pointer, saved);
    assert.equal(read.index.history?.undo.length, 1);
  });
});
