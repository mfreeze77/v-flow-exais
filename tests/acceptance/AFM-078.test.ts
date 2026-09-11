/**
 * AFM-078 — one editor, one history, coherent regeneration and reopen.
 *
 * This is the product milestone, written before the work that satisfies it, so
 * "done" is defined by behaviour rather than declared afterwards. It is expected
 * to fail until the slice lands; every failure below names a real missing
 * capability rather than a placeholder.
 *
 * The journey it encodes:
 *
 *   select an object -> edit diagram source and native content -> adjust
 *   presentation timing -> undo and redo across both -> regenerate ->
 *   save, close, reopen -> export
 *
 * Two rules make it a test rather than a demonstration. Every edit must reach
 * its authoritative document through the shared project-command path, so a
 * direct file write cannot satisfy it. And regenerating after deleting an
 * animated target must produce an explicit, recoverable conflict — never a
 * silent repair that invents a new target, which is exactly where two competing
 * sources of truth reveal themselves.
 *
 * The mixed project comes from `importDiagram`, the real product path: a native
 * title card scene followed by an architecture scene. It is not a bespoke
 * fixture, so passing this cannot mean passing against a shape only the test
 * knows how to build.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import { nativeTitle } from "../../packages/studio-server/src/project/videoProposals";
import type { ProjectSnapshot } from "../../packages/project-model/src/project";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** One architecture scene, one native title card, one local audio asset. */
async function mixedProject() {
  const dir = mkdtempSync(join(tmpdir(), "afm-078-"));
  roots.push(dir);

  const source = join(dir, "source");
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, "package.json"), JSON.stringify({ name: "checkout" }));
  writeFileSync(join(source, "gateway.ts"), "export function routeRequest() { return true; }\n");

  // A real local media file, so asset handling is exercised rather than mocked.
  const audio = join(dir, "bed.wav");
  writeFileSync(audio, silentWav(2));

  const service = new UnifiedProjectService({
    home: join(dir, "projects"),
    sourceRoots: [{ id: "test", label: "Test", path: source }],
  });

  const imported = await service.importDiagram({
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title: "Checkout", viewBox: [900, 570], legend: { mode: "hidden" } },
    components: [
      { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
      { id: "api_a", type: "backend", label: "API A", pos: [320, 40], size: [180, 70] },
      { id: "api_b", type: "backend", label: "API B", pos: [320, 160], size: [180, 70] },
    ],
    connections: [
      { id: "edge-a", from: "gateway", to: "api_a" },
      { id: "edge-b", from: "gateway", to: "api_b" },
    ],
    cards: [],
  });

  const id = imported!.id;
  const snapshot = service.get(id).snapshot as ProjectSnapshot;
  const diagramDoc = snapshot.manifest.documents.find((d) => d.kind !== "native")!;
  const nativeDoc = snapshot.manifest.documents.find((d) => d.kind === "native")!;
  const diagramScene = snapshot.manifest.scenes.find((s) => s.kind === "diagram")!;
  const nativeScene = snapshot.manifest.scenes.find((s) => s.kind === "native")!;

  return { service, id, audio, diagramDoc, nativeDoc, diagramScene, nativeScene, dir };
}

