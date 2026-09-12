import Ajv from "ajv";
import {
  regenerationConflictProblems,
  type PreservedRegenerationConflict,
} from "./regenerationConflicts";
import schema from "../schemas/project.schema.json";
import assetSchema from "../schemas/asset.schema.json";
import { projectAssetRegistryProblems, type ProjectAsset } from "./assets";
import type { DiagramKind } from "./index";
import { problem, ProjectValidationError, type ProjectDiagnostic } from "./diagnostics";

export type DiagramSource = Record<string, unknown>;
export interface DocumentReference {
  id: string;
  kind: DiagramKind | "native";
  path: string;
  authoritative: true;
}
export interface ScenePresentation {
  title: string;
  subtitle?: string;
  focusObjectIds: string[];
  relationshipIds: string[];
}
export interface ProjectScene {
  id: string;
  kind: "diagram" | "native";
  documentId: string;
  startFrame: number;
  durationFrames: number;
  presentation: ScenePresentation;
}
export interface ProjectManifest {
  schemaVersion: 1;
  id: string;
  title: string;
  revision: number;
  documents: DocumentReference[];
  scenes: ProjectScene[];
  /** Optional for existing v1 projects; added only by an asset-registration command. */
  assets?: ProjectAsset[];
  /** Optional v1 extension. Omitted legacy state is not rewritten on read. */
  regenerationConflicts?: PreservedRegenerationConflict[];
  output: { width: number; height: number; fps: { numerator: number; denominator: number } };
  policy: { sourceSharing: "private" | "approved-public"; htmlTrust: "blocked" | "trusted-local" };
}
export interface ProjectSnapshot {
  manifest: ProjectManifest;
  sources: Record<string, DiagramSource | string>;
}

export const OBJECT_COLLECTIONS: Record<DiagramKind, string> = {
  architecture: "components",
  workflow: "nodes",
  sequence: "participants",
  dataflow: "nodes",
  lifecycle: "states",
};
export const RELATIONSHIP_COLLECTIONS: Record<DiagramKind, string> = {
  architecture: "connections",
  workflow: "edges",
  sequence: "messages",
  dataflow: "flows",
  lifecycle: "transitions",
};
const validateSchema = new Ajv({ allErrors: true, strict: true })
  .addSchema(assetSchema)
  .compile(schema);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Portable authoring reference, not a host filesystem path or generated file. */
export function isAuthoringPath(value: string): boolean {
  return (
    // oxlint-disable-next-line no-control-regex -- matches control characters deliberately
    !/[\\:\x00-\x1f]/.test(value) &&
    !value.startsWith("/") &&
    value
      .split("/")
      .every(
        (part) =>
          part.length > 0 &&
          part !== "." &&
          part !== ".." &&
          !part.startsWith(".") &&
          !/[. ]$/.test(part) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      ) &&
    !/^(generated|builds|dist)(\/|$)/i.test(value)
  );
}

