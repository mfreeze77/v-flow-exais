/** Read-only projection of an already verified committed project. No path guessing. */
import { createHash } from "node:crypto";
import {
  assertEditorProjectView,
  assertEditorRevision,
  type EditorDocumentContent,
  type EditorProjectView,
  type EditorRevision,
  type ProjectSnapshot,
} from "@hyperframes/project-model";

export interface EditorCommittedInput {
  snapshot: ProjectSnapshot;
  pointer: { revision: number; sha256: string };
  index: { history?: { undo: readonly unknown[]; redo: readonly unknown[] } };
}

export class EditorReadError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EditorReadError";
  }
}

const digest = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");

function revisionOf(current: EditorCommittedInput): EditorRevision {
  const ref = {
    projectId: current.snapshot.manifest.id,
    revision: current.pointer.revision,
    revisionHash: current.pointer.sha256,
  };
  assertEditorRevision(ref);
  if (current.snapshot.manifest.revision !== ref.revision)
    throw new Error("editor/inconsistent-revision: snapshot and pointer disagree.");
  return ref;
}

/** Native bytes stay exact. Diagram JSON is a display serialization, never written on read. */
function contentOf(current: EditorCommittedInput, documentId: string): string {
  const doc = current.snapshot.manifest.documents.find((d) => d.id === documentId);
  if (!doc)
    throw new EditorReadError(
      404,
      "editor/document-not-found",
      "No authored document has that ID.",
    );
  if (!Object.hasOwn(current.snapshot.sources, documentId))
    throw new Error("editor/missing-source: committed authoring source is absent.");
  const source = current.snapshot.sources[documentId];
  if (doc.kind === "native") {
    if (typeof source !== "string") throw new Error("editor/invalid-source: expected native HTML.");
    return source;
  }
  if (!source || typeof source !== "object" || Array.isArray(source))
    throw new Error("editor/invalid-source: expected authored diagram JSON.");
  return JSON.stringify(source, null, 2);
}

export function projectEditorView(current: EditorCommittedInput): EditorProjectView {
  const { manifest } = current.snapshot;
  const view: EditorProjectView = {
    schemaVersion: 1,
    ...revisionOf(current),
    title: manifest.title,
    documents: manifest.documents.map((doc) => ({
      documentId: doc.id,
      path: doc.path,
      kind: doc.kind,
      contentHash: digest(contentOf(current, doc.id)),
      sceneInstanceIds: manifest.scenes.filter((s) => s.documentId === doc.id).map((s) => s.id),
    })),
    assets: (manifest.assets ?? []).map((asset) => ({
      assetId: asset.id,
      path: asset.path,
      contentHash: asset.sha256,
      displayName: asset.origin.name,
      mediaType: asset.mediaType,
      byteLength: asset.byteLength,
    })),
    scenes: manifest.scenes.map(({ id, documentId, kind, startFrame, durationFrames }) => ({
      id,
      documentId,
      kind,
      startFrame,
      durationFrames,
    })),
    history: {
      owner: "project-journal",
      canUndo: !!current.index.history?.undo.length,
      canRedo: !!current.index.history?.redo.length,
    },
    unresolvedConflictCount: manifest.regenerationConflicts?.length ?? 0,
    writeOwner: "project-command",
    generatedOutputEditable: false,
  };
  assertEditorProjectView(view);
  return view;
}

export function assertEditorReadMatches(
  current: EditorCommittedInput,
  expected: EditorRevision,
): void {
  assertEditorRevision(expected);
  const actual = revisionOf(current);
  if (
    actual.projectId !== expected.projectId ||
    actual.revision !== expected.revision ||
    actual.revisionHash !== expected.revisionHash
  )
    throw new EditorReadError(
      409,
      "editor/stale-read",
      "The committed project changed. Reload its view; keep any unsaved draft.",
    );
}

/** Never interpret a generated composition filename as an authoring document. */
export function projectEditorDocument(
  current: EditorCommittedInput,
  expected: EditorRevision,
  documentId: string,
): EditorDocumentContent {
  assertEditorReadMatches(current, expected);
  const doc = current.snapshot.manifest.documents.find((d) => d.id === documentId);
  if (!doc)
    throw new EditorReadError(
      404,
      "editor/document-not-found",
      "No authored document has that ID.",
    );
  const content = contentOf(current, documentId);
  return {
    ...revisionOf(current),
    documentId,
    path: doc.path,
    kind: doc.kind,
    contentHash: digest(content),
    content,
  };
}

export function editorRevisionFromQuery(
  projectId: string,
  revision: string | undefined,
  revisionHash: string | undefined,
): EditorRevision {
  if (!revision || !/^(0|[1-9]\d*)$/.test(revision))
    throw new EditorReadError(
      400,
      "editor/revision-required",
      "An exact revision and revisionHash are required.",
    );
  const ref = { projectId, revision: Number(revision), revisionHash };
  try {
    assertEditorRevision(ref);
  } catch {
    throw new EditorReadError(
      400,
      "editor/revision-required",
      "An exact revision and revisionHash are required.",
    );
  }
  return ref;
}
