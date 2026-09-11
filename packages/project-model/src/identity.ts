import type { DiagramKind } from "./index";
import { collection, RELATIONSHIP_COLLECTIONS, type DiagramSource } from "./project";
import { problem, ProjectValidationError } from "./diagnostics";

/** Returns both versions so the first atomic import can preserve its backup. */
export function migrateRelationshipIds(
  source: DiagramSource,
  kind: DiagramKind,
  mint = () => crypto.randomUUID(),
) {
  const original = structuredClone(source);
  const migrated = structuredClone(source);
  const edges = collection(migrated, RELATIONSHIP_COLLECTIONS[kind]);
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.id === undefined || edge.id === null || edge.id === "") continue;
    if (typeof edge.id !== "string" || ids.has(edge.id))
      throw new ProjectValidationError([
        problem(
          "relationship/ambiguous-id",
          "/relationships",
          "Existing relationship identities are ambiguous; no matching was guessed.",
        ),
      ]);
    ids.add(edge.id);
  }
  let assigned = 0;
  for (const edge of edges) {
    if (edge.id !== undefined && edge.id !== null && edge.id !== "") continue;
    const id = `edge-${mint()}`;
    if (ids.has(id)) throw new Error("Identity provider returned a duplicate ID.");
    edge.id = id;
    ids.add(id);
    assigned++;
  }
  return { original, source: migrated, assigned, migrationVersion: 1 as const };
}