export function collection(source: DiagramSource, name: string): Record<string, unknown>[] {
  const value = source[name];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function documentProblems(snapshot: ProjectSnapshot): ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [index, doc] of snapshot.manifest.documents.entries()) {
    const at = `/documents/${index}`;
    if (ids.has(doc.id))
      diagnostics.push(problem("document/duplicate-id", `${at}/id`, "Duplicate document ID."));
    const normalized = doc.path.normalize("NFC").toLowerCase();
    if (!isAuthoringPath(doc.path))
      diagnostics.push(
        problem(
          "document/unsafe-path",
          `${at}/path`,
          "Document path escapes or conflicts with authored storage.",
        ),
      );
    if (paths.has(normalized))
      diagnostics.push(
        problem(
          "document/path-collision",
          `${at}/path`,
          "Two documents target the same portable path.",
        ),
      );
    ids.add(doc.id);
    paths.add(normalized);
    const source = snapshot.sources[doc.id];
    if (doc.kind === "native") {
      if (typeof source !== "string")
        diagnostics.push(
          problem(
            "document/native-source",
            at,
            "Native HTML must remain an authored text document.",
          ),
        );
      continue;
    }
    if (!isRecord(source) || source.diagram_type !== doc.kind) {
      diagnostics.push(
        problem(
          "document/kind-mismatch",
          at,
          "Diagram source is missing or has a different diagram family.",
        ),
      );
      continue;
    }
    const nodes = collection(source, OBJECT_COLLECTIONS[doc.kind]);
    const nodeIds = new Set(nodes.map((node) => node.id));
    if (nodeIds.size !== nodes.length || nodes.some((node) => typeof node.id !== "string"))
      diagnostics.push(
        problem("object/identity", `${at}/source`, "Semantic object IDs must be distinct strings."),
      );
    const edges = collection(source, RELATIONSHIP_COLLECTIONS[doc.kind]);
    const edgeIds = new Set<string>();
    for (const [edgeIndex, edge] of edges.entries()) {
      const pointer = `${at}/source/${RELATIONSHIP_COLLECTIONS[doc.kind]}/${edgeIndex}`;
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to))
        diagnostics.push(
          problem(
            "relationship/endpoint",
            pointer,
            "Relationship endpoint is absent from the authored objects.",
          ),
        );
      if (edge.id !== undefined) {
        if (typeof edge.id !== "string" || edgeIds.has(edge.id))
          diagnostics.push(
            problem(
              "relationship/identity",
              `${pointer}/id`,
              "Relationship IDs must be distinct strings.",
            ),
          );
        else edgeIds.add(edge.id);
      }
    }
  }
  for (const id of Object.keys(snapshot.sources)) {
    if (!ids.has(id))
      diagnostics.push(
        problem(
          "document/unreferenced-source",
          `/sources/${id}`,
          "Source has no authoritative document reference.",
        ),
      );
  }
  return diagnostics;
}

function sceneProblems(snapshot: ProjectSnapshot): ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  const ids = new Set<string>();
  let previousEnd = 0;
  for (const [index, scene] of snapshot.manifest.scenes.entries()) {
    const at = `/scenes/${index}`;
    if (ids.has(scene.id))
      diagnostics.push(
        problem("scene/duplicate-id", `${at}/id`, "Scene instances must have distinct identities."),
      );
    ids.add(scene.id);
    if (scene.startFrame < previousEnd)
      diagnostics.push(
        problem(
          "scene/overlap",
          `${at}/startFrame`,
          "Story scenes must be ordered and non-overlapping.",
        ),
      );
    previousEnd = scene.startFrame + scene.durationFrames;
    const doc = snapshot.manifest.documents.find((candidate) => candidate.id === scene.documentId);
    if (!doc || (doc.kind === "native") !== (scene.kind === "native")) {
      diagnostics.push(
        problem(
          "scene/document",
          `${at}/documentId`,
          "Scene must reference a document of the matching kind.",
        ),
      );
      continue;
    }
    const source = snapshot.sources[doc.id];
    if (doc.kind === "native" || !isRecord(source)) continue;
    const nodes = new Set(collection(source, OBJECT_COLLECTIONS[doc.kind]).map((node) => node.id));
    const edges = new Set(
      collection(source, RELATIONSHIP_COLLECTIONS[doc.kind]).map((edge) => edge.id),
    );
    for (const id of scene.presentation.focusObjectIds) {
      if (!nodes.has(id))
        diagnostics.push(
          problem(
            "scene/orphaned-focus",
            `${at}/presentation/focusObjectIds`,
            "Focus target is absent from the authored source.",
            "Repair the focus intent; it has not been reassigned.",
          ),
        );
    }
    for (const id of scene.presentation.relationshipIds) {
      if (!edges.has(id))
        diagnostics.push(
          problem(
            "scene/orphaned-relationship",
            `${at}/presentation/relationshipIds`,
            "Animation target is absent from the authored relationships.",
            "Repair the edge intent; no replacement relationship was inferred.",
          ),
        );
    }
  }
  return diagnostics;
}

