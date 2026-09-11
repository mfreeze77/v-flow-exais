/**
 * @hyperframes/project-model — shared project envelope and authoring contracts.
 *
 * Implements contracts C01 (project envelope and document kinds), C03 (stable
 * identities), C04 (commands and validation) and C05 (atomic state and
 * history). Those land in E03, starting at AFM-017; this module currently
 * declares only the identity vocabulary the rest of the workspace compiles
 * against, so packages can depend on it before the implementation exists.
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
