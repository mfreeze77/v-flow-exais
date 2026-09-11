import {
  constants,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { assertContainedPath, canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import { assertProposal } from "./proposalSchema";
import { ProposalError, type ProposalRecord } from "./proposalTypes";

export function proposalDirectory(projectRoot: string) {
  const dir = join(projectRoot, ".vflow/proposals");
  assertContainedPath(projectRoot, dir);
  mkdirSync(dir, { recursive: true });
  return dir;
}
export function proposalPath(root: string, id: string) {
  if (!/^proposal-[a-f0-9-]{36}$/.test(id))
    throw new ProposalError("proposal/invalid-id", "Invalid proposal ID.");
  const path = join(proposalDirectory(root), `${id}.json`);
  assertContainedPath(root, path);
  return path;
}
export function readProposal(root: string, id: string): ProposalRecord {
  const record: ProposalRecord = JSON.parse(readFileSync(proposalPath(root, id), "utf8"));
  assertProposal(record.proposal);
  if (record.id !== id || record.contentHash !== sha256(canonicalJson(record.proposal)))
    throw new ProposalError(
      "proposal/integrity",
      "The stored proposal no longer matches its reviewed content hash.",
    );
  return record;
}
export function writeProposal(root: string, record: ProposalRecord) {
  const path = proposalPath(root, record.id);
  const temporary = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    writeFileSync(fd, canonicalJson(record));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, path);
  const directory = openSync(proposalDirectory(root), constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}
export function archiveProposal(root: string, record: ProposalRecord) {
  const path = join(proposalDirectory(root), `${record.id}.v${record.version}.json`);
  if (!existsSync(path)) writeFileSync(path, canonicalJson(record), { flag: "wx", mode: 0o600 });
}

/** Kernel ownership serializes accept/reject/revise across Studio and CLI. */
export async function withProposalLock<T>(
  root: string,
  id: string,
  action: () => Promise<T>,
): Promise<T> {
  const lock = `${proposalPath(root, id)}.lock`;
  const child = spawn(
    "flock",
    ["-w", "10", lock, "bun", "-e", 'console.log("owned"); await Bun.stdin.text();'],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stdin.on("error", () => {});
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.stdout.once("data", () => resolve());
    child.once("close", () =>
      reject(
        new ProposalError("proposal/busy", "Proposal is being reviewed in another session; retry."),
      ),
    );
  });
  try {
    return await action();
  } finally {
    child.stdin.end();
    await closed;
  }
}
