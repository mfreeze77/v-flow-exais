import type { ProjectScene, ProjectSnapshot, RegenerationConflict } from "./project";

/** Unresolved presentation intent is authoring state, not a transient UI toast. */
export interface PreservedRegenerationConflict extends RegenerationConflict {
  id: string;
  documentId: string;
  createdByCommandId: string;
  detectedRevision: number;
  /** Preserve the authored ordering, including other targets removed in the same edit. */
  originalTargets: string[];
}

/** Stored in the same immutable revision index as the command and its source. */
export interface ProjectCommandOutcome {
  schemaVersion: 1;
  conflicts: RegenerationConflict[];
}

/**
 * Called on a staged snapshot after quarantine, before validation/commit.
 * The saved scene arrays are the requested intent BEFORE invalid active targets
 * were removed. Existing records survive unrelated edits unchanged.
 */
export function rememberOrphanedIntents(
  snapshot: ProjectSnapshot,
  events: readonly RegenerationConflict[],
  requestedScenes: readonly ProjectScene[],
  commandId: string,
): void {
  if (events.length === 0) return;
  const records = [...(snapshot.manifest.regenerationConflicts ?? [])];
  const ids = new Set(records.map((record) => record.id));
  for (const [index, event] of events.entries()) {
    const scene = requestedScenes.find((item) => item.id === event.sceneId);
    if (!scene || scene.kind !== "diagram") throw new Error("Conflict has no diagram scene.");
    const originalTargets = scene.presentation[event.field];
    if (!originalTargets.includes(event.targetId))
      throw new Error("Conflict has no original intent.");
    // Mint once at a committed revision; never derive this id again from DOM or scene order.
    const id = `regen-${snapshot.manifest.revision}-${index}`;
    if (ids.has(id)) throw new Error("Regeneration conflict identity collision.");
    ids.add(id);
    records.push({
      ...structuredClone(event),
      id,
      documentId: scene.documentId,
      createdByCommandId: commandId,
      detectedRevision: snapshot.manifest.revision,
      originalTargets: [...originalTargets],
    });
  }
  snapshot.manifest.regenerationConflicts = records;
}

/** Context checks supplement the manifest's closed JSON schema. */
export function regenerationConflictProblems(snapshot: ProjectSnapshot): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const record of snapshot.manifest.regenerationConflicts ?? []) {
    if (ids.has(record.id)) problems.push(`Duplicate conflict ID: ${record.id}.`);
    ids.add(record.id);
    const scene = snapshot.manifest.scenes.find((item) => item.id === record.sceneId);
    const doc = snapshot.manifest.documents.find((item) => item.id === record.documentId);
    if (!scene || scene.kind !== "diagram" || scene.documentId !== record.documentId)
      problems.push(`Conflict ${record.id} has a missing or mismatched scene.`);
    if (!doc || doc.kind === "native")
      problems.push(`Conflict ${record.id} has no diagram document.`);
    if (record.detectedRevision > snapshot.manifest.revision)
      problems.push(`Conflict ${record.id} originates in a future revision.`);
    if (!record.originalTargets.includes(record.targetId))
      problems.push(`Conflict ${record.id} does not preserve its original target.`);
  }
  return problems;
}

/** Strip persistence metadata only for the backwards-compatible command event API. */
export function outcomeForCommand(
  snapshot: ProjectSnapshot,
  commandId: string,
): ProjectCommandOutcome {
  const conflicts = (snapshot.manifest.regenerationConflicts ?? [])
    .filter(
      (record) =>
        record.createdByCommandId === commandId &&
        record.detectedRevision === snapshot.manifest.revision,
    )
    .map(({ kind, sceneId, targetId, field, detail }) => ({
      kind,
      sceneId,
      targetId,
      field,
      detail,
    }));
  return { schemaVersion: 1, conflicts };
}

/** A missing legacy outcome is unknown, not a newly inferred empty success. */
export function assertCommandOutcome(value: unknown): asserts value is ProjectCommandOutcome {
  const record = (item: unknown): item is Record<string, unknown> =>
    item !== null && typeof item === "object" && !Array.isArray(item);
  const id = (item: unknown): item is string =>
    typeof item === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(item);
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    Object.keys(value).some((key) => !["schemaVersion", "conflicts"].includes(key)) ||
    !Array.isArray(value.conflicts) ||
    value.conflicts.length > 30000
  )
    throw new Error("Invalid recorded project command outcome.");
  for (const event of value.conflicts) {
    if (
      !record(event) ||
      Object.keys(event).length !== 5 ||
      Object.keys(event).some(
        (key) => !["kind", "sceneId", "targetId", "field", "detail"].includes(key),
      ) ||
      event.kind !== "orphaned-target" ||
      !id(event.sceneId) ||
      !id(event.targetId) ||
      !["focusObjectIds", "relationshipIds"].includes(String(event.field)) ||
      typeof event.detail !== "string" ||
      event.detail.length === 0 ||
      event.detail.length > 1000
    )
      throw new Error("Invalid recorded regeneration conflict.");
  }
}

/** Restore relative authored order without deleting targets added since the conflict. */
export function restoredTargetOrder(
  active: readonly string[],
  original: readonly string[],
  targetId: string,
): string[] {
  const originalIndex = original.indexOf(targetId);
  if (originalIndex < 0) throw new Error("Cannot restore a target absent from preserved intent.");
  if (active.includes(targetId)) return [...active];
  const survivingOrder = active
    .filter((id) => original.includes(id))
    .map((id) => original.indexOf(id));
  if (survivingOrder.some((position, index) => index > 0 && position < survivingOrder[index - 1]!))
    throw new Error(
      "Saved target order conflicts with the current presentation; repair it explicitly.",
    );
  const next = [...active];
  const after = original.slice(originalIndex + 1).find((id) => next.includes(id));
  if (after !== undefined) next.splice(next.indexOf(after), 0, targetId);
  else {
    const before = original
      .slice(0, originalIndex)
      .reverse()
      .find((id) => next.includes(id));
    next.splice(
      before === undefined ? Math.min(originalIndex, next.length) : next.indexOf(before) + 1,
      0,
      targetId,
    );
  }
  return next;
}
