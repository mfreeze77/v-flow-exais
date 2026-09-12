import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  constants,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyProjectCommand,
  assertCommand,
  RevisionConflict,
  type ProjectCommand,
} from "../commands";
import { assertProject, type ProjectSnapshot, type RegenerationConflict } from "../project";
import {
  assertContainedPath,
  canonicalJson,
  prepareStore,
  readCommittedProject,
  readRevision,
  sha256,
  type RevisionIndex,
  type RevisionPointer,
} from "./revisions";

export interface CommitRequest {
  historyAction?: "undo" | "redo";
  snapshot: ProjectSnapshot;
  expectedRevision: number | null;
  commandId: string;
  fingerprint: string;
}
export interface CommitResult {
  pointer: RevisionPointer;
  replayed: boolean;
}
export type CommitFaultPoint =
  | "after-document"
  | "after-staging"
  | "before-pointer"
  | "after-pointer";

function writeSynced(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function syncDirectory(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Only invoked by the flock-owned worker, or directly by fault-injection tests. */
export function commitWhileLocked(
  projectRoot: string,
  request: CommitRequest,
  fault?: (point: CommitFaultPoint) => void,
): CommitResult {
  const root = prepareStore(projectRoot);
  assertProject(request.snapshot);
  const currentPath = join(root, ".vflow/CURRENT");
  const current = existsSync(currentPath) ? readCommittedProject(root) : null;
  const commandKey = sha256(request.commandId);
  const replay = current?.index.commands[commandKey];
  if (replay) {
    if (replay.fingerprint !== request.fingerprint)
      throw new Error(
        "project/idempotency-conflict: command ID was already used with a different payload.",
      );
    return { pointer: replay.pointer, replayed: true };
  }
  if ((current?.pointer.revision ?? null) !== request.expectedRevision)
    throw new RevisionConflict(request.expectedRevision ?? -1, current?.pointer.revision ?? -1);
  const revision = (current?.pointer.revision ?? -1) + 1;
  if (request.snapshot.manifest.revision !== revision)
    throw new Error("Prepared snapshot has the wrong revision.");
  if (current && current.snapshot.manifest.id !== request.snapshot.manifest.id)
    throw new Error("Cannot replace a project's identity.");
  const directory = `${revision}-${randomUUID()}`;
  const staging = join(root, ".vflow/staging", directory);
  const destination = join(root, ".vflow/revisions", directory);
  mkdirSync(staging);
  const manifestBytes = canonicalJson(request.snapshot.manifest);
  writeSynced(join(staging, "manifest.json"), manifestBytes);
  const index: RevisionIndex = {
    manifest: { path: "manifest.json", sha256: sha256(manifestBytes) },
    sources: Object.create(null),
    previous: current?.pointer ?? null,
    commands: { ...current?.index.commands },
    command: { commandId: request.commandId, fingerprint: request.fingerprint },
    history: current
      ? { undo: [...(current.index.history?.undo || []), current.pointer], redo: [] }
      : { undo: [], redo: [] },
  };
  if (current && request.historyAction) {
    const history = current.index.history || { undo: [], redo: [] };
    const action = request.historyAction;
    if (!history[action].length) throw new Error(`Nothing to ${action}.`);
    index.history =
      action === "undo"
        ? { undo: history.undo.slice(0, -1), redo: [...history.redo, current.pointer] }
        : { undo: [...history.undo, current.pointer], redo: history.redo.slice(0, -1) };
  }
  for (const doc of request.snapshot.manifest.documents) {
    const source = request.snapshot.sources[doc.id]!;
    const bytes = typeof source === "string" ? source : canonicalJson(source);
    const path = `documents/${doc.path}`;
    writeSynced(join(staging, path), bytes);
    let parent = dirname(join(staging, path));
    while (parent !== staging) {
      syncDirectory(parent);
      parent = dirname(parent);
    }
    index.sources[doc.id] = { path, sha256: sha256(bytes) };
    fault?.("after-document");
  }
  // The journal records the committed revision identity. Its index hash is
  // resolved from the immutable receipt rather than a self-referential hash.
  const indexBytes = canonicalJson(index);
  writeSynced(join(staging, "index.json"), indexBytes);
  syncDirectory(staging);
  fault?.("after-staging");
  renameSync(staging, destination);
  syncDirectory(join(root, ".vflow/revisions"));
  const pointer = { revision, directory, sha256: sha256(indexBytes) };
  // Verify all content before the one authoritative commit-pointer change.
  readRevision(root, pointer);
  const nextPointer = join(root, ".vflow", `CURRENT-${randomUUID()}`);
  writeSynced(nextPointer, canonicalJson(pointer));
  fault?.("before-pointer");
  renameSync(nextPointer, currentPath);
  syncDirectory(join(root, ".vflow"));
  syncDirectory(root);
  fault?.("after-pointer");
  return { pointer, replayed: false };
}

/**
 * Locates the commit worker in both source and built layouts.
 *
 * `new URL("./worker.mjs", import.meta.url)` alone is only correct when this
 * module runs from source. Once the package exposes a Node condition pointing
 * at `dist/storage.js`, the same expression resolves to `dist/worker.mjs`,
 * which tsup does not emit — so the package imported cleanly under Node while
 * every worker-backed commit failed with "Module not found".
 *
 * Copying the worker into `dist` would not fix it either: the worker imports
 * `./commit.ts`, which does not exist beside the bundled output. Instead the
 * built entry points back at the shipped source worker. That is sound because
 * the worker is always spawned under Bun (see the `flock ... bun worker` call
 * below), and `src` is in the package's `files` list.
 */
function resolveCommitWorker(): string {
  const candidates = [
    // Source layout: src/storage/commit.ts -> src/storage/worker.mjs
    new URL("./worker.mjs", import.meta.url),
    // Built layout: dist/storage.js -> src/storage/worker.mjs
    new URL("../src/storage/worker.mjs", import.meta.url),
  ].map((candidate) => fileURLToPath(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `project/worker-missing: the commit worker was not found. Looked in ${candidates.join(" and ")}. ` +
      "A package build must ship src/storage/worker.mjs alongside dist/.",
  );
}

function runLockedWorker(projectRoot: string, request: CommitRequest): Promise<CommitResult> {
  const root = prepareStore(projectRoot);
  const lockPath = join(root, ".vflow/LOCK");
  assertContainedPath(root, lockPath);
  const fd = openSync(lockPath, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  const worker = resolveCommitWorker();
  return new Promise((resolve, reject) => {
    // The lock is held by the kernel and released on process death. There is
    // no stale PID/lease file to guess at after a crash or container restart.
    const child = spawn("flock", ["-w", "15", "/proc/self/fd/3", "bun", worker, root], {
      stdio: ["pipe", "pipe", "pipe", fd],
    });
    closeSync(fd);
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr!.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        let details;
        try {
          details = JSON.parse(stderr);
        } catch {
          details = { message: stderr.trim() || `Project commit worker exited ${code}.` };
        }
        reject(Object.assign(new Error(details.message), details));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin!.on("error", () => {});
    child.stdin!.end(JSON.stringify(request));
  });
}

export async function initializeProject(
  projectRoot: string,
  snapshot: ProjectSnapshot,
): Promise<CommitResult> {
  assertProject(snapshot);
  return runLockedWorker(projectRoot, {
    snapshot,
    expectedRevision: null,
    commandId: "initialize",
    fingerprint: sha256(canonicalJson(snapshot)),
  });
}

export async function executeProjectCommand(
  projectRoot: string,
  command: ProjectCommand,
  validate?: (snapshot: ProjectSnapshot) => void | Promise<void>,
  /**
   * Optional collector for intent this execution orphaned.
   *
   * An opt-in parameter rather than a field on CommitResult, so a replayed
   * command still returns a byte-identical result — replaying applies nothing,
   * and reporting an empty conflict list for it would misstate what happened.
   * Conflicts describe this execution, not the command's history.
   */
  conflicts?: RegenerationConflict[],
): Promise<CommitResult> {
  assertCommand(command);
  const current = readCommittedProject(projectRoot);
  const fingerprint = sha256(canonicalJson(command));
  const replay = current.index.commands[sha256(command.commandId)];
  if (replay) {
    if (replay.fingerprint !== fingerprint)
      throw new Error("project/idempotency-conflict: command ID reused with a different payload.");
    return { pointer: replay.pointer, replayed: true };
  }
  const operation = command.operations[0]!;
  const historyAction =
    operation.type === "undo" || operation.type === "redo" ? operation.type : undefined;
  let snapshot: ProjectSnapshot;
  if (historyAction) {
    if (command.projectId !== current.snapshot.manifest.id)
      throw new Error("Command targets a different project.");
    if (command.expectedRevision !== current.pointer.revision)
      throw new RevisionConflict(command.expectedRevision, current.pointer.revision);
    const pointer = current.index.history?.[historyAction].at(-1);
    if (!pointer) throw new Error(`Nothing to ${historyAction}.`);
    snapshot = readRevision(projectRoot, pointer).snapshot;
    snapshot.manifest.revision = current.pointer.revision + 1;
  } else snapshot = applyProjectCommand(current.snapshot, command, conflicts);
  await validate?.(snapshot);
  return runLockedWorker(projectRoot, {
    snapshot,
    expectedRevision: command.expectedRevision,
    commandId: command.commandId,
    fingerprint,
    historyAction,
  });
}