export function validateProject(snapshot: unknown): ProjectDiagnostic[] {
  if (!isRecord(snapshot) || !isRecord(snapshot.manifest) || !isRecord(snapshot.sources))
    return [
      problem(
        "project/envelope",
        "",
        "Project requires a manifest and referenced source documents.",
      ),
    ];
  if (snapshot.manifest.schemaVersion !== 1)
    return [
      problem(
        "project/unsupported-version",
        "/schemaVersion",
        "Unsupported project version.",
        "Open read-only or use an explicit migration; source was not rewritten.",
      ),
    ];
  if (!validateSchema(snapshot.manifest))
    return (validateSchema.errors ?? []).map((error) =>
      problem("project/schema", error.instancePath, error.message ?? "Invalid project field."),
    );
  const project = snapshot as unknown as ProjectSnapshot;
  const assetDiagnostics = projectAssetRegistryProblems(
    project.manifest.assets,
    project.manifest.documents.map((document) => document.path),
  ).map((message) => problem("asset/invalid", "/assets", message));
  const conflictDiagnostics = regenerationConflictProblems(project).map((message) =>
    problem("regeneration/invalid-conflict", "/regenerationConflicts", message),
  );
  return [
    ...documentProblems(project),
    ...sceneProblems(project),
    ...assetDiagnostics,
    ...conflictDiagnostics,
  ];
}

export function assertProject(snapshot: unknown): asserts snapshot is ProjectSnapshot {
  const diagnostics = validateProject(snapshot);
  if (diagnostics.length) throw new ProjectValidationError(diagnostics);
}

/**
 * A presentation target that a regeneration left pointing at nothing.
 *
 * Deleting an object or relationship that a scene animates is a legitimate
 * authoring act, but the intent attached to it cannot survive and must not be
 * guessed at. `validateProject` already detects this precisely — including the
 * refusal to infer a replacement — but as a hard error, so the whole edit was
 * rejected. That preserves the last valid state only by refusing to let the
 * user delete anything an override referenced.
 */
export interface RegenerationConflict {
  kind: "orphaned-target";
  sceneId: string;
  /** The object or relationship the presentation referred to. */
  targetId: string;
  field: "focusObjectIds" | "relationshipIds";
  detail: string;
}

/**
 * Removes presentation targets the authored source no longer contains, and
 * reports each one.
 *
 * The target is dropped rather than reassigned. Moving an override to a
 * neighbouring edge would keep the project valid and silently animate a
 * relationship the author never wrote, which is the failure mode contract C07
 * and the "never animate a relationship that isn't in the authored model" rule
 * both exist to prevent. The prior revision still holds the original intent, so
 * the conflict is recoverable by undo; what is not acceptable is resolving it
 * invisibly.
 */
export function quarantineOrphanedTargets(snapshot: ProjectSnapshot): RegenerationConflict[] {
  const conflicts: RegenerationConflict[] = [];
  for (const scene of snapshot.manifest.scenes) {
    const doc = snapshot.manifest.documents.find((candidate) => candidate.id === scene.documentId);
    if (!doc || doc.kind === "native") continue;
    const source = snapshot.sources[doc.id];
    if (!isRecord(source)) continue;

    const present = {
      focusObjectIds: new Set(
        collection(source, OBJECT_COLLECTIONS[doc.kind]).map((node) => node.id),
      ),
      relationshipIds: new Set(
        collection(source, RELATIONSHIP_COLLECTIONS[doc.kind]).map((edge) => edge.id),
      ),
    } as const;

    for (const field of ["focusObjectIds", "relationshipIds"] as const) {
      const kept: string[] = [];
      for (const id of scene.presentation[field]) {
        if (present[field].has(id)) {
          kept.push(id);
          continue;
        }
        conflicts.push({
          kind: "orphaned-target",
          sceneId: scene.id,
          targetId: id,
          field,
          detail:
            field === "relationshipIds"
              ? "The animated relationship was removed from the authored source. No replacement was inferred."
              : "The focused object was removed from the authored source. The focus was not reassigned.",
        });
      }
      scene.presentation[field] = kept;
    }
  }
  return conflicts;
}
