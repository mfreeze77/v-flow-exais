import { join } from "node:path";
import { compileProject } from "@hyperframes/diagram-motion";
import { canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import { atomicJson } from "./projectBuild";
import { loadProposalEvidence } from "./proposalPreview";
import type { ProposedProjectEdit } from "./proposalTypes";
import type { UnifiedProjectService } from "./projectService";
import { planRepositoryStories } from "./storyPlanning";
import { storyToProposal } from "./storyProject";
import { validateStoryPlan } from "./storyValidation";
import type { RepositoryIntake } from "./repositoryIntake";

function currentIntake(service: UnifiedProjectService, id: string) {
  const intake = service.readIntake(id);
  intake.facts.understanding = loadProposalEvidence(service, {
    source: { intakeId: id, snapshotHash: intake.facts.snapshotHash },
  } as ProposedProjectEdit);
  return intake;
}
function save(service: UnifiedProjectService, before: RepositoryIntake, after: RepositoryIntake) {
  // Existing projects keep their IDs and bytes. A revised draft gets a new project identity.
  atomicJson(
    join(
      service.intakesDir,
      before.id,
      "planning-history",
      `${sha256(canonicalJson(before.proposals))}.json`,
    ),
    before,
  );
  atomicJson(join(service.intakesDir, before.id, "intake.json"), after);
  return after;
}
export function replanIntakeStories(service: UnifiedProjectService, id: string, options: unknown) {
  const intake = currentIntake(service, id);
  const planned = planRepositoryStories(intake.facts, options);
  const proposals = planned.stories.map(({ key, story }) => {
    validateStoryPlan(story, intake.facts.understanding);
    return storyToProposal(key, story, intake.facts);
  });
  return save(service, intake, {
    ...intake,
    planning: { options: planned.options, warnings: planned.warnings },
    proposals,
  });
}
export async function reviseIntakeStory(
  service: UnifiedProjectService,
  id: string,
  proposalId: string,
  expectedHash: string,
  input: unknown,
) {
  const intake = currentIntake(service, id);
  const original = intake.proposals.find((item) => item.id === proposalId);
  if (!original?.story || original.planHash !== expectedHash)
    throw Object.assign(new Error("This story changed. Reload before revising it."), {
      code: "proposal/review-conflict",
    });
  validateStoryPlan(input, intake.facts.understanding);
  const proposal = storyToProposal(proposalId, input, intake.facts);
  proposal.id = original.id;
  await compileProject(proposal.snapshot);
  // Compilation yields; verify that a newer plan did not arrive meanwhile.
  const latest = service.readIntake(id);
  if (latest.proposals.find((item) => item.id === proposalId)?.planHash !== expectedHash)
    throw Object.assign(new Error("This story changed during validation. Reload it."), {
      code: "proposal/review-conflict",
    });
  return save(service, latest, {
    ...latest,
    proposals: latest.proposals.map((item) => (item.id === proposalId ? proposal : item)),
  });
}
export function assertStoryReview(
  service: UnifiedProjectService,
  intake: RepositoryIntake,
  selected: string[],
  review?: { hashes?: Record<string, string>; acknowledged?: boolean },
) {
  intake.facts.understanding = loadProposalEvidence(service, {
    source: { intakeId: intake.id, snapshotHash: intake.facts.snapshotHash },
  } as ProposedProjectEdit);
  for (const id of selected) {
    const proposal = intake.proposals.find((item) => item.id === id)!;
    if (!proposal.story) continue; // Legacy intake receipts remain readable.
    if (!review?.acknowledged)
      throw new Error("Review the story scripts and source evidence before creating projects.");
    if (review.hashes?.[id] !== proposal.planHash)
      throw Object.assign(new Error("The selected story changed after review. Reload the plans."), {
        code: "proposal/review-conflict",
      });
    validateStoryPlan(proposal.story, intake.facts.understanding);
  }
}
