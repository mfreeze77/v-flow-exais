/**
 * Stable selection identity for managed diagram scenes.
 *
 * Render DOM ids are generated and namespaced per scene. They are not durable
 * authoring identity. The bridge therefore carries semantic object/relationship
 * identity together with the document and scene-instance that own the selected
 * appearance.
 */

// The diagram-family collection names belong to the project model, which
// already exports them. A second copy here would drift, and drift means
// resolving a selection against the wrong collection without any error.
import { OBJECT_COLLECTIONS, RELATIONSHIP_COLLECTIONS } from "@hyperframes/project-model";

export type DiagramSelectionKind = "object" | "relationship";

export interface SceneSelectionBinding {
  sceneId: string;
  documentId: string;
  revision?: number | null;
  objectIds?: readonly string[];
  relationshipIds?: readonly string[];
}

export interface ResolveSelectionInput {
  sceneId: string;
  /** Semantic id from data-node-id or data-vflow-relationship-id. */
  renderId: string;
  /** Explicit document context wins over any compatibility inference. */
  documentId?: string | null;
  /** Set when the rendered target is an authored relationship. */
  relationshipId?: string | null;
  revision?: number | null;
}

export interface ResolveSelectionOptions {
  bindings?: readonly SceneSelectionBinding[];
  /** When true, unknown scenes/ids resolve to null rather than best-effort context. */
  strict?: boolean;
}

export interface DiagramSelectionIdentity {
  documentId: string | null;
  objectId: string | null;
  relationshipId: string | null;
  sceneInstanceId: string;
  revision: number | null;
  kind: DiagramSelectionKind;
}

export interface SelectionAttributes {
  sceneId?: string | null;
  documentId?: string | null;
  nodeId?: string | null;
  relationshipId?: string | null;
  revision?: string | number | null;
}

/** Minimal structural project shape needed to derive managed-scene bindings. */
export interface SelectionProjectSnapshot {
  manifest: {
    revision: number;
    documents: Array<{ id: string; kind: string }>;
    scenes: Array<{ id: string; kind: string; documentId: string }>;
  };
  sources: Record<string, unknown>;
}

const boundedId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128;

/**
 * `importDiagram()` currently creates document `diagram` with scene
 * `diagram-scene`. Keep that deterministic convention as a compatibility
 * fallback for callers that only have the scene id. New editor integrations
 * should pass the document id explicitly (or use a binding table).
 */
function legacyDocumentId(sceneId: string): string | null {
  const suffix = "-scene";
  if (!sceneId.endsWith(suffix)) return null;
  const candidate = sceneId.slice(0, -suffix.length);
  return boundedId(candidate) ? candidate : null;
}

function bindingFor(
  sceneId: string,
  options: ResolveSelectionOptions,
): SceneSelectionBinding | null {
  return options.bindings?.find((binding) => binding.sceneId === sceneId) ?? null;
}

function includes(ids: readonly string[] | undefined, id: string): boolean {
  return ids === undefined || ids.includes(id);
}

/**
 * Resolve one semantic render target into the identity shared by canvas,
 * inspector and timeline selection.
 *
 * No generated DOM id or array index is persisted. In strict mode a binding
 * table is authoritative and an unknown scene/object/relationship is rejected.
 */
export function resolveSelection(
  input: ResolveSelectionInput,
  options: ResolveSelectionOptions = {},
): DiagramSelectionIdentity | null {
  if (!boundedId(input.sceneId) || !boundedId(input.renderId)) return null;

  const binding = bindingFor(input.sceneId, options);
  if (options.strict && options.bindings && !binding) return null;

  const relationshipId = boundedId(input.relationshipId) ? input.relationshipId : null;
  if (relationshipId && relationshipId !== input.renderId) return null;

  if (relationshipId) {
    if (options.strict && binding && !includes(binding.relationshipIds, relationshipId))
      return null;
  } else if (options.strict && binding && !includes(binding.objectIds, input.renderId)) {
    return null;
  }

  const documentId =
    (boundedId(input.documentId) ? input.documentId : null) ??
    binding?.documentId ??
    legacyDocumentId(input.sceneId);
  if (options.strict && !documentId) return null;

  const revision =
    typeof input.revision === "number" &&
    Number.isSafeInteger(input.revision) &&
    input.revision >= 0
      ? input.revision
      : (binding?.revision ?? null);

  return {
    documentId,
    objectId: relationshipId ? null : input.renderId,
    relationshipId,
    sceneInstanceId: input.sceneId,
    revision,
    kind: relationshipId ? "relationship" : "object",
  };
}

