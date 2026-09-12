/**
 * @hyperframes/project-model — shared project envelope and authoring contracts.
 *
 * Implements contracts C01 (project envelope and document kinds), C03 (stable
 * identities), C04 (commands and validation) and C05 (atomic state and
 * history). Runtime validation and pure commands are exported here; filesystem
 * revisions and the kernel-locked transaction boundary use the storage subpath.
 */

/** The five authored diagram families, as a discriminated union tag. */
export type DiagramKind = "architecture" | "workflow" | "sequence" | "dataflow" | "lifecycle";

/**
 * Distinct identity spaces. Contract C03 requires these never be conflated:
 * an array index or a from/to hash is ambiguous under parallel edges and
 * repeated sequence messages.
 */
export type ProjectId = string & { readonly __brand: "ProjectId" };
export type DocumentId = string & { readonly __brand: "DocumentId" };
export type SemanticObjectId = string & { readonly __brand: "SemanticObjectId" };
export type RelationshipId = string & { readonly __brand: "RelationshipId" };
export type SceneInstanceId = string & { readonly __brand: "SceneInstanceId" };
export type TrackId = string & { readonly __brand: "TrackId" };
export type RenderId = string & { readonly __brand: "RenderId" };

/**
 * A monotonically advancing committed revision. Reads and renders pin one;
 * a write supplies the revision it expected to be writing against.
 */
export type Revision = number & { readonly __brand: "Revision" };

export * from "./project";
export * from "./diagnostics";
export * from "./commands";
export * from "./identity";
export * from "./assets";
export * from "./regenerationConflicts";
