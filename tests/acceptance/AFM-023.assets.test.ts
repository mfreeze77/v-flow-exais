/**
 * AFM-023 / AFM-078 asset ownership slice. These are real shared-service tests:
 * ffprobe, the Bun/flock revision worker, the compiler, and filesystem builds.
 * No renderer, storage, or journal stand-ins. Run in the pinned project image.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import { nativeTitle } from "../../packages/studio-server/src/project/videoProposals";
import { readProjectAssetBytes } from "../../packages/studio-server/src/project/projectAssets";
import {
  wavAssetFixture,
  pngAssetFixture,
} from "../../packages/studio-server/src/project/projectAssets.fixture";
import type { ProjectOperation } from "../../packages/project-model/src/commands";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
async function project() {
  const dir = mkdtempSync(join(tmpdir(), "afm023-service-"));
  roots.push(dir);
  const home = join(dir, "home");
  const service = new UnifiedProjectService({ home, sourceRoots: [] });
  const imported = await service.importDiagram({
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title: "Asset ownership", viewBox: [900, 570], legend: { mode: "hidden" } },
    components: [
      { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
      { id: "api", type: "backend", label: "API", pos: [320, 80], size: [180, 70] },
    ],
    connections: [{ id: "edge", from: "gateway", to: "api" }],
    cards: [],
  });
  if (!imported) throw new Error("Real diagram import failed.");
  const input = join(dir, "voice.wav");
  const bytes = wavAssetFixture();
  writeFileSync(input, bytes);
  return { dir, home, service, id: imported.id, input, bytes };
}
async function command(service: UnifiedProjectService, id: string, operations: ProjectOperation[]) {
  return service.command(id, {
    commandId: randomUUID(),
    origin: "ui",
    projectId: id,
    expectedRevision: service.get(id).snapshot.manifest.revision,
    operations,
  });
}

describe("AFM-023: assets participate in the real project lifecycle", () => {
  it("registers a probed local asset through the project journal", async () => {
    const f = await project();
    const before = f.service.get(f.id).snapshot;
    assert.equal(Object.hasOwn(before.manifest, "assets"), false);
    const result = await f.service.attachAsset(f.id, f.input);
    const current = f.service.get(f.id);
    assert.equal(result.pointer.revision, 1);
    assert.equal(current.snapshot.manifest.revision, 1);
    assert.equal(current.snapshot.manifest.assets?.length, 1);
    assert.deepEqual(current.snapshot.sources, before.sources);
    assert.equal(current.canUndo, true);
    assert.deepEqual(readProjectAssetBytes(f.service.root(f.id), result.asset), f.bytes);
  }, 30_000);

  it("deduplicates a repeated import without another revision or undo entry", async () => {
    const f = await project();
    const first = await f.service.attachAsset(f.id, f.input);
    const renamed = join(f.dir, "same-content.wav");
    writeFileSync(renamed, f.bytes);
    const second = await f.service.attachAsset(f.id, renamed);
    assert.equal(second.replayed, true);
    assert.deepEqual(second.pointer, first.pointer);
    assert.deepEqual(second.asset, first.asset);
    assert.equal(f.service.get(f.id).snapshot.manifest.assets?.length, 1);
    await command(f.service, f.id, [{ type: "undo" }]);
    assert.equal(f.service.get(f.id).snapshot.manifest.assets, undefined);
  }, 30_000);

  it("gives changed bytes a new identity even under the same source filename", async () => {
    const f = await project();
    const first = await f.service.attachAsset(f.id, f.input);
    writeFileSync(f.input, wavAssetFixture(2, 123));
    const second = await f.service.attachAsset(f.id, f.input);
    assert.notEqual(second.asset.id, first.asset.id);
    assert.equal(f.service.get(f.id).snapshot.manifest.assets?.length, 2);
    assert.deepEqual(readProjectAssetBytes(f.service.root(f.id), first.asset), f.bytes);
  }, 30_000);

  it("undoes and redoes attachment using retained bytes after the original is deleted", async () => {
    const f = await project();
    const attached = await f.service.attachAsset(f.id, f.input);
    rmSync(f.input);
    await command(f.service, f.id, [{ type: "undo" }]);
    assert.equal(f.service.get(f.id).snapshot.manifest.assets, undefined);
    assert.deepEqual(readProjectAssetBytes(f.service.root(f.id), attached.asset), f.bytes);
    await command(f.service, f.id, [{ type: "redo" }]);
    assert.deepEqual(f.service.get(f.id).snapshot.manifest.assets, [attached.asset]);
  }, 30_000);

  it("keeps asset, native and semantic edits in the same undo/redo order", async () => {
    const f = await project();
    const initial = f.service.get(f.id).snapshot;
    const attached = await f.service.attachAsset(f.id, f.input);
    await command(f.service, f.id, [
      {
        type: "replace-native-source",
        documentId: "title",
        html: nativeTitle("New title", "Shared journal"),
      },
    ]);
    await command(f.service, f.id, [
      { type: "rename-object", documentId: "diagram", objectId: "api", label: "Orders API" },
    ]);
    assert.equal(f.service.get(f.id).snapshot.manifest.revision, 3);
    await command(f.service, f.id, [{ type: "undo" }]);
    assert.deepEqual(f.service.get(f.id).snapshot.sources.diagram, initial.sources.diagram);
    assert.notEqual(f.service.get(f.id).snapshot.sources.title, initial.sources.title);
    await command(f.service, f.id, [{ type: "undo" }]);
    assert.deepEqual(f.service.get(f.id).snapshot.sources, initial.sources);
    assert.deepEqual(f.service.get(f.id).snapshot.manifest.assets, [attached.asset]);
    await command(f.service, f.id, [{ type: "undo" }]);
    assert.equal(f.service.get(f.id).snapshot.manifest.assets, undefined);
    for (let step = 0; step < 3; step += 1) await command(f.service, f.id, [{ type: "redo" }]);
    const restored = f.service.get(f.id).snapshot;
    assert.deepEqual(restored.manifest.assets, [attached.asset]);
    assert.match(String(restored.sources.title), /New title/);
    assert.match(JSON.stringify(restored.sources.diagram), /Orders API/);
  }, 30_000);

  it("reopens without a phantom edit and builds with copied, hashed asset bytes", async () => {
    const f = await project();
    const attached = await f.service.attachAsset(f.id, f.input);
    rmSync(f.input);
    const reopened = new UnifiedProjectService({ home: f.home, sourceRoots: [] });
    assert.equal(reopened.get(f.id).snapshot.manifest.revision, attached.pointer.revision);
    const build = await reopened.build(f.id);
    assert.equal(build.receipt.files[attached.asset.path], attached.asset.sha256);
    assert.deepEqual(readFileSync(join(build.dir, attached.asset.path)), f.bytes);
    assert.equal(JSON.stringify(build.receipt).includes(f.input), false);
  }, 30_000);

  it("materializes an imported PNG referenced by native authored HTML", async () => {
    const f = await project();
    const input = join(f.dir, "logo.png");
    const bytes = pngAssetFixture();
    writeFileSync(input, bytes);
    const attached = await f.service.attachAsset(f.id, input);
    const html = String(f.service.get(f.id).snapshot.sources.title).replace(
      "</h1>",
      `</h1><img src="${attached.asset.path}" alt="Local test image">`,
    );
    assert.ok(html.includes(attached.asset.path));
    await command(f.service, f.id, [{ type: "replace-native-source", documentId: "title", html }]);
    rmSync(input);
    const build = await f.service.build(f.id);
    assert.deepEqual(readFileSync(join(build.dir, attached.asset.path)), bytes);
    assert.equal(build.receipt.files[attached.asset.path], attached.asset.sha256);
    // This proves build materialization, not a browser screenshot or rendered frame.
  }, 30_000);

  it("blocks corrupted media without replacing the last valid build pointer", async () => {
    const f = await project();
    const attached = await f.service.attachAsset(f.id, f.input);
    const build = await f.service.build(f.id);
    const root = f.service.root(f.id);
    const last = join(root, ".vflow", "LAST_BUILD.json");
    const before = readFileSync(last);
    writeFileSync(
      join(root, ".vflow", "asset-blobs", attached.asset.sha256, "payload.wav"),
      Buffer.from("corrupt"),
    );
    await assert.rejects(f.service.build(f.id), /integrity/);
    assert.deepEqual(readFileSync(last), before);
    assert.deepEqual(readFileSync(join(build.dir, attached.asset.path)), f.bytes);
  }, 30_000);

  it("rejects registration of bytes never staged into this project", async () => {
    const f = await project();
    const other = await project();
    const foreign = await other.service.attachAsset(other.id, other.input);
    const before = f.service.get(f.id).snapshot;
    await assert.rejects(
      command(f.service, f.id, [{ type: "register-asset", asset: foreign.asset }]),
    );
    assert.deepEqual(f.service.get(f.id).snapshot, before);
  }, 30_000);

  it("rejects forged measured metadata without committing a revision", async () => {
    const f = await project();
    const attached = await f.service.attachAsset(f.id, f.input);
    if (attached.asset.kind !== "audio") throw new Error("Expected audio.");
    await command(f.service, f.id, [{ type: "undo" }]);
    const before = f.service.get(f.id).snapshot;
    const forged = {
      ...attached.asset,
      metadata: { ...attached.asset.metadata, durationSeconds: 999 },
    };
    await assert.rejects(
      command(f.service, f.id, [{ type: "register-asset", asset: forged }]),
      /metadata differs/,
    );
    assert.deepEqual(f.service.get(f.id).snapshot, before);
  }, 30_000);

  it("rejects a stale attachment revision before staging any bytes", async () => {
    const f = await project();
    await command(f.service, f.id, [{ type: "set-project-title", title: "Changed" }]);
    await assert.rejects(
      f.service.attachAsset(f.id, f.input, { expectedRevision: 0 }),
      /Expected revision 0/,
    );
    assert.equal(existsSync(join(f.service.root(f.id), ".vflow", "asset-blobs")), false);
  }, 30_000);

  it("rejects an assetful project import when its owned blobs were not supplied", async () => {
    const f = await project();
    await f.service.attachAsset(f.id, f.input);
    const snapshot = structuredClone(f.service.get(f.id).snapshot);
    snapshot.manifest.id = `missing-assets-${randomUUID()}`;
    snapshot.manifest.revision = 0;
    await assert.rejects(f.service.create(snapshot));
    assert.equal(f.service.has(snapshot.manifest.id), false);
  }, 30_000);
});