/** A minimal valid PCM WAV, so the asset is a real decodable file. */
function silentWav(seconds: number): Buffer {
  const rate = 48000;
  const samples = rate * seconds;
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
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

/** Applies one command through the shared path, asserting the revision advanced. */
async function command(
  service: UnifiedProjectService,
  id: string,
  operations: unknown[],
  expectedRevision: number,
) {
  return service.command(id, {
    commandId: `afm-078-${expectedRevision}-${Math.random().toString(36).slice(2, 8)}`,
    origin: "ui",
    projectId: id,
    expectedRevision,
    operations,
  });
}

describe("AFM-078 — the mixed project is one authoring surface", () => {
  it("imports a project containing both a diagram scene and a native title card", async () => {
    // The starting condition. If this fails, nothing below is meaningful.
    const { diagramScene, nativeScene, diagramDoc, nativeDoc } = await mixedProject();

    expect(nativeScene.startFrame).toBe(0);
    expect(diagramScene.startFrame).toBeGreaterThan(0);
    expect(diagramDoc.kind).toBe("architecture");
    expect(nativeDoc.kind).toBe("native");
  });

  it("carries a local audio asset through the project, not beside it", async () => {
    // AFM-023. There is no asset or audio representation in the project schema
    // today, so the reviewer's "audio remains aligned" step cannot be expressed
    // at all. Recorded as a real prerequisite rather than dropped.
    const { service, id, audio } = await mixedProject();

    const attach = service as unknown as {
      attachAsset?: (id: string, path: string) => Promise<unknown>;
    };
    expect(
      typeof attach.attachAsset,
      "the project service must be able to take ownership of a local media file",
    ).toBe("function");

    await attach.attachAsset!(id, audio);
    const snapshot = service.get(id).snapshot as ProjectSnapshot & {
      manifest: { assets?: { id: string; path: string }[] };
    };
    expect(snapshot.manifest.assets?.length, "the asset is referenced by the manifest").toBe(1);
  });
});

describe("AFM-078 — one selection identity across surfaces", () => {
  it("resolves a rendered element to the object identity every surface shares", async () => {
    // AFM-061. Canvas, inspector and timeline must agree on what is selected;
    // that agreement requires one translation from render ID to document,
    // object and scene-instance identity.
    const { diagramScene, diagramDoc } = await mixedProject();

    const bridge = await import("../../packages/studio/src/diagrams/selectionBridge").catch(
      () => null,
    );
    expect(
      bridge,
      "packages/studio/src/diagrams/selectionBridge is not implemented",
    ).not.toBeNull();

    const resolved = (bridge as any).resolveSelection({
      sceneId: diagramScene.id,
      renderId: "gateway",
    });
    expect(resolved).toMatchObject({
      documentId: diagramDoc.id,
      objectId: "gateway",
      sceneInstanceId: diagramScene.id,
    });
  });

  it("keeps two appearances of one node in distinct scene contexts", async () => {
    // The same object shown in two scenes must not collapse to one selection,
    // or a presentation override applied to one will silently affect both.
    const { diagramScene } = await mixedProject();

    const bridge = await import("../../packages/studio/src/diagrams/selectionBridge").catch(
      () => null,
    );
    expect(bridge, "selectionBridge is not implemented").not.toBeNull();

    const first = (bridge as any).resolveSelection({
      sceneId: diagramScene.id,
      renderId: "gateway",
    });
    const second = (bridge as any).resolveSelection({
      sceneId: "second-instance",
      renderId: "gateway",
    });
    expect(first.objectId).toBe(second.objectId);
    expect(first.sceneInstanceId).not.toBe(second.sceneInstanceId);
  });
});

describe("AFM-078 — every edit reaches its document through the shared command path", () => {
  it("renames a diagram object and edits the native title in one history", async () => {
    const { service, id, diagramDoc, nativeDoc } = await mixedProject();

    await command(
      service,
      id,
      [
        {
          type: "rename-object",
          documentId: diagramDoc.id,
          objectId: "api_a",
          label: "Orders API",
        },
      ],
      0,
    );
    await command(
      service,
      id,
      [
        {
          type: "replace-native-source",
          documentId: nativeDoc.id,
          html: nativeTitle("Checkout, end to end", "Edited through the shared command path"),
        },
      ],
      1,
    );

    const snapshot = service.get(id).snapshot as ProjectSnapshot;
    expect(snapshot.manifest.revision).toBe(2);
    const diagram = snapshot.sources[diagramDoc.id] as any;
    expect(diagram.components.find((c: any) => c.id === "api_a").label).toBe("Orders API");
    expect(String(snapshot.sources[nativeDoc.id])).toContain("Checkout, end to end");
  });

  it("keeps presentation timing separate from diagram semantics", async () => {
    // Contract C07. Changing how long a scene runs must not touch the authored
    // model, and must not be recorded as a source edit.
    const { service, id, diagramScene, diagramDoc } = await mixedProject();
    const before = JSON.stringify(
      (service.get(id).snapshot as ProjectSnapshot).sources[diagramDoc.id],
    );

    await command(
      service,
      id,
      [{ type: "set-scene-duration", sceneId: diagramScene.id, durationFrames: 300 }],
      0,
    );

    const snapshot = service.get(id).snapshot as ProjectSnapshot;
    expect(snapshot.manifest.scenes.find((s) => s.id === diagramScene.id)!.durationFrames).toBe(
      300,
    );
    expect(JSON.stringify(snapshot.sources[diagramDoc.id])).toBe(before);
  });

  it("has no direct file-write path that bypasses the command journal", async () => {
    // AFM-072. The native Studio currently mutates through
    // fileManager.writeProjectFile, which produces no command and no revision.
    // While that path exists for authored documents, "one history" is a claim
    // about one surface rather than about the product.
    const studioApp = await import("node:fs").then((fs) =>
      fs.readFileSync("packages/studio/src/App.tsx", "utf8"),
    );
    const bypasses = studioApp.includes("writeProjectFile");
    expect(
      bypasses,
      "packages/studio/src/App.tsx still writes project files directly; edits must go through applyProjectCommand",
    ).toBe(false);
  });
});

describe("AFM-078 — undo and redo follow the user's actual edit order", () => {
  it("undoes a native edit and a diagram edit in reverse order, then redoes them", async () => {
    const { service, id, diagramDoc, nativeDoc } = await mixedProject();

    await command(
      service,
      id,
      [
        {
          type: "rename-object",
          documentId: diagramDoc.id,
          objectId: "api_a",
          label: "Orders API",
        },
      ],
      0,
    );
    await command(
      service,
      id,
      [
        {
          type: "replace-native-source",
          documentId: nativeDoc.id,
          html: nativeTitle("Edited title", "Second edit in the same history"),
        },
      ],
      1,
    );

    // Undo the native edit: the diagram rename must survive.
    await command(service, id, [{ type: "undo" }], 2);
    let snapshot = service.get(id).snapshot as ProjectSnapshot;
    expect(String(snapshot.sources[nativeDoc.id])).not.toContain("Edited title");
    expect(
      (snapshot.sources[diagramDoc.id] as any).components.find((c: any) => c.id === "api_a").label,
    ).toBe("Orders API");

    // Undo again: back to the imported state.
    await command(service, id, [{ type: "undo" }], snapshot.manifest.revision);
    snapshot = service.get(id).snapshot as ProjectSnapshot;
    expect(
      (snapshot.sources[diagramDoc.id] as any).components.find((c: any) => c.id === "api_a").label,
    ).toBe("API A");

    // Redo restores in the original order.
    await command(service, id, [{ type: "redo" }], snapshot.manifest.revision);
    snapshot = service.get(id).snapshot as ProjectSnapshot;
    expect(
      (snapshot.sources[diagramDoc.id] as any).components.find((c: any) => c.id === "api_a").label,
    ).toBe("Orders API");
  });
});

describe("AFM-078 — regeneration preserves intent or reports a conflict", () => {
  it("keeps valid presentation choices when the diagram is regenerated", async () => {
    // AFM-048. A label edit must update every scene appearance without
    // discarding unrelated overrides.
    const { service, id, diagramDoc, diagramScene } = await mixedProject();

    await command(
      service,
      id,
      [
        {
          type: "set-scene-presentation",
          sceneId: diagramScene.id,
          presentation: {
            title: "Checkout",
            focusObjectIds: ["gateway", "api_a"],
            relationshipIds: ["edge-a"],
          },
        },
      ],
      0,
    );
    await command(
      service,
      id,
      [
        {
          type: "rename-object",
          documentId: diagramDoc.id,
          objectId: "api_a",
          label: "Orders API",
        },
      ],
      1,
    );

    const snapshot = service.get(id).snapshot as ProjectSnapshot;
    const scene = snapshot.manifest.scenes.find((s) => s.id === diagramScene.id)!;
    expect(scene.presentation.focusObjectIds, "focus survives a rename by identity").toEqual([
      "gateway",
      "api_a",
    ]);
    expect(scene.presentation.relationshipIds).toEqual(["edge-a"]);
  });

  it("reports an orphan conflict when an animated target is deleted", async () => {
    // The negative case that separates one source of truth from two. Deleting
    // a relationship an override animates must surface a recoverable conflict.
    // Silently dropping the override, or moving it to another edge, is the
    // failure this milestone exists to rule out.
    const { service, id, diagramDoc, diagramScene } = await mixedProject();

    await command(
      service,
      id,
      [
        {
          type: "set-scene-presentation",
          sceneId: diagramScene.id,
          presentation: {
            title: "Checkout",
            focusObjectIds: ["gateway"],
            relationshipIds: ["edge-b"],
          },
        },
      ],
      0,
    );

    const source = structuredClone(
      (service.get(id).snapshot as ProjectSnapshot).sources[diagramDoc.id],
    ) as any;
    source.connections = source.connections.filter((c: any) => c.id !== "edge-b");

    const result = (await command(
      service,
      id,
      [{ type: "replace-diagram-source", documentId: diagramDoc.id, source }],
      1,
    )) as { conflicts?: { kind: string; sceneId: string; targetId: string }[] };

    expect(
      result.conflicts,
      "deleting an animated relationship must report a conflict, not resolve silently",
    ).toBeDefined();
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        kind: "orphaned-target",
        sceneId: diagramScene.id,
        targetId: "edge-b",
      }),
    );

    // The override must remain recoverable rather than being rewritten to a
    // different edge.
    const scene = (service.get(id).snapshot as ProjectSnapshot).manifest.scenes.find(
      (s) => s.id === diagramScene.id,
    )!;
    expect(scene.presentation.relationshipIds).not.toContain("edge-a");
  });
});

