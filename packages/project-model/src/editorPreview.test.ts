import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { editorPreviewFixture } from "./editorPreview.fixture";
import {
  assertEditorPreviewSession,
  compileSceneBindings,
  editorPreviewUrl,
  resolvePreviewScene,
  sceneEmissionAddress,
  sceneLocalFrame,
} from "./editorPreview";

describe("AFM-059/060 pinned scene identity", () => {
  it("accepts a mixed project with two appearances of one diagram", () => {
    const { session } = editorPreviewFixture();
    assertEditorPreviewSession(session);
    assert.equal(session.scenes[1]!.documentId, session.scenes[2]!.documentId);
    assert.notEqual(session.scenes[1]!.sceneId, session.scenes[2]!.sceneId);
    assert.notEqual(session.scenes[1]!.outputPath, session.scenes[2]!.outputPath);
  });
  it("uses the emitter convention without making its array index semantic identity", () => {
    const { snapshot } = editorPreviewFixture();
    const original = JSON.stringify(snapshot);
    const a = compileSceneBindings(snapshot);
    assert.equal(JSON.stringify(snapshot), original);
    snapshot.manifest.scenes = [
      snapshot.manifest.scenes[0]!,
      snapshot.manifest.scenes[2]!,
      snapshot.manifest.scenes[1]!,
    ];
    const b = compileSceneBindings(snapshot);
    assert.equal(a[1]!.sceneId, b[2]!.sceneId);
    assert.notEqual(a[1]!.outputPath, b[2]!.outputPath);
  });
  it("sanitization cannot collide across two emitted appearances", () => {
    assert.notEqual(
      sceneEmissionAddress("a:b", 0).outputPath,
      sceneEmissionAddress("a.b", 1).outputPath,
    );
  });
  it("generates only build-pinned same-origin URLs", () => {
    const { session } = editorPreviewFixture();
    assert.equal(
      editorPreviewUrl(session),
      `/api/vflow/projects/preview-test/editor/previews/${session.buildHash}/view`,
    );
    assert.ok(editorPreviewUrl(session, "system:two").endsWith("?sceneId=system%3Atwo"));
  });
  it("maps the four render token forms to their authoring document", () => {
    const { session } = editorPreviewFixture();
    const s = session.scenes[1]!;
    for (const token of [s.renderId, s.hostId, s.hostCompositionId, s.outputPath]) {
      const result = resolvePreviewScene(session, {
        renderToken: token,
        buildHash: session.buildHash,
        revisionHash: session.revisionHash,
      });
      assert.equal(result.documentId, "diagram");
      assert.equal(result.sourcePath, "architecture.json");
      assert.equal(result.editOwner, "diagram-command");
    }
  });
  it("maps native scenes to native authoring rather than their generated filenames", () => {
    const { session } = editorPreviewFixture();
    const result = resolvePreviewScene(session, { sceneId: "opening" });
    assert.equal(result.editOwner, "native-document");
    assert.equal(result.sourcePath, "title.html");
    assert.notEqual(result.sourcePath, result.outputPath);
  });
  it("rejects source-path-only selection when that source has repeated appearances", () => {
    assert.throws(
      () =>
        resolvePreviewScene(editorPreviewFixture().session, { sourcePath: "architecture.json" }),
      /exactly one/,
    );
  });
  it("rejects contradictory scene and render context", () => {
    const { session } = editorPreviewFixture();
    assert.throws(
      () =>
        resolvePreviewScene(session, {
          sceneId: "opening",
          renderToken: "el-1",
          buildHash: session.buildHash,
          revisionHash: session.revisionHash,
        }),
      /exactly one/,
    );
  });
  it("rejects an old generated token after a reorder rather than guessing", () => {
    const { session } = editorPreviewFixture();
    assert.throws(
      () =>
        resolvePreviewScene(session, {
          renderToken: "scene-1-system-two.html",
          buildHash: session.buildHash,
          revisionHash: session.revisionHash,
        }),
      /exactly one/,
    );
  });
  it("rejects a render token without its captured build identity", () => {
    assert.throws(
      () => resolvePreviewScene(editorPreviewFixture().session, { renderToken: "el-0" }),
      /pinned preview/,
    );
  });
  it("rejects a reused host token from an older build", () => {
    const { session } = editorPreviewFixture();
    assert.throws(
      () =>
        resolvePreviewScene(session, {
          renderToken: "el-0",
          buildHash: "e".repeat(64),
          revisionHash: session.revisionHash,
        }),
      /pinned preview/,
    );
  });
  it("does not return references that let a selection mutate its receipt", () => {
    const { session } = editorPreviewFixture();
    resolvePreviewScene(session, { sceneId: "opening" }).sourcePath = "changed.html";
    assert.equal(session.scenes[0]!.sourcePath, "title.html");
  });
  it("converts master frames to clamped half-open local frames without decimal fps", () => {
    const scene = { startFrame: 75, durationFrames: 180 };
    assert.equal(sceneLocalFrame(scene, 0), 0);
    assert.equal(sceneLocalFrame(scene, 75), 0);
    assert.equal(sceneLocalFrame(scene, 254), 179);
    assert.equal(sceneLocalFrame(scene, 999), 179);
  });
  for (const frame of [-1, NaN, Infinity, 2.5])
    it(`rejects invalid frame ${frame}`, () => {
      assert.throws(() => sceneLocalFrame({ startFrame: 75, durationFrames: 180 }, frame));
    });
  const invalid: Array<[string, (s: any) => void]> = [
    ["missing build hash", (s) => delete s.buildHash],
    ["wrong revision hash", (s) => (s.revisionHash = "bad")],
    ["negative revision", (s) => (s.revision = -1)],
    ["foreign URL as project", (s) => (s.projectId = "https://host/")],
    ["generated editable", (s) => (s.generatedOutputEditable = true)],
    ["native history", (s) => (s.historyOwner = "native")],
    ["zero fps denominator", (s) => (s.output.fps.denominator = 0)],
    ["fractional width", (s) => (s.output.width = 1280.1)],
    ["wrong duration", (s) => s.durationFrames++],
    ["empty scenes", (s) => (s.scenes = [])],
    ["duplicate scene", (s) => (s.scenes[2].sceneId = s.scenes[1].sceneId)],
    ["wrong emission path", (s) => (s.scenes[0].outputPath = "index.html")],
    ["wrong edit owner", (s) => (s.scenes[1].editOwner = "native-document")],
    ["overlap", (s) => (s.scenes[1].startFrame = 10)],
    ["unsafe source", (s) => (s.scenes[0].sourcePath = "../title.html")],
    ["control in path", (s) => (s.scenes[0].sourcePath = "title\n.html")],
    ["document kind mismatch", (s) => (s.scenes[1].documentKind = "native")],
    ["same document different path", (s) => (s.scenes[2].sourcePath = "other.json")],
    ["different documents same path", (s) => (s.scenes[0].sourcePath = "architecture.json")],
  ];
  for (const [label, mutate] of invalid)
    it(`rejects ${label}`, () => {
      const { session } = editorPreviewFixture();
      mutate(session);
      assert.throws(() => assertEditorPreviewSession(session));
    });
  it("rejects an unknown requested scene", () => {
    assert.throws(() => editorPreviewUrl(editorPreviewFixture().session, "absent"));
  });
  it("rejects a selection without identity", () => {
    assert.throws(() => resolvePreviewScene(editorPreviewFixture().session, {}));
  });
});