/** Resolve selection metadata already extracted from a preview message or DOM. */
export function selectionFromAttributes(
  attributes: SelectionAttributes,
  options: ResolveSelectionOptions = {},
): DiagramSelectionIdentity | null {
  const sceneId = boundedId(attributes.sceneId) ? attributes.sceneId : null;
  const relationshipId = boundedId(attributes.relationshipId) ? attributes.relationshipId : null;
  const nodeId = boundedId(attributes.nodeId) ? attributes.nodeId : null;
  const semanticId = relationshipId ?? nodeId;
  if (!sceneId || !semanticId) return null;

  let revision: number | null = null;
  if (typeof attributes.revision === "number") revision = attributes.revision;
  else if (typeof attributes.revision === "string" && /^\d+$/.test(attributes.revision))
    revision = Number(attributes.revision);

  return resolveSelection(
    {
      sceneId,
      renderId: semanticId,
      documentId: boundedId(attributes.documentId) ? attributes.documentId : null,
      relationshipId,
      revision,
    },
    options,
  );
}

/**
 * Browser convenience wrapper. Diagram preview markup exposes semantic node ids
 * via `data-node-id`; authored edge overlays expose
 * `data-vflow-relationship-id`. The surrounding managed scene should provide
 * scene/document context; callers may supply that context explicitly while old
 * previews are still in circulation.
 */
export function selectionFromElement(
  element: Element,
  context: {
    sceneId?: string | null;
    documentId?: string | null;
    revision?: number | null;
  } = {},
  options: ResolveSelectionOptions = {},
): DiagramSelectionIdentity | null {
  const semantic = element.closest("[data-vflow-relationship-id], [data-node-id]") ?? element;
  const scene = semantic.closest("[data-vflow-scene-id]");
  const relationshipId = semantic.getAttribute("data-vflow-relationship-id");
  const nodeId = semantic.getAttribute("data-node-id");
  const sceneId = scene?.getAttribute("data-vflow-scene-id") ?? context.sceneId ?? null;
  const documentId = scene?.getAttribute("data-vflow-document-id") ?? context.documentId ?? null;
  const revision = scene?.getAttribute("data-vflow-revision") ?? context.revision ?? null;

  return selectionFromAttributes(
    { sceneId, documentId, nodeId, relationshipId, revision },
    options,
  );
}

function idsFromCollection(source: unknown, collection: string | undefined): string[] {
  if (!collection || !source || typeof source !== "object" || Array.isArray(source)) return [];
  const value = (source as Record<string, unknown>)[collection];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>).id
        : null,
    )
    .filter((id): id is string => boundedId(id));
}

/**
 * Build authoritative per-scene bindings from one committed project snapshot.
 * Native scenes are intentionally omitted: this bridge owns managed semantic
 * diagram selection, while native layers keep the retained Studio identity path.
 */
export function bindingsFromProjectSnapshot(
  snapshot: SelectionProjectSnapshot,
): SceneSelectionBinding[] {
  const documents = new Map(snapshot.manifest.documents.map((doc) => [doc.id, doc]));
  return snapshot.manifest.scenes.flatMap((scene) => {
    if (scene.kind !== "diagram") return [];
    const doc = documents.get(scene.documentId);
    if (!doc || doc.kind === "native") return [];
    const source = snapshot.sources[doc.id];
    return [
      {
        sceneId: scene.id,
        documentId: doc.id,
        revision: snapshot.manifest.revision,
        objectIds: idsFromCollection(
          source,
          OBJECT_COLLECTIONS[doc.kind as keyof typeof OBJECT_COLLECTIONS],
        ),
        relationshipIds: idsFromCollection(
          source,
          RELATIONSHIP_COLLECTIONS[doc.kind as keyof typeof RELATIONSHIP_COLLECTIONS],
        ),
      },
    ];
  });
}

/** Build the strict resolver used by the managed editor for one committed revision. */
export function createSelectionResolver(bindings: readonly SceneSelectionBinding[]) {
  const frozen = bindings.map((binding) => ({
    ...binding,
    objectIds: binding.objectIds ? [...binding.objectIds] : undefined,
    relationshipIds: binding.relationshipIds ? [...binding.relationshipIds] : undefined,
  }));
  return (input: ResolveSelectionInput) =>
    resolveSelection(input, { bindings: frozen, strict: true });
}
