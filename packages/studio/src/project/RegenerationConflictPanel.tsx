import {
  collection,
  OBJECT_COLLECTIONS,
  RELATIONSHIP_COLLECTIONS,
  type ProjectOperation,
  type ProjectSnapshot,
} from "@hyperframes/project-model";

type ConflictOperation = Extract<
  ProjectOperation,
  { type: "discard-regeneration-conflict" | "restore-regeneration-conflict" }
>;

/** Read committed authoring state on every render, never a one-time response toast. */
export function RegenerationConflictPanel({
  snapshot,
  busy,
  onResolve,
}: {
  snapshot: ProjectSnapshot;
  busy: boolean;
  onResolve: (operation: ConflictOperation) => void;
}) {
  const conflicts = snapshot.manifest.regenerationConflicts ?? [];
  if (conflicts.length === 0) return null;
  return (
    <section
      className="vf-evidence"
      aria-label="Unresolved presentation conflicts"
      aria-live="polite"
      style={{ maxHeight: "14rem", overflowY: "auto", flexShrink: 0 }}
    >
      <h2>Preserved presentation choices ({conflicts.length})</h2>
      <p>
        These targets were removed from active animation, not reassigned. Their original intent is
        saved with this project. Restore the original source target to enable restoration, or
        explicitly discard the saved choice. Either action can be undone.
      </p>
      {conflicts.map((conflict) => {
        const doc = snapshot.manifest.documents.find((item) => item.id === conflict.documentId);
        const scene = snapshot.manifest.scenes.find((item) => item.id === conflict.sceneId);
        const source = doc ? snapshot.sources[doc.id] : undefined;
        const canRestore =
          !!doc &&
          doc.kind !== "native" &&
          typeof source === "object" &&
          source !== null &&
          collection(
            source,
            conflict.field === "focusObjectIds"
              ? OBJECT_COLLECTIONS[doc.kind]
              : RELATIONSHIP_COLLECTIONS[doc.kind],
          ).some((item) => item.id === conflict.targetId);
        return (
          <article key={conflict.id} data-conflict-id={conflict.id}>
            <p>
              <strong>{scene?.presentation.title || conflict.sceneId}</strong>
              {" · "}
              <code>{doc?.path || conflict.documentId}</code>
              {" · "}
              <code>{conflict.targetId}</code>
              {" · revision "}
              {conflict.detectedRevision}
            </p>
            <p>{conflict.detail}</p>
            <button
              type="button"
              disabled={busy || !canRestore}
              onClick={() =>
                onResolve({ type: "restore-regeneration-conflict", conflictId: conflict.id })
              }
            >
              Restore original target {conflict.targetId}
            </button>{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onResolve({ type: "discard-regeneration-conflict", conflictId: conflict.id })
              }
            >
              Discard saved choice {conflict.targetId}
            </button>
          </article>
        );
      })}
    </section>
  );
}
