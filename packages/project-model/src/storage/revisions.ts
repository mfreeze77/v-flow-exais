import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { assertProject, type ProjectSnapshot } from "../project";

export interface RevisionPointer {
  revision: number;
  directory: string;
  sha256: string;
}
export interface CommandReceipt {
  commandId: string;
  fingerprint: string;
  pointer: RevisionPointer;
}
export interface RevisionIndex {
  history?: { undo: RevisionPointer[]; redo: RevisionPointer[] };
  manifest: { path: string; sha256: string };
  sources: Record<string, { path: string; sha256: string }>;
  previous: RevisionPointer | null;
  command: { commandId: string; fingerprint: string };
  commands: Record<string, CommandReceipt>;
}
export interface CommittedProject {
  snapshot: ProjectSnapshot;
  pointer: RevisionPointer;
  index: RevisionIndex;
}
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  const result = JSON.stringify(value);
  if (result === undefined)
    throw new Error("Project contains a value that cannot be stored as JSON.");
  return result;
}

export function assertContainedPath(root: string, path: string): void {
  const rel = relative(root, path);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith("../") || rel.startsWith("..\\"))
    throw new Error("Project path escapes its authorized root.");
  let current = root;
  for (const part of rel.split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error("Symlinks are not allowed inside revision storage.");
  }
}

export function prepareStore(projectRoot: string): string {
  const root = realpathSync(projectRoot);
  for (const part of [".vflow", ".vflow/revisions", ".vflow/staging"]) {
    const path = join(root, part);
    assertContainedPath(root, path);
    mkdirSync(path, { recursive: true });
  }
  return root;
}

function readOwned(root: string, path: string): Buffer {
  assertContainedPath(root, path);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function readRevision(projectRoot: string, pointer: RevisionPointer): CommittedProject {
  const root = realpathSync(projectRoot);
  if (
    !Number.isSafeInteger(pointer.revision) ||
    !/^\d+-[0-9a-f-]{36}$/.test(pointer.directory) ||
    !/^[0-9a-f]{64}$/.test(pointer.sha256)
  )
    throw new Error("Invalid committed revision pointer.");
  const directory = join(root, ".vflow/revisions", pointer.directory);
  const indexBytes = readOwned(root, join(directory, "index.json"));
  if (sha256(indexBytes) !== pointer.sha256)
    throw new Error("Revision index failed its content hash check.");
  const index = JSON.parse(indexBytes.toString()) as RevisionIndex;
  const manifestBytes = readOwned(root, join(directory, index.manifest.path));
  if (sha256(manifestBytes) !== index.manifest.sha256)
    throw new Error("Project manifest was modified outside its committed revision.");
  const manifest = JSON.parse(manifestBytes.toString());
  const sources: ProjectSnapshot["sources"] = Object.create(null);
  for (const [id, item] of Object.entries(index.sources)) {
    const bytes = readOwned(root, join(directory, item.path));
    if (sha256(bytes) !== item.sha256)
      throw new Error("Authoring source was modified outside its committed revision.");
    const doc = manifest.documents.find((candidate: { id: string }) => candidate.id === id);
    sources[id] = doc?.kind === "native" ? bytes.toString() : JSON.parse(bytes.toString());
  }
  const snapshot = { manifest, sources };
  assertProject(snapshot);
  if (manifest.revision !== pointer.revision)
    throw new Error("Manifest and pointer revisions disagree.");
  index.commands[sha256(index.command.commandId)] = { ...index.command, pointer };
  return { snapshot, pointer, index };
}

export function readCommittedProject(projectRoot: string): CommittedProject {
  const root = realpathSync(projectRoot);
  const pointer = JSON.parse(
    readOwned(root, join(root, ".vflow/CURRENT")).toString(),
  ) as RevisionPointer;
  return readRevision(root, pointer);
}
