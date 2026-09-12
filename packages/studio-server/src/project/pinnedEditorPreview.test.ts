import { afterEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import { editorPreviewFixture } from "../../../project-model/src/editorPreview.fixture";
import {
  readPinnedEditorPreview,
  readPinnedPreviewFile,
  previewAssetPath,
} from "./pinnedEditorPreview";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(mutate?: (body: any) => void) {
  const root = mkdtempSync(join(tmpdir(), "vflow-pinned-preview-"));
  roots.push(root);
  const { session } = editorPreviewFixture();
  const assetName = `${"f".repeat(64)}.png`;
  const files: Record<string, string> = {
    "index.html": "<html>master</html>",
    "assets/gsap.min.js": "/* installed fixture bytes */",
    [`assets/${assetName}`]: "image-fixture",
  };
  for (const scene of session.scenes) files[scene.outputPath] = `<html>${scene.sceneId}</html>`;
  const body = {
    schemaVersion: 1,
    projectId: session.projectId,
    revision: session.revision,
    revisionHash: session.revisionHash,
    authoringHash: session.authoringHash,
    output: session.output,
    durationFrames: session.durationFrames,
    sceneBindings: session.scenes,
    sceneIds: session.scenes.map((s) => s.sceneId),
    files: Object.fromEntries(Object.entries(files).map(([p, bytes]) => [p, sha256(bytes)])),
  };
  mutate?.(body);
  const buildHash = sha256(canonicalJson(body));
  const dir = join(root, ".vflow/builds", buildHash);
  mkdirSync(dir, { recursive: true });
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  }
  writeFileSync(join(dir, "build-receipt.json"), canonicalJson({ ...body, buildHash }));
  return { root, dir, buildHash, assetName, body, projectId: session.projectId, files };
}

describe("AFM-059 immutable preview resources", () => {
  it("loads a verified manifest with explicit source and generated addresses", () => {
    const f = fixture();
    const result = readPinnedEditorPreview(f.root, f.projectId, f.buildHash);
    assert.equal(result.session.scenes[0]!.sourcePath, "title.html");
    assert.equal(result.session.scenes[0]!.outputPath, "scene-0-opening.html");
    assert.equal(result.session.generatedOutputEditable, false);
  });
  it("reads the named build without consulting a changed CURRENT pointer", () => {
    const f = fixture();
    writeFileSync(
      join(f.root, ".vflow/CURRENT"),
      "a later revision or corrupt pointer is not the requested build",
    );
    const before = readFileSync(join(f.root, ".vflow/CURRENT"), "utf8");
    const result = readPinnedEditorPreview(f.root, f.projectId, f.buildHash);
    assert.equal(readPinnedPreviewFile(result, "index.html").toString(), "<html>master</html>");
    assert.equal(readFileSync(join(f.root, ".vflow/CURRENT"), "utf8"), before);
  });
  it("does not serve a build through another project identity", () => {
    const f = fixture();
    assert.throws(() => readPinnedEditorPreview(f.root, "different", f.buildHash), /belong/);
  });
  it("rejects a malformed hash before reading any directory", () => {
    assert.throws(
      () => readPinnedEditorPreview("/does-not-exist", "test", "../escape"),
      /Invalid build/,
    );
  });
  it("rejects a modified receipt", () => {
    const f = fixture();
    writeFileSync(
      join(f.dir, "build-receipt.json"),
      JSON.stringify({ ...f.body, revision: 4, buildHash: f.buildHash }),
    );
    assert.throws(() => readPinnedEditorPreview(f.root, f.projectId, f.buildHash), /hash check/);
  });
  it("validates receipt shape even when its digest is internally correct", () => {
    const f = fixture((b) => {
      b.sceneBindings = [];
    });
    assert.throws(
      () => readPinnedEditorPreview(f.root, f.projectId, f.buildHash),
      /scene bindings/i,
    );
  });
  it("requires all mapped scene outputs in the receipt", () => {
    const f = fixture((b) => {
      delete b.files["scene-0-opening.html"];
    });
    assert.throws(() => readPinnedEditorPreview(f.root, f.projectId, f.buildHash), /unlisted/);
  });
  it("rejects receipt paths that escape the owned build", () => {
    const f = fixture((b) => {
      b.files["../outside"] = "a".repeat(64);
    });
    assert.throws(
      () => readPinnedEditorPreview(f.root, f.projectId, f.buildHash),
      /Invalid file entry/,
    );
  });
  it("hash-verifies a scene's real bytes on each read", () => {
    const f = fixture();
    const result = readPinnedEditorPreview(f.root, f.projectId, f.buildHash);
    writeFileSync(join(f.dir, "scene-0-opening.html"), "modified");
    assert.throws(() => readPinnedPreviewFile(result, "scene-0-opening.html"), /no longer match/);
  });
  it("does not substitute live project bytes for a missing build asset", () => {
    const f = fixture();
    const result = readPinnedEditorPreview(f.root, f.projectId, f.buildHash);
    rmSync(join(f.dir, "assets", f.assetName));
    mkdirSync(join(f.root, "assets"));
    writeFileSync(join(f.root, "assets", f.assetName), "new bytes");
    assert.throws(() => readPinnedPreviewFile(result, `assets/${f.assetName}`));
  });
  it("refuses an unlisted file even when it exists in the build directory", () => {
    const f = fixture();
    writeFileSync(join(f.dir, "unlisted.txt"), "private");
    assert.throws(
      () =>
        readPinnedPreviewFile(
          readPinnedEditorPreview(f.root, f.projectId, f.buildHash),
          "unlisted.txt",
        ),
      /does not contain/,
    );
  });
  it("rejects a symlink resource rather than following it", () => {
    const f = fixture();
    const result = readPinnedEditorPreview(f.root, f.projectId, f.buildHash);
    const target = join(f.root, "outside");
    writeFileSync(target, "image-fixture");
    rmSync(join(f.dir, "assets", f.assetName));
    symlinkSync(target, join(f.dir, "assets", f.assetName));
    assert.throws(() => readPinnedPreviewFile(result, `assets/${f.assetName}`), /Symlinks/);
  });
  it("rejects a directory where receipt bytes should be", () => {
    const f = fixture();
    rmSync(join(f.dir, "build-receipt.json"));
    mkdirSync(join(f.dir, "build-receipt.json"));
    assert.throws(() => readPinnedEditorPreview(f.root, f.projectId, f.buildHash), /regular file/);
  });
  it("serves only the installed script and registered WAV/PNG address forms", () => {
    assert.equal(previewAssetPath("gsap.min.js").mime, "text/javascript; charset=utf-8");
    assert.equal(previewAssetPath(`${"a".repeat(64)}.png`).mime, "image/png");
    assert.equal(previewAssetPath(`${"a".repeat(64)}.wav`).mime, "audio/wav");
    for (const name of ["../secret", "random.js", "fake.png", "%2e%2e", "GSAP.MIN.JS"])
      assert.throws(() => previewAssetPath(name));
  });
});
