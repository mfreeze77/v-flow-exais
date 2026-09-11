import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";

const [source, before, head] = process.argv.slice(2);
assert(source && before && head, "Supply the authorized source root and before/head revisions.");
const home = "/var/lib/vflow/revision-review-checkpoint";
const service = new UnifiedProjectService({
  home,
  sourceRoots: [{ id: "source", label: "Local source", path: source }],
});
const review = await service.reviewRevisions({ rootId: "source", path: ".", before, head });
assert.equal(service.readReview(review.id).contentHash, review.contentHash);
const out = "evidence/tickets/AFM-037/revision-review";
mkdirSync(out, { recursive: true });
const proof = {
  reviewId: review.id,
  home,
  sourceReviewHash: review.contentHash,
  before: {
    revision: review.before.revision,
    treeHash: review.before.treeHash,
    capturedFiles: review.before.facts.files.length,
    omitted: review.before.omitted.length,
  },
  head: {
    revision: review.head.revision,
    treeHash: review.head.treeHash,
    capturedFiles: review.head.facts.files.length,
    omitted: review.head.omitted.length,
  },
  changes: review.changes,
  limitations: review.limitations,
};
writeFileSync(join(out, "repository-proof.json"), JSON.stringify(proof, null, 2));
console.log(
  JSON.stringify({
    reviewId: review.id,
    before: proof.before,
    head: proof.head,
    changedPaths: review.changes.length,
  }),
);
