import { join } from "node:path";
import {
  compareDiagrams,
  repositoryIdentity,
  type DiagramSource,
} from "@hyperframes/diagram-engine";
import { canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import {
  readRevisionReview,
  readReviewSource,
  revisionReviewRoot,
  type RevisionReview,
} from "./revisionReview";
import { reviewError } from "./gitSnapshots";
import { atomicJson } from "./projectBuild";

export interface DiagramReviewRequest {
  reviewHash: string;
  beforePath?: string;
  headPath?: string;
  beforeJson?: string;
  headJson?: string;
}
function diagramInput(
  home: string,
  review: RevisionReview,
  side: "before" | "head",
  request: DiagramReviewRequest,
) {
  const path = request[`${side}Path`],
    json = request[`${side}Json`];
  if ((typeof path === "string") === (typeof json === "string"))
    throw reviewError("input-invalid", `Supply exactly one ${side}Path or ${side}Json.`);
  if (typeof json === "string") {
    if (Buffer.byteLength(json) > 512_000)
      throw reviewError("input-invalid", "Authored diagram JSON exceeds 512 KB.");
    return Buffer.from(json);
  }
  return readReviewSource(home, review, side, path!);
}
type Reference = { path: string; line?: number; end_line?: number };
function verifyReference(
  home: string,
  review: RevisionReview,
  side: "before" | "head",
  ref: Reference,
) {
  if (!review[side].facts.files.some((file) => file.path === ref.path))
    return { ...ref, status: "unavailable" as const, reason: "This source was not captured." };
  const bytes = readReviewSource(home, review, side, ref.path);
  const content = bytes.toString("utf8");
  const count = content.length
    ? content.split(/\r\n|\n|\r/).length - (/\r\n$|\n$|\r$/.test(content) ? 1 : 0)
    : 0;
  const start = ref.line ?? 1,
    end = ref.end_line ?? start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > count)
    return {
      ...ref,
      status: "unavailable" as const,
      reason: "The cited line range is outside the captured file.",
    };
  return {
    ...ref,
    status: "verified" as const,
    sha256: sha256(bytes),
    startLine: start,
    endLine: end,
  };
}

function assertDeclaredRevision(
  review: RevisionReview,
  side: "before" | "head",
  source: DiagramSource,
) {
  const repository = source?.meta?.repository as { url: string; revision: string } | undefined;
  if (!repository) return;
  if (repository.revision !== review[side].revision)
    throw reviewError(
      "revision-conflict",
      `The ${side} diagram declares a different source revision from the captured commit.`,
    );
  if (
    review.source.repositoryIdentity &&
    repositoryIdentity(repository.url) !== review.source.repositoryIdentity
  )
    throw reviewError(
      "repository-mismatch",
      `The ${side} diagram names a different repository from the captured source.`,
    );
}

export async function compareReviewDiagrams(
  home: string,
  id: string,
  request: DiagramReviewRequest,
) {
  const review = readRevisionReview(home, id);
  if (request?.reviewHash !== review.contentHash)
    throw reviewError(
      "revision-conflict",
      "Refresh the source review before comparing its diagrams.",
    );
  const before = diagramInput(home, review, "before", request);
  const head = diagramInput(home, review, "head", request);
  for (const [side, bytes] of [
    ["before", before],
    ["head", head],
  ] as const)
    assertDeclaredRevision(review, side, JSON.parse(bytes.toString()));
  const comparison = await compareDiagrams({
    before: before.toString(),
    head: head.toString(),
    resolveEvidence: async ({ side, source }) => {
      const components = source.components as { id: string; sources?: Reference[] }[];
      const references = components.flatMap((item) =>
        (item.sources || []).map((ref) => ({
          componentId: item.id,
          ...verifyReference(home, review, side, ref),
        })),
      );
      const verified =
        !!source.meta.repository &&
        !!review.source.repositoryIdentity &&
        references.every((ref) => ref.status === "verified");
      return {
        verified,
        status: verified ? "revision-pinned" : "authored-with-capture",
        revision: review[side].revision,
        references,
        limitations: [
          "A captured authored diagram is not proof of deployed architecture.",
          ...(!review.source.repositoryIdentity
            ? ["No repository origin identity was available for source-link verification."]
            : []),
        ],
      };
    },
  });
  if (!comparison.ok) return comparison;
  const record = {
    schemaVersion: 1,
    sourceReviewId: review.id,
    sourceReviewHash: review.contentHash,
    diagrams: {
      before: {
        ...(request.beforePath ? { path: request.beforePath } : {}),
        revision: review.before.revision,
        sha256: sha256(before),
      },
      head: {
        ...(request.headPath ? { path: request.headPath } : {}),
        revision: review.head.revision,
        sha256: sha256(head),
      },
    },
    authoredSources: { before: before.toString(), head: head.toString() },
    ...comparison,
  };
  const contentHash = sha256(canonicalJson(record));
  const saved = { ...record, contentHash };
  atomicJson(join(revisionReviewRoot(home, id), "comparisons", `${contentHash}.json`), saved);
  return saved;
}
