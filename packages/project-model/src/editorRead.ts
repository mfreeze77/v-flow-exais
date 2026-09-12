/** AFM-059/060: the read contract for an editor backed by committed authoring state.
 * These values contain portable references, never a project root or build directory.
 * Reading a view cannot create a revision, a build, or an independent history.
 */
import { isAuthoringPath, type DocumentReference, type ProjectScene } from "./project";

export interface EditorRevision {
  projectId: string;
  revision: number;
  revisionHash: string;
}

export interface EditorDocument {
  documentId: string;
  path: string;
  kind: DocumentReference["kind"];
  contentHash: string;
  sceneInstanceIds: string[];
}

export interface EditorAsset {
  assetId: string;
  path: string;
  contentHash: string;
  displayName: string;
  mediaType: "image/png" | "audio/wav";
  byteLength: number;
}

export interface EditorProjectView extends EditorRevision {
  schemaVersion: 1;
  title: string;
  documents: EditorDocument[];
  assets: EditorAsset[];
  scenes: Array<Pick<ProjectScene, "id" | "documentId" | "kind" | "startFrame" | "durationFrames">>;
  history: { owner: "project-journal"; canUndo: boolean; canRedo: boolean };
  unresolvedConflictCount: number;
  writeOwner: "project-command";
  generatedOutputEditable: false;
}

export interface EditorDocumentContent extends EditorRevision {
  documentId: string;
  path: string;
  kind: DocumentReference["kind"];
  contentHash: string;
  content: string;
}

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const integer = (v: unknown, min = 0): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min;
const kinds = new Set(["architecture", "workflow", "sequence", "dataflow", "lifecycle", "native"]);

/** Transport inputs are relative authoring paths, not URL strings or filesystem roots. */
export function normalizeEditorPath(value: string): string {
  if (typeof value !== "string" || !value || value.length > 500)
    throw new Error("editor/invalid-path: expected a bounded authoring path.");
  const path = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!isAuthoringPath(path))
    throw new Error("editor/invalid-path: path is not a portable authoring reference.");
  return path;
}

function samePath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return normalizeEditorPath(value) === value;
  } catch {
    return false;
  }
}

export function assertEditorRevision(value: unknown): asserts value is EditorRevision {
  if (
    !record(value) ||
    !id(value.projectId) ||
    !integer(value.revision) ||
    !hash(value.revisionHash)
  )
    throw new Error(
      "editor/invalid-revision: a project, revision and immutable index hash are required.",
    );
}

/** Validate the read boundary instead of trusting an HTTP 200 and a type cast. */
export function assertEditorProjectView(value: unknown): asserts value is EditorProjectView {
  assertEditorRevision(value);
  const v = value as unknown as Record<string, unknown>;
  const fail = (): never => {
    throw new Error("editor/invalid-view: inconsistent authoring view.");
  };
  if (
    v.schemaVersion !== 1 ||
    typeof v.title !== "string" ||
    v.writeOwner !== "project-command" ||
    v.generatedOutputEditable !== false ||
    !integer(v.unresolvedConflictCount) ||
    !record(v.history) ||
    v.history.owner !== "project-journal" ||
    typeof v.history.canUndo !== "boolean" ||
    typeof v.history.canRedo !== "boolean" ||
    !Array.isArray(v.documents) ||
    v.documents.length < 1 ||
    v.documents.length > 100 ||
    !Array.isArray(v.scenes) ||
    v.scenes.length < 1 ||
    v.scenes.length > 100 ||
    !Array.isArray(v.assets) ||
    v.assets.length > 128
  )
    fail();
  const docs = new Map<string, EditorDocument>();
  const paths = new Set<string>();
  for (const entry of v.documents as unknown[]) {
    if (
      !record(entry) ||
      !id(entry.documentId) ||
      !samePath(entry.path) ||
      typeof entry.kind !== "string" ||
      !kinds.has(entry.kind) ||
      !hash(entry.contentHash) ||
      !Array.isArray(entry.sceneInstanceIds) ||
      !entry.sceneInstanceIds.every(id) ||
      new Set(entry.sceneInstanceIds).size !== entry.sceneInstanceIds.length
    )
      fail();
    const doc = entry as unknown as EditorDocument;
    const normalized = doc.path.normalize("NFC").toLowerCase();
    if (docs.has(doc.documentId) || paths.has(normalized)) fail();
    docs.set(doc.documentId, doc);
    paths.add(normalized);
  }
  const seenScenes = new Set<string>();
  for (const entry of v.scenes as unknown[]) {
    if (
      !record(entry) ||
      !id(entry.id) ||
      !id(entry.documentId) ||
      !integer(entry.startFrame) ||
      !integer(entry.durationFrames, 1) ||
      !["native", "diagram"].includes(String(entry.kind))
    )
      fail();
    const scene = entry as unknown as EditorProjectView["scenes"][number];
    const doc = docs.get(scene.documentId);
    if (
      !doc ||
      seenScenes.has(scene.id) ||
      (doc.kind === "native") !== (scene.kind === "native") ||
      !doc.sceneInstanceIds.includes(scene.id)
    )
      fail();
    seenScenes.add(scene.id);
  }
  for (const doc of docs.values()) {
    const actual = (v.scenes as EditorProjectView["scenes"]).filter(
      (s) => s.documentId === doc.documentId,
    );
    if (
      actual.length !== doc.sceneInstanceIds.length ||
      doc.sceneInstanceIds.some((key) => !actual.some((s) => s.id === key))
    )
      fail();
  }
  const assetIds = new Set<string>();
  for (const entry of v.assets as unknown[]) {
    if (
      !record(entry) ||
      typeof entry.assetId !== "string" ||
      !hash(entry.contentHash) ||
      entry.assetId !== `asset-${entry.contentHash}` ||
      !samePath(entry.path) ||
      !["image/png", "audio/wav"].includes(String(entry.mediaType)) ||
      !integer(entry.byteLength, 1) ||
      entry.byteLength > 64 * 1024 * 1024 ||
      typeof entry.displayName !== "string" ||
      entry.displayName.length > 240
    )
      fail();
    const asset = entry as unknown as EditorAsset;
    const expectedPath = `assets/${asset.contentHash}.${asset.mediaType === "image/png" ? "png" : "wav"}`;
    if (
      asset.path !== expectedPath ||
      assetIds.has(asset.assetId) ||
      paths.has(asset.path.toLowerCase())
    )
      fail();
    assetIds.add(asset.assetId);
    paths.add(asset.path.toLowerCase());
  }
}

export function assertEditorDocumentContent(
  value: unknown,
): asserts value is EditorDocumentContent {
  assertEditorRevision(value);
  const v = value as unknown as Record<string, unknown>;
  if (
    !id(v.documentId) ||
    !samePath(v.path) ||
    !kinds.has(String(v.kind)) ||
    !hash(v.contentHash) ||
    typeof v.content !== "string"
  )
    throw new Error("editor/invalid-document: malformed authoring response.");
}
