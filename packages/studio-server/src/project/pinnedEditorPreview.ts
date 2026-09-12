/** Read-only access to an already-built preview. Never calls build() or follows CURRENT. */
import { constants, closeSync, fstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import {
  assertEditorPreviewSession,
  EditorPreviewError,
  type EditorPreviewSession,
} from "@hyperframes/project-model";
import { assertContainedPath, canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import type { PinnedBuild } from "./projectBuild";

export interface PinnedEditorPreview extends PinnedBuild {
  session: EditorPreviewSession;
  fileHashes: Record<string, string>;
}
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function readBounded(root: string, path: string, max: number): Buffer {
  assertContainedPath(root, path);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > max)
      throw new EditorPreviewError(
        "editor/invalid-build-file",
        "Preview requires a bounded regular file.",
        409,
      );
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count)
        throw new EditorPreviewError(
          "editor/changed-build-file",
          "Pinned preview file was truncated.",
          409,
        );
      offset += count;
    }
    const extra = Buffer.alloc(1);
    const grew = readSync(fd, extra, 0, 1, bytes.length) !== 0;
    const after = fstatSync(fd);
    if (
      grew ||
      after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs ||
      after.ctimeMs !== stat.ctimeMs
    )
      throw new EditorPreviewError(
        "editor/changed-build-file",
        "Pinned preview file changed while reading.",
        409,
      );
    return bytes;
  } finally {
    closeSync(fd);
  }
}

function safeBuildPath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 600 &&
    !value.startsWith("/") &&
    !/[\\:]/.test(value) &&
    ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) &&
    value.split("/").every((part) => !!part && !part.startsWith(".") && !/[. ]$/.test(part))
  );
}

export function readPinnedEditorPreview(
  root: string,
  projectId: string,
  buildHash: string,
): PinnedEditorPreview {
  if (!hash(buildHash))
    throw new EditorPreviewError("editor/invalid-build", "Invalid build identity.");
  const dir = join(root, ".vflow/builds", buildHash);
  const bytes = readBounded(root, join(dir, "build-receipt.json"), 4 * 1024 * 1024);
  const receipt: unknown = JSON.parse(bytes.toString("utf8"));
  if (
    !record(receipt) ||
    receipt.buildHash !== buildHash ||
    receipt.projectId !== projectId ||
    !record(receipt.files)
  )
    throw new EditorPreviewError(
      "editor/foreign-build",
      "Build receipt does not belong to this project.",
      409,
    );
  const { buildHash: _hash, ...body } = receipt;
  if (sha256(canonicalJson(body)) !== buildHash)
    throw new EditorPreviewError(
      "editor/corrupt-build",
      "Build receipt failed its content hash check.",
      409,
    );
  const fileHashes: Record<string, string> = Object.create(null);
  for (const [name, digest] of Object.entries(receipt.files)) {
    if (!safeBuildPath(name) || !hash(digest))
      throw new EditorPreviewError(
        "editor/corrupt-build",
        "Invalid file entry in the pinned receipt.",
        409,
      );
    fileHashes[name] = digest;
  }
  const session: unknown = {
    schemaVersion: 1,
    projectId: receipt.projectId,
    revision: receipt.revision,
    revisionHash: receipt.revisionHash,
    buildHash,
    authoringHash: receipt.authoringHash,
    output: receipt.output,
    durationFrames: receipt.durationFrames,
    scenes: receipt.sceneBindings,
    generatedOutputEditable: false,
    historyOwner: "project-journal",
  };
  // Older builds remain valid for their old consumers; prepare a new preview for this API.
  assertEditorPreviewSession(session);
  if (
    !Object.hasOwn(fileHashes, "index.html") ||
    session.scenes.some((s) => !Object.hasOwn(fileHashes, s.outputPath))
  )
    throw new EditorPreviewError(
      "editor/corrupt-build",
      "Preview mapping references an unlisted output file.",
      409,
    );
  return {
    hash: buildHash,
    dir,
    projectId,
    revision: session.revision,
    receipt,
    session,
    fileHashes,
  };
}

/** No fallback to the live project, upload, or a different build. */
export function readPinnedPreviewFile(build: PinnedEditorPreview, path: string): Buffer {
  if (!Object.hasOwn(build.fileHashes, path) || !safeBuildPath(path))
    throw new EditorPreviewError(
      "editor/preview-file-not-found",
      "The pinned build does not contain this resource.",
      404,
    );
  const bytes = readBounded(build.dir, join(build.dir, path), 128 * 1024 * 1024);
  if (sha256(bytes) !== build.fileHashes[path])
    throw new EditorPreviewError(
      "editor/corrupt-build",
      "Pinned preview bytes no longer match the receipt.",
      409,
    );
  return bytes;
}

export function previewAssetPath(name: string): { path: string; mime: string } {
  if (name === "gsap.min.js")
    return { path: "assets/gsap.min.js", mime: "text/javascript; charset=utf-8" };
  if (/^[a-f0-9]{64}\.png$/.test(name)) return { path: `assets/${name}`, mime: "image/png" };
  if (/^[a-f0-9]{64}\.wav$/.test(name)) return { path: `assets/${name}`, mime: "audio/wav" };
  throw new EditorPreviewError("editor/preview-file-not-found", "Unknown preview asset.", 404);
}
