import { readFileSync } from "node:fs";
import type { UnifiedProjectService } from "@hyperframes/studio-server";

export const proposalActions = new Set([
  "proposal-context",
  "propose",
  "proposals",
  "review-proposal",
  "revise-proposal",
  "accept-proposal",
  "reject-proposal",
]);
export async function runProjectProposal(
  service: UnifiedProjectService,
  args: { action: string; id?: string; intake?: string; proposal?: string; file?: string },
) {
  const input = () => {
    if (!args.file) throw new Error("This proposal command requires --file.");
    return JSON.parse(readFileSync(args.file, "utf8"));
  };
  if (args.action === "propose") return service.proposals.create(input());
  if (!args.id) throw new Error("Proposal commands require the project --id.");
  if (args.action === "proposal-context") {
    if (!args.intake) throw new Error("proposal-context requires --intake.");
    return service.proposals.context(args.id, args.intake);
  }
  if (args.action === "proposals") return { proposals: service.proposals.list(args.id) };
  if (!args.proposal) throw new Error("Select a proposal with --proposal.");
  if (args.action === "review-proposal") return service.proposals.get(args.id, args.proposal);
  const review = input();
  if (args.action === "revise-proposal")
    return service.proposals.revise(
      args.id,
      args.proposal,
      review.version,
      review.contentHash,
      review.proposal,
    );
  if (args.action === "reject-proposal")
    return service.proposals.reject(args.id, args.proposal, review.version, review.contentHash);
  return service.proposals.accept(
    args.id,
    args.proposal,
    review.version,
    review.contentHash,
    review.acknowledgedClaimIds,
  );
}
