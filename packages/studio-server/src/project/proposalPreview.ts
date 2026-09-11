import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyProjectCommand,
  problem,
  type ProjectDiagnostic,
  type ProjectSnapshot,
} from "@hyperframes/project-model";
import { assertContainedPath, canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import { compileProject } from "@hyperframes/diagram-motion";
import { understandRepository, type RepositoryUnderstanding } from "./repositoryUnderstanding";
import { checkNewRelationships, checkWording, resolveClaims } from "./proposalGrounding";
import type { UnifiedProjectService } from "./projectService";
import type { ProposedProjectEdit, ProposalPreview, ProposalRecord } from "./proposalTypes";
import { ProposalError } from "./proposalTypes";

export const proposalCommand = (record: ProposalRecord) => ({
  commandId: `proposal:${record.id}:${record.version}:${record.contentHash.slice(0, 16)}`,
  origin: "agent" as const,
  projectId: record.proposal.projectId,
  expectedRevision: record.proposal.expectedRevision,
  operations: record.proposal.operations,
});

export function loadProposalEvidence(
  service: UnifiedProjectService,
  proposal: ProposedProjectEdit,
): RepositoryUnderstanding {
  const intake = service.readIntake(proposal.source.intakeId);
  if (intake.facts.snapshotHash !== proposal.source.snapshotHash)
    throw new ProposalError(
      "proposal/stale-source",
      "The selected source snapshot no longer matches the proposal.",
    );
  const root = join(service.intakesDir, intake.id, "snapshot");
  const sources = intake.facts.files.map((file) => {
    const path = join(root, file.path);
    assertContainedPath(root, path);
    const bytes = readFileSync(path);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256)
      throw new ProposalError("proposal/stale-source", `Captured evidence changed: ${file.path}`);
    return { file, content: bytes.toString("utf8") };
  });
  // Recompute observations from the hashed bytes: editable intake descriptions
  // cannot promote an invented claim to an observed fact.
  return understandRepository(sources);
}

export function describeChanges(
  before: unknown,
  after: unknown,
  pointer = "",
): ProposalPreview["changes"] {
  if (canonicalJson(before ?? null) === canonicalJson(after ?? null)) return [];
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after)
  )
    return [{ pointer, before: before ?? null, after: after ?? null }];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.flatMap((key) =>
    describeChanges(
      Reflect.get(before, key),
      Reflect.get(after, key),
      `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`,
    ),
  );
}
function failureDiagnostics(error: unknown): ProjectDiagnostic[] {
  if (
    error &&
    typeof error === "object" &&
    "diagnostics" in error &&
    Array.isArray(error.diagnostics) &&
    error.diagnostics.length
  )
    return error.diagnostics;
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "proposal/invalid-command";
  return [problem(code, "", error instanceof Error ? error.message : String(error))];
}
export async function previewProposal(
  service: UnifiedProjectService,
  record: ProposalRecord,
  base?: ProjectSnapshot,
): Promise<ProposalPreview> {
  const diagnostics: ProjectDiagnostic[] = [];
  let source: RepositoryUnderstanding;
  try {
    source = loadProposalEvidence(service, record.proposal);
  } catch (error) {
    return { valid: false, diagnostics: failureDiagnostics(error), claims: [], changes: [] };
  }
  const claims = resolveClaims(record.proposal, source, diagnostics);
  checkWording(record.proposal, claims, diagnostics);
  let proposedSnapshot: ProjectSnapshot | undefined;
  const current = base || service.get(record.proposal.projectId).snapshot;
  try {
    proposedSnapshot = applyProjectCommand(current, proposalCommand(record));
    checkNewRelationships(current, proposedSnapshot, record.proposal, source, diagnostics);
    if (!diagnostics.length) await compileProject(proposedSnapshot);
  } catch (error) {
    diagnostics.push(...failureDiagnostics(error));
  }
  return {
    valid: diagnostics.length === 0,
    diagnostics,
    claims,
    changes: proposedSnapshot ? describeChanges(current, proposedSnapshot) : [],
    proposedSnapshot,
  };
}