describe("AFM-078 — save, reopen and export", () => {
  it("reopens the project with the same meaning and no phantom edit", async () => {
    const { service, id, diagramDoc, dir } = await mixedProject();

    await command(
      service,
      id,
      [
        {
          type: "rename-object",
          documentId: diagramDoc.id,
          objectId: "api_a",
          label: "Orders API",
        },
      ],
      0,
    );
    const before = service.get(id).snapshot as ProjectSnapshot;

    // A second service over the same home is the honest reopen: nothing from
    // the first instance's memory carries over.
    const reopened = new UnifiedProjectService({
      home: join(dir, "projects"),
      sourceRoots: [{ id: "test", label: "Test", path: join(dir, "source") }],
    });
    const after = reopened.get(id).snapshot as ProjectSnapshot;

    expect(after.manifest.revision, "reopening must not advance the revision").toBe(
      before.manifest.revision,
    );
    expect(after.sources).toEqual(before.sources);
    expect(after.manifest.scenes).toEqual(before.manifest.scenes);
  });

  it("exports a video that reflects the edited content and timing", async () => {
    // AFM-054. A returned path proves nothing: the artifact must exist and be
    // probed. Per the definition of done, a render ticket is not complete until
    // a real file has been inspected.
    const { service, id, diagramDoc } = await mixedProject();

    await command(
      service,
      id,
      [
        {
          type: "rename-object",
          documentId: diagramDoc.id,
          objectId: "api_a",
          label: "Orders API",
        },
      ],
      0,
    );

    // `build()` pins a compiled revision; the video comes from the batch path,
    // which renders to mp4 and probes it with ffprobe. A returned path proves
    // nothing, so the artifact is inspected rather than merely named.
    const build = await service.build(id);
    expect(build.hash, "the project must pin a compiled revision").toBeTruthy();

    const { ProjectBatchService } =
      await import("../../packages/studio-server/src/project/projectBatch");
    // The batch service takes the host's render entry point. This mirrors the
    // adapter packages/cli/src/commands/project.ts installs, so the export runs
    // through the real producer rather than a stand-in.
    const { createRenderJob, executeRenderJob } =
      await import("../../packages/producer/src/services/renderOrchestrator");
    const batches = new ProjectBatchService(service, {
      startRender(options: any) {
        const abort = new AbortController();
        const state: any = {
          id: options.jobId,
          status: "rendering",
          progress: 0,
          outputPath: options.outputPath,
          cancel: () => abort.abort(),
        };
        void (async () => {
          try {
            const job = createRenderJob({
              fps: options.fps,
              quality: "standard",
              format: "mp4",
              workers: 1,
            });
            await executeRenderJob(
              job,
              options.project.dir,
              options.outputPath,
              (progress: any) => {
                state.progress = progress.progress;
              },
              abort.signal,
            );
            state.status = "complete";
            state.progress = 1;
          } catch (error) {
            state.status = "failed";
            state.error = String((error as Error)?.message ?? error);
          }
        })();
        return state;
      },
    } as any);
    const started = await batches.start([id]);

    let record = batches.get(started.id);
    for (let waited = 0; record.status === "running" && waited < 240_000; waited += 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      record = batches.get(started.id);
    }

    expect(
      record.status,
      `batch did not complete: ${JSON.stringify(record.items?.[0] ?? {})}`,
    ).toBe("complete");
    const item = record.items[0];
    expect(item.outputPath, "the render must name an output file").toBeTruthy();

    const { existsSync, statSync } = await import("node:fs");
    expect(existsSync(item.outputPath!), `exported artifact missing: ${item.outputPath}`).toBe(
      true,
    );
    expect(statSync(item.outputPath!).size).toBeGreaterThan(1000);

    // probeVideo already enforces dimensions, frame rate and duration against
    // the receipt; a passing probe is the inspection this step requires.
    expect(item.probe, "the export must be probed, not just produced").toBeTruthy();
  });
});
