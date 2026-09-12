import {
  assertProject,
  collection,
  OBJECT_COLLECTIONS,
  type DiagramSource,
  type ProjectSnapshot,
  type ScenePresentation,
} from "./project";
import { problem, ProjectValidationError } from "./diagnostics";
import { projectAssetProblems, type ProjectAsset } from "./assets";

export type ProjectOperation =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "register-asset"; asset: ProjectAsset }
  | { type: "rename-object"; documentId: string; objectId: string; label: string }
  | { type: "replace-diagram-source"; documentId: string; source: DiagramSource }
  | { type: "replace-native-source"; documentId: string; html: string }
  | { type: "set-scene-presentation"; sceneId: string; presentation: ScenePresentation }
  | { type: "set-scene-duration"; sceneId: string; durationFrames: number }
  | { type: "set-project-title"; title: string };

export interface ProjectCommand {
  commandId: string;
  origin: "ui" | "cli" | "agent";
  projectId: string;
  expectedRevision: number;
  operations: ProjectOperation[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 240): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
function invalid(pointer: string, message: string): never {
  throw new ProjectValidationError([problem("command/invalid", pointer, message)]);
}

function assertOperation(value: unknown, pointer: string): asserts value is ProjectOperation {
  if (!record(value) || !text(value.type)) invalid(pointer, "Operation must be a typed object.");
  const allowed: Record<string, string[]> = {
    undo: ["type"],
    redo: ["type"],
    "register-asset": ["type", "asset"],
    "rename-object": ["type", "documentId", "objectId", "label"],
    "replace-diagram-source": ["type", "documentId", "source"],
    "replace-native-source": ["type", "documentId", "html"],
    "set-scene-presentation": ["type", "sceneId", "presentation"],
    "set-scene-duration": ["type", "sceneId", "durationFrames"],
    "set-project-title": ["type", "title"],
  };
  const keys = Object.hasOwn(allowed, value.type) ? allowed[value.type] : undefined;
  if (
    !keys ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    invalid(pointer, "Unknown operation or fields.");
  if (value.type === "register-asset") {
    const issues = projectAssetProblems(value.asset);
    if (issues.length) invalid(`${pointer}/asset`, issues.join(" "));
  }
  if ("documentId" in value && !text(value.documentId, 128))
    invalid(`${pointer}/documentId`, "Document ID is required.");
  if ("sceneId" in value && !text(value.sceneId, 128))
    invalid(`${pointer}/sceneId`, "Scene ID is required.");
  if (value.type === "rename-object" && (!text(value.objectId, 128) || !text(value.label)))
    invalid(pointer, "Object ID and label must be bounded nonempty strings.");
  if (value.type === "replace-diagram-source" && !record(value.source))
    invalid(`${pointer}/source`, "Diagram source must be a JSON object.");
  if (
    value.type === "replace-native-source" &&
    (typeof value.html !== "string" || value.html.length > 2_000_000)
  )
    invalid(`${pointer}/html`, "Native source must be bounded text.");
  if (value.type === "set-scene-presentation" && !record(value.presentation))
    invalid(`${pointer}/presentation`, "Presentation must be an object.");
  if (
    value.type === "set-scene-duration" &&
    (!Number.isSafeInteger(value.durationFrames) || Number(value.durationFrames) < 1)
  )
    invalid(`${pointer}/durationFrames`, "Duration must be a positive integer frame count.");
  if (value.type === "set-project-title" && !text(value.title))
    invalid(`${pointer}/title`, "Title must be a bounded nonempty string.");
}

export function assertCommand(value: unknown): asserts value is ProjectCommand {
  if (!record(value)) invalid("", "Command must be an object.");
  const keys = ["commandId", "origin", "projectId", "expectedRevision", "operations"];
  if (
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    invalid("", "Unknown or missing command fields.");
  if (!text(value.commandId, 128) || !text(value.projectId, 128))
    invalid("/commandId", "Command and project identities are required.");
  if (!["ui", "cli", "agent"].includes(String(value.origin)))
    invalid("/origin", "Unknown command origin.");
  if (!Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 0)
    invalid("/expectedRevision", "Expected revision must be a nonnegative integer.");
  if (!Array.isArray(value.operations) || !value.operations.length || value.operations.length > 100)
    invalid("/operations", "Command requires between one and 100 operations.");
  value.operations.forEach((operation, index) =>
    assertOperation(operation, `/operations/${index}`),
  );
  if (
    value.operations.length !== 1 &&
    value.operations.some((operation) => operation.type === "undo" || operation.type === "redo")
  )
    invalid("/operations", "History commands must be separate transactions.");
}

export class RevisionConflict extends Error {
  readonly code = "project/revision-conflict";
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`Expected revision ${expected}; current revision is ${actual}. Reload before retrying.`);
    this.name = "RevisionConflict";
  }
}

/** Pure preparation. Persistence validates again under its cross-process lock. */
export function applyProjectCommand(current: ProjectSnapshot, command: unknown): ProjectSnapshot {
  assertCommand(command);
  assertProject(current);
  if (command.projectId !== current.manifest.id)
    invalid("/projectId", "Command targets a different project.");
  if (command.expectedRevision !== current.manifest.revision)
    throw new RevisionConflict(command.expectedRevision, current.manifest.revision);
  const next = structuredClone(current);
  for (const [index, operation] of command.operations.entries()) {
    const at = `/operations/${index}`;
    if (operation.type === "undo" || operation.type === "redo")
      invalid(at, "History commands require the committed project journal.");
    if (operation.type === "register-asset") {
      const assets = next.manifest.assets ?? [];
      if (assets.some((asset) => asset.id === operation.asset.id))
        invalid(`${at}/asset`, "Asset is already registered; use its existing identity.");
      next.manifest.assets = [...assets, structuredClone(operation.asset)];
    } else if (operation.type === "set-project-title") {
      next.manifest.title = operation.title;
    } else if (
      operation.type === "set-scene-presentation" ||
      operation.type === "set-scene-duration"
    ) {
      const scene = next.manifest.scenes.find((candidate) => candidate.id === operation.sceneId);
      if (!scene) invalid(`${at}/sceneId`, "Scene does not exist.");
      if (operation.type === "set-scene-presentation")
        scene.presentation = structuredClone(operation.presentation);
      else {
        scene.durationFrames = operation.durationFrames;
        let start = 0;
        for (const item of next.manifest.scenes) {
          item.startFrame = start;
          start += item.durationFrames;
        }
      }
    } else {
      const doc = next.manifest.documents.find(
        (candidate) => candidate.id === operation.documentId,
      );
      if (!doc) invalid(`${at}/documentId`, "Document does not exist.");
      if (operation.type === "replace-native-source") {
        if (doc.kind !== "native")
          invalid(at, "Generated diagram output cannot be edited as native HTML.");
        next.sources[doc.id] = operation.html;
      } else {
        if (doc.kind === "native") invalid(at, "Native HTML is not diagram source.");
        if (operation.type === "replace-diagram-source")
          next.sources[doc.id] = structuredClone(operation.source);
        else {
          const source = next.sources[doc.id] as DiagramSource;
          const object = collection(source, OBJECT_COLLECTIONS[doc.kind]).find(
            (candidate) => candidate.id === operation.objectId,
          );
          if (!object) invalid(`${at}/objectId`, "Semantic object does not exist.");
          object.label = operation.label;
        }
      }
    }
  }
  next.manifest.revision++;
  assertProject(next);
  return next;
}
