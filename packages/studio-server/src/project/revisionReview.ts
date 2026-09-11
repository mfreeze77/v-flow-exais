import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { repositoryIdentity } from "@hyperframes/diagram-engine";
import { canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import {
  contained,
  inspectRepository,
  type RepositoryFacts,
  type SourceRoot,
} from "./repositoryIntake";
import {
  assertGitRoot,
  compareGitTrees,
  pinGitRevision,
  readGit,
  readGitTree,
  readSnapshotBlobs,
  reviewError,
  type GitFileChange,
  type GitTreeFile,
} from "./gitSnapshots";
import { atomicJson } from "./projectBuild";

export interface RevisionReviewRequest {
  rootId: string;
  path: string;
  before: string;
  head: string;
  expectedBefore?: string;
  expectedHead?: string;
}
export interface RevisionSnapshot {
  revision: string;
  treeHash: string;
  facts: RepositoryFacts;
  omitted: { path: string; reason: string }[];
}
export interface RevisionReview {
  schemaVersion: 1;
  id: string;
  contentHash: string;
  createdAt: string;
  source: { rootId: string; path: string; repositoryIdentity: string | null };
  before: RevisionSnapshot;
  head: RevisionSnapshot;
  changes: GitFileChange[];
  limitations: string[];
}

const recordHash = ({ contentHash: _hash, ...record }: RevisionReview) =>
  sha256(canonicalJson(record));
export function revisionReviewRoot(home: string, id: string) {
  if (!/^review-[0-9a-f-]{36}$/.test(id))
    throw reviewError("id-invalid", "Select a saved revision review.");
  return contained(home, id);
}
export function readRevisionReview(home: string, id: string) {
  const record: RevisionReview = JSON.parse(
    readFileSync(join(revisionReviewRoot(home, id), "review.json"), "utf8"),
  );
  if (record.id !== id || record.contentHash !== recordHash(record))
    throw reviewError(
      "receipt-changed",
      "The revision review receipt no longer matches its content hash.",
    );
  return record;
}
export function readReviewSource(
  home: string,
  review: RevisionReview,
  side: "before" | "head",
  path: string,
) {
  const file = review[side].facts.files.find((entry) => entry.path === path);
  if (!file) throw reviewError("evidence-unavailable", `${side} source was not captured: ${path}`);
  const bytes = readFileSync(
    contained(join(revisionReviewRoot(home, review.id), side, "snapshot"), path),
  );
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256)
    throw reviewError(
      "evidence-changed",
      `Captured ${side} source no longer matches its hash: ${path}`,
    );
  return bytes;
}

async function capture(
  root: string,
  dir: string,
  revision: string,
  tree: GitTreeFile[],
): Promise<RevisionSnapshot> {
  const { files, omitted } = await readSnapshotBlobs(root, tree);
  const facts = inspectRepository(root, join(dir, "snapshot"), { revision, files });
  const captured = new Set(facts.files.map((file) => file.path));
  for (const path of files.keys())
    if (!captured.has(path))
      omitted.push({
        path,
        reason: "Not retained as supported source text by the content capture policy.",
      });
  atomicJson(join(dir, "tree.json"), tree);
  return { revision, treeHash: sha256(canonicalJson(tree)), facts, omitted };
}

export async function createRevisionReview(
  home: string,
  roots: SourceRoot[],
  request: RevisionReviewRequest,
): Promise<RevisionReview> {
  if (!request || typeof request !== "object")
    throw reviewError("input-invalid", "Supply local before/head revision selections.");
  const authority = roots.find((item) => item.id === request.rootId);
  if (!authority || typeof request.path !== "string" || request.path.length > 512)
    throw reviewError("source-unavailable", "Choose an authorized local source root.");
  const root = contained(authority.path, request.path);
  await assertGitRoot(root);
  // Resolve both names once, before any analysis. Later branch movement cannot change these reads.
  const before = await pinGitRevision(root, request.before, request.expectedBefore);
  const head = await pinGitRevision(root, request.head, request.expectedHead);
  const beforeTree = await readGitTree(root, before);
  const headTree = await readGitTree(root, head);
  let remoteIdentity: string | null = null;
  try {
    remoteIdentity = repositoryIdentity(
      (await readGit(root, ["config", "--get", "remote.origin.url"])).toString().trim(),
    );
  } catch {
    /* A local repository need not have a remote. No hosted identity is asserted. */
  }
  const id = `review-${randomUUID()}`;
  const dir = join(home, id);
  mkdirSync(dir, { recursive: true });
  try {
    const record: RevisionReview = {
      schemaVersion: 1,
      id,
      contentHash: "",
      createdAt: new Date().toISOString(),
      source: { rootId: request.rootId, path: request.path, repositoryIdentity: remoteIdentity },
      before: await capture(root, join(dir, "before"), before, beforeTree),
      head: await capture(root, join(dir, "head"), head, headTree),
      changes: compareGitTrees(beforeTree, headTree),
      limitations: [
        "Exact file changes compare the two complete Git trees by path, blob identity and mode. Renames are recorded as removal plus addition; similarity is not identity.",
        "Source understanding covers only retained source text. Capture exclusions and limits are listed separately for each snapshot.",
        "Code changes do not prove deployed architecture, runtime impact, performance, causality or the truth of repository prose.",
        "Local Git objects only. This review does not fetch PR metadata, hosted revisions, submodules or missing objects.",
      ],
    };
    record.contentHash = recordHash(record);
    atomicJson(join(dir, "review.json"), record);
    return record;
  } catch (error) {
    writeFileSync(
      join(dir, "failed.json"),
      JSON.stringify({ status: "failed", before, head, message: String(error) }),
    );
    throw error;
  }
}
