import type {
  ProjectOperation,
  ProjectSnapshot,
  ProjectDiagnostic,
} from "@hyperframes/project-model";
import type { RepositoryUnderstanding, SourceExcerpt } from "./repositoryUnderstanding";

export type ProposalClaim =
  | { id: string; basis: "observation"; sourceId: string; field: "name" | "summary" }
  | { id: string; basis: "relationship"; sourceId: string; field: "kind" | "description" }
  | { id: string; basis: "interpretation"; text: string; evidenceIds: string[] }
  | { id: string; basis: "editorial"; text: string };

export interface ProposedProjectEdit {
  schemaVersion: 1;
  title: string;
  projectId: string;
  expectedRevision: number;
  source: { intakeId: string; snapshotHash: string };
  operations: ProjectOperation[];
  claims: ProposalClaim[];
  wording: { operationIndex: number; pointer: string; claimId: string }[];
  objects: { documentId: string; objectId: string; observationId: string }[];
  relationships: { documentId: string; relationshipId: string; sourceRelationshipId: string }[];
}
export interface ReviewedClaim {
  id: string;
  text: string;
  classification:
    | "source-observation"
    | "source-relationship"
    | "documented-claim"
    | "interpretation"
    | "editorial";
  evidence: SourceExcerpt[];
  requiresAcknowledgement: boolean;
}
export interface ProposalPreview {
  valid: boolean;
  diagnostics: ProjectDiagnostic[];
  claims: ReviewedClaim[];
  changes: { pointer: string; before: unknown; after: unknown }[];
  proposedSnapshot?: ProjectSnapshot;
}
export interface ProposalRecord {
  schemaVersion: 1;
  id: string;
  version: number;
  contentHash: string;
  createdAt: string;
  status: "draft" | "rejected" | "accepted";
  proposal: ProposedProjectEdit;
  acceptedRevision?: number;
  acknowledgedClaimIds?: string[];
}
export interface ProposalProvider {
  id: string;
  generate(
    context: {
      project: ProjectSnapshot;
      source: RepositoryUnderstanding;
      intakeId: string;
      snapshotHash: string;
      brief: string;
    },
    signal: AbortSignal,
  ): Promise<unknown>;
}

export class ProposalError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly diagnostics: ProjectDiagnostic[] = [],
  ) {
    super(message);
  }
}
