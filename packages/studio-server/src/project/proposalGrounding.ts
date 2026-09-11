import {
  collection,
  OBJECT_COLLECTIONS,
  RELATIONSHIP_COLLECTIONS,
  problem,
  type ProjectSnapshot,
  type DiagramSource,
  type ProjectDiagnostic,
} from "@hyperframes/project-model";
import { canonicalJson } from "@hyperframes/project-model/revisions";
import type { RepositoryUnderstanding } from "./repositoryUnderstanding";
import type { ProposedProjectEdit, ReviewedClaim } from "./proposalTypes";

export function resolveClaims(
  proposal: ProposedProjectEdit,
  source: RepositoryUnderstanding,
  diagnostics: ProjectDiagnostic[],
): ReviewedClaim[] {
  const results: ReviewedClaim[] = [];
  for (const claim of proposal.claims) {
    if (claim.basis === "editorial") {
      results.push({
        id: claim.id,
        text: claim.text,
        classification: "editorial",
        evidence: [],
        requiresAcknowledgement: true,
      });
      continue;
    }
    if (claim.basis === "interpretation") {
      const items = claim.evidenceIds.map(
        (id) =>
          source.observations.find((item) => item.id === id) ||
          source.relationships.find((item) => item.id === id),
      );
      if (items.some((item) => !item))
        diagnostics.push(
          problem(
            "proposal/missing-evidence",
            `/claims/${claim.id}`,
            "Interpretation refers to unavailable evidence.",
          ),
        );
      results.push({
        id: claim.id,
        text: claim.text,
        classification: "interpretation",
        evidence: items.flatMap((item) => (item ? [item.evidence] : [])),
        requiresAcknowledgement: true,
      });
      continue;
    }
    const item =
      claim.basis === "observation"
        ? source.observations.find((item) => item.id === claim.sourceId)
        : source.relationships.find((item) => item.id === claim.sourceId);
    if (!item) {
      diagnostics.push(
        problem(
          "proposal/missing-evidence",
          `/claims/${claim.id}`,
          "Claim does not identify an observation in the pinned source snapshot.",
        ),
      );
      continue;
    }
    const text = String(Reflect.get(item, claim.field));
    const documented = "basis" in item && item.basis === "documented";
    results.push({
      id: claim.id,
      text,
      classification: documented
        ? "documented-claim"
        : claim.basis === "observation"
          ? "source-observation"
          : "source-relationship",
      evidence: [item.evidence],
      requiresAcknowledgement: documented,
    });
  }
  return results;
}

const getPointer = (value: unknown, pointer: string): unknown =>
  pointer
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? Reflect.get(node, part.replace(/~1/g, "/").replace(/~0/g, "~"))
          : undefined,
      value,
    );
const escape = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1");
const wordingKeys = new Set([
  "title",
  "subtitle",
  "label",
  "text",
  "description",
  "summary",
  "content",
  "html",
]);
function textFields(value: unknown, pointer = ""): { pointer: string; text: string }[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) =>
    typeof item === "string" && wordingKeys.has(key)
      ? [{ pointer: `${pointer}/${escape(key)}`, text: item }]
      : textFields(item, `${pointer}/${escape(key)}`),
  );
}
export function checkWording(
  proposal: ProposedProjectEdit,
  claims: ReviewedClaim[],
  diagnostics: ProjectDiagnostic[],
) {
  for (const [index, operation] of proposal.operations.entries()) {
    for (const field of textFields(operation)) {
      const matches = proposal.wording.filter(
        (binding) => binding.operationIndex === index && binding.pointer === field.pointer,
      );
      const claim = claims.find((item) => item.id === matches[0]?.claimId);
      if (matches.length !== 1 || !claim || claim.text !== field.text)
        diagnostics.push(
          problem(
            "proposal/unreviewed-wording",
            `/operations/${index}${field.pointer}`,
            "Every proposed wording field must exactly match one reviewed claim. Custom wording belongs in interpretation or editorial, not a verified source claim.",
          ),
        );
      if (field.pointer === "/html" && claim && !claim.requiresAcknowledgement)
        diagnostics.push(
          problem(
            "proposal/native-content-unverified",
            `/operations/${index}/html`,
            "Native source is active authored content and cannot be classified as a verified factual claim.",
          ),
        );
    }
  }
  for (const binding of proposal.wording) {
    const claim = claims.find((item) => item.id === binding.claimId);
    if (
      !claim ||
      getPointer(proposal.operations[binding.operationIndex], binding.pointer) !== claim.text
    )
      diagnostics.push(
        problem(
          "proposal/invalid-wording-binding",
          "/wording",
          "Wording binding does not match its operation field and claim.",
        ),
      );
  }
}

export function checkNewRelationships(
  before: ProjectSnapshot,
  after: ProjectSnapshot,
  proposal: ProposedProjectEdit,
  source: RepositoryUnderstanding,
  diagnostics: ProjectDiagnostic[],
) {
  for (const document of after.manifest.documents) {
    if (document.kind === "native") continue;
    const original = before.sources[document.id] as DiagramSource;
    const changed = after.sources[document.id] as DiagramSource;
    const originals = collection(original, RELATIONSHIP_COLLECTIONS[document.kind]);
    const oldObjects = collection(original, OBJECT_COLLECTIONS[document.kind]);
    const newObjects = collection(changed, OBJECT_COLLECTIONS[document.kind]);
    for (const edge of collection(changed, RELATIONSHIP_COLLECTIONS[document.kind])) {
      const previous = originals.find((item) => item.id === edge.id);
      if (
        previous &&
        [edge.from, edge.to].every(
          (id) =>
            oldObjects.find((item) => item.id === id)?.label ===
            newObjects.find((item) => item.id === id)?.label,
        ) &&
        canonicalJson([
          previous.from,
          previous.to,
          previous.direction ?? null,
          previous.label ?? null,
        ]) === canonicalJson([edge.from, edge.to, edge.direction ?? null, edge.label ?? null])
      )
        continue;
      const binding = proposal.relationships.filter(
        (item) => item.documentId === document.id && item.relationshipId === edge.id,
      );
      const observed = source.relationships.find(
        (item) => item.id === binding[0]?.sourceRelationshipId,
      );
      const nodeBindings = proposal.objects.filter((item) => item.documentId === document.id);
      const from = nodeBindings.filter((item) => item.objectId === edge.from);
      const to = nodeBindings.filter((item) => item.objectId === edge.to);
      const grounded =
        binding.length === 1 &&
        from.length === 1 &&
        to.length === 1 &&
        observed &&
        observed.from === from[0]!.observationId &&
        observed.to === to[0]!.observationId &&
        edge.label === observed.kind &&
        !edge.direction;
      if (!grounded)
        diagnostics.push(
          problem(
            "proposal/unsupported-relationship",
            `/sources/${document.id}/${String(edge.id)}`,
            "New or changed relationships require matching captured endpoint identities, direction and relationship kind. Source citations alone do not prove a connection.",
          ),
        );
      for (const object of collection(changed, OBJECT_COLLECTIONS[document.kind]).filter(
        (item) => item.id === edge.from || item.id === edge.to,
      )) {
        const mapped = nodeBindings.find((item) => item.objectId === object.id);
        const observation = source.observations.find((item) => item.id === mapped?.observationId);
        if (!observation || object.label !== observation.name)
          diagnostics.push(
            problem(
              "proposal/endpoint-identity",
              `/sources/${document.id}/${String(object.id)}`,
              "A source-grounded endpoint must carry its observed semantic name.",
            ),
          );
      }
    }
  }
}
