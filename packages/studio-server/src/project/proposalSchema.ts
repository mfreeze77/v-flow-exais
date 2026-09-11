import { ProposalError, type ProposedProjectEdit } from "./proposalTypes";

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const bounded = (value: unknown, max = 240): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key)) &&
  allowed.every((key) => Object.hasOwn(value, key));
function requireValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ProposalError("proposal/invalid-envelope", message);
}

/** The envelope remains reviewable even when one of its typed operations is invalid. */
export function assertProposal(value: unknown): asserts value is ProposedProjectEdit {
  requireValue(object(value), "Proposal must be an object.");
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new ProposalError("proposal/invalid-envelope", "Proposal must be serializable JSON.");
  }
  requireValue(encoded.length <= 5_000_000, "Proposal exceeds 5 MB.");
  requireValue(
    keys(value, [
      "schemaVersion",
      "title",
      "projectId",
      "expectedRevision",
      "source",
      "operations",
      "claims",
      "wording",
      "objects",
      "relationships",
    ]),
    "Proposal has missing or unknown fields.",
  );
  requireValue(
    value.schemaVersion === 1 && bounded(value.title) && bounded(value.projectId, 128),
    "Proposal version, title and project ID are required.",
  );
  requireValue(
    Number.isSafeInteger(value.expectedRevision) && Number(value.expectedRevision) >= 0,
    "Expected revision must be a nonnegative integer.",
  );
  requireValue(
    object(value.source) &&
      keys(value.source, ["intakeId", "snapshotHash"]) &&
      bounded(value.source.intakeId, 128) &&
      typeof value.source.snapshotHash === "string" &&
      /^[a-f0-9]{64}$/.test(value.source.snapshotHash),
    "A pinned source intake is required.",
  );
  for (const field of ["operations", "claims", "wording", "objects", "relationships"])
    requireValue(
      Array.isArray(value[field]) && value[field].length <= 100,
      `${field} must be an array with at most 100 entries.`,
    );
  requireValue(
    (value.operations as unknown[]).length > 0,
    "At least one proposed operation is required.",
  );
  const ids = new Set<string>();
  for (const claim of value.claims as unknown[]) {
    requireValue(
      object(claim) && bounded(claim.id, 128) && !ids.has(claim.id),
      "Claim IDs must be unique bounded strings.",
    );
    ids.add(claim.id);
    assertClaim(claim);
  }
  for (const binding of value.wording as unknown[])
    requireValue(
      object(binding) &&
        keys(binding, ["operationIndex", "pointer", "claimId"]) &&
        Number.isSafeInteger(binding.operationIndex) &&
        Number(binding.operationIndex) >= 0 &&
        bounded(binding.pointer, 512) &&
        bounded(binding.claimId, 128),
      "Wording must bind an operation field to a claim.",
    );
  for (const binding of value.objects as unknown[])
    requireValue(
      object(binding) &&
        keys(binding, ["documentId", "objectId", "observationId"]) &&
        Object.values(binding).every((item) => bounded(item, 128)),
      "Invalid semantic object evidence binding.",
    );
  for (const binding of value.relationships as unknown[])
    requireValue(
      object(binding) &&
        keys(binding, ["documentId", "relationshipId", "sourceRelationshipId"]) &&
        Object.values(binding).every((item) => bounded(item, 128)),
      "Invalid relationship evidence binding.",
    );
}
function assertClaim(claim: Record<string, unknown>) {
  if (claim.basis === "observation" || claim.basis === "relationship") {
    requireValue(
      keys(claim, ["id", "basis", "sourceId", "field"]) && bounded(claim.sourceId, 128),
      "Source claims must refer to captured observations.",
    );
    const fields = claim.basis === "observation" ? ["name", "summary"] : ["kind", "description"];
    requireValue(fields.includes(String(claim.field)), "Unknown source-claim field.");
    return;
  }
  const expected =
    claim.basis === "interpretation"
      ? ["id", "basis", "text", "evidenceIds"]
      : ["id", "basis", "text"];
  requireValue(
    ["interpretation", "editorial"].includes(String(claim.basis)) &&
      keys(claim, expected) &&
      bounded(claim.text, 2_000_000),
    "Free wording must be explicitly classified as interpretation or editorial.",
  );
  if (claim.basis === "interpretation")
    requireValue(
      Array.isArray(claim.evidenceIds) &&
        claim.evidenceIds.length > 0 &&
        claim.evidenceIds.length <= 30 &&
        claim.evidenceIds.every((item) => bounded(item, 128)),
      "Interpretation must identify the source observations being interpreted.",
    );
}
