/** AFM-059/060: generated playback identity is never an authoring filename. */
import type { DocumentReference, ProjectManifest, ProjectScene, ProjectSnapshot } from "./project";
import { normalizeEditorPath, type EditorRevision } from "./editorRead";

export interface CompiledSceneBinding {
  sceneId: string;
  documentId: string;
  documentKind: DocumentReference["kind"];
  sourcePath: string;
  kind: "diagram" | "native";
  startFrame: number;
  durationFrames: number;
  /** Build-local addresses; never pass these to an authoring writer. */
  outputPath: string;
  renderId: string;
  hostId: string;
  hostCompositionId: string;
  editOwner: "diagram-command" | "native-document";
}

export interface EditorPreviewSession extends EditorRevision {
  schemaVersion: 1;
  buildHash: string;
  authoringHash: string;
  output: ProjectManifest["output"];
  durationFrames: number;
  scenes: CompiledSceneBinding[];
  generatedOutputEditable: false;
  historyOwner: "project-journal";
}

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const kinds = new Set(["architecture", "workflow", "sequence", "dataflow", "lifecycle", "native"]);

export class EditorPreviewError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "EditorPreviewError";
  }
}

function fail(message: string): never {
  throw new EditorPreviewError("editor/invalid-preview", message);
}

/** Shared by the emitter and receipt validator: there is one naming convention. */
export function sceneEmissionAddress(sceneId: string, index: number) {
  if (!id(sceneId) || !integer(index, 0, 99)) fail("Invalid scene emission identity.");
  const renderId = `scene-${index}-${sceneId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return {
    renderId,
    outputPath: `${renderId}.html`,
    hostId: `el-${index}`,
    hostCompositionId: `slot-${index}`,
  };
}

export function compileSceneBindings(snapshot: ProjectSnapshot): CompiledSceneBinding[] {
  return snapshot.manifest.scenes.map((scene, index) => {
    const doc = snapshot.manifest.documents.find((item) => item.id === scene.documentId);
    if (!doc || (doc.kind === "native") !== (scene.kind === "native"))
      fail("Scene has no matching authoritative document.");
    return {
      sceneId: scene.id,
      documentId: doc.id,
      documentKind: doc.kind,
      sourcePath: doc.path,
      kind: scene.kind,
      startFrame: scene.startFrame,
      durationFrames: scene.durationFrames,
      ...sceneEmissionAddress(scene.id, index),
      editOwner: doc.kind === "native" ? "native-document" : "diagram-command",
    };
  });
}

/** IDs and timing come from a verified receipt, not a DOM-order heuristic. */
export function assertCompiledSceneBindings(
  value: unknown,
): asserts value is CompiledSceneBinding[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100)
    fail("Missing scene bindings.");
  const sceneIds = new Set<string>();
  const documents = new Map<string, { path: string; kind: unknown }>();
  const paths = new Map<string, string>();
  let previousEnd = 0;
  for (const [index, item] of value.entries()) {
    if (
      !record(item) ||
      !id(item.sceneId) ||
      !id(item.documentId) ||
      !kinds.has(String(item.documentKind)) ||
      !["diagram", "native"].includes(String(item.kind)) ||
      !integer(item.startFrame) ||
      !integer(item.durationFrames, 1, 216000) ||
      typeof item.sourcePath !== "string" ||
      item.sourcePath.length < 1 ||
      item.sourcePath.length > 500
    )
      fail("Malformed scene binding.");
    // Paths are authoring references, never URLs, traversal or generated-store addresses.
    const path = item.sourcePath;
    try {
      if (normalizeEditorPath(path) !== path) fail("Noncanonical authoring path in scene binding.");
    } catch {
      fail("Invalid authoring path in scene binding.");
    }
    const address = sceneEmissionAddress(item.sceneId, index);
    if (Object.entries(address).some(([key, expected]) => item[key] !== expected))
      fail("Scene binding disagrees with the compiler's emission address.");
    const native = item.documentKind === "native";
    if (
      native !== (item.kind === "native") ||
      item.editOwner !== (native ? "native-document" : "diagram-command")
    )
      fail("Scene edit ownership disagrees with its document kind.");
    if (
      sceneIds.has(item.sceneId) ||
      item.startFrame < previousEnd ||
      !Number.isSafeInteger(item.startFrame + item.durationFrames)
    )
      fail("Duplicate scene or invalid timing.");
    sceneIds.add(item.sceneId);
    previousEnd = item.startFrame + item.durationFrames;
    const doc = documents.get(item.documentId);
    const normalized = path.normalize("NFC").toLowerCase();
    if (
      (doc && (doc.path !== path || doc.kind !== item.documentKind)) ||
      (paths.has(normalized) && paths.get(normalized) !== item.documentId)
    )
      fail("Ambiguous authoring document.");
    documents.set(item.documentId, { path, kind: item.documentKind });
    paths.set(normalized, item.documentId);
  }
}

export function assertEditorPreviewSession(value: unknown): asserts value is EditorPreviewSession {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    typeof value.projectId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value.projectId) ||
    !integer(value.revision) ||
    !hash(value.revisionHash) ||
    !hash(value.buildHash) ||
    !hash(value.authoringHash) ||
    value.generatedOutputEditable !== false ||
    value.historyOwner !== "project-journal" ||
    !integer(value.durationFrames, 1) ||
    !record(value.output)
  )
    fail("Missing or invalid pinned preview identity.");
  const output = value.output;
  if (
    !integer(output.width, 240, 7680) ||
    output.width % 2 !== 0 ||
    !integer(output.height, 240, 7680) ||
    output.height % 2 !== 0 ||
    !record(output.fps) ||
    !integer(output.fps.numerator, 1, 240000) ||
    !integer(output.fps.denominator, 1, 10000)
  )
    fail("Invalid output dimensions or rational frame rate.");
  assertCompiledSceneBindings(value.scenes);
  const end = Math.max(...value.scenes.map((s) => s.startFrame + s.durationFrames));
  if (end !== value.durationFrames) fail("Duration disagrees with the scene bindings.");
}

/** All returned URLs are same-origin paths under one immutable build identity. */
export function editorPreviewBase(session: EditorPreviewSession): string {
  assertEditorPreviewSession(session);
  return `/api/vflow/projects/${encodeURIComponent(session.projectId)}/editor/previews/${session.buildHash}`;
}

export function editorPreviewUrl(session: EditorPreviewSession, sceneId?: string): string {
  const base = editorPreviewBase(session);
  if (sceneId === undefined) return `${base}/view`;
  if (!session.scenes.some((scene) => scene.sceneId === sceneId))
    throw new EditorPreviewError(
      "editor/scene-not-found",
      "Scene is absent from this preview.",
      404,
    );
  return `${base}/view?sceneId=${encodeURIComponent(sceneId)}`;
}

/** Explicit scene identity wins; contradictory identities are errors, never fallbacks. */
export function resolvePreviewScene(
  session: EditorPreviewSession,
  target: {
    sceneId?: string;
    renderToken?: string;
    sourcePath?: string;
    buildHash?: string;
    revisionHash?: string;
  },
): CompiledSceneBinding {
  assertEditorPreviewSession(session);
  if (
    !record(target) ||
    !Object.keys(target).length ||
    Object.keys(target).some(
      (key) => !["sceneId", "renderToken", "sourcePath", "buildHash", "revisionHash"].includes(key),
    ) ||
    Object.values(target).some((v) => typeof v !== "string" || !v)
  )
    fail("An explicit scene, render token or authoring path is required.");
  if (!target.sceneId && !target.renderToken && !target.sourcePath)
    fail("A selection identity is required.");
  if (
    (target.renderToken !== undefined && (!target.buildHash || !target.revisionHash)) ||
    (target.buildHash !== undefined && target.buildHash !== session.buildHash) ||
    (target.revisionHash !== undefined && target.revisionHash !== session.revisionHash)
  )
    throw new EditorPreviewError(
      "editor/stale-selection",
      "Render selection does not belong to this pinned preview.",
      409,
    );
  const matches = session.scenes.filter(
    (scene) =>
      (target.sceneId === undefined || scene.sceneId === target.sceneId) &&
      (target.sourcePath === undefined || scene.sourcePath === target.sourcePath) &&
      (target.renderToken === undefined ||
        [scene.renderId, scene.hostId, scene.hostCompositionId, scene.outputPath].includes(
          target.renderToken,
        )),
  );
  if (matches.length !== 1)
    throw new EditorPreviewError(
      matches.length ? "editor/ambiguous-scene" : "editor/scene-not-found",
      "Selection must identify exactly one scene appearance in this build.",
      409,
    );
  return structuredClone(matches[0]!);
}

/** Frame conversion is explicit and clamps to the half-open scene interval. */
export function sceneLocalFrame(
  scene: Pick<ProjectScene, "startFrame" | "durationFrames">,
  masterFrame: number,
): number {
  if (!integer(masterFrame) || !integer(scene.startFrame) || !integer(scene.durationFrames, 1))
    fail("Frame positions must be nonnegative integers.");
  return Math.max(0, Math.min(scene.durationFrames - 1, masterFrame - scene.startFrame));
}
