/**
 * AFM-072 — the Studio's one write path for a managed project.
 *
 * The native Studio edits by writing files: `fileManager.writeProjectFile`
 * flows into preview persistence, timeline editing, block handlers, the
 * clipboard and DOM edit commits. The managed project edits by issuing project
 * commands. Both existed, and `ProjectRouter` chose between them —
 *
 *   return managed ? <ProjectWorkspace id={id} /> : <StudioApp />;
 *
 * — so a project was edited by one system or the other, with only one of them
 * producing revisions and history. Two mutation paths over the same documents
 * is the "two competing sources of truth" that undo, regeneration and reopen
 * all eventually disagree about.
 *
 * This adapter gives the file-writing editors the interface they already
 * expect, `(path, content, expectedContent?) => Promise<void>`, and turns each
 * write into a command against the authoritative document. Callers do not need
 * to know; the transaction, the revision and the history entry happen because
 * the write went through here.
 *
 * It deliberately refuses rather than falling back. A write to a path the
 * manifest does not describe would otherwise silently bypass the journal again,
 * which is the exact failure this exists to remove.
 */

import type { ProjectSnapshot } from "@hyperframes/project-model";

export type ProjectFileWriter = (
  path: string,
  content: string,
  expectedContent?: string,
) => Promise<void>;

export interface CommandWriterOptions {
  projectId: string;
  /** Reads committed state; supplied content preconditions are checked against this snapshot. */
  readSnapshot: () => Promise<ProjectSnapshot>;
  /** Posts a command; rejects on a revision conflict, as the service does. */
  sendCommand: (command: {
    commandId: string;
    origin: "ui";
    projectId: string;
    expectedRevision: number;
    operations: unknown[];
  }) => Promise<unknown>;
  newCommandId?: () => string;
}

export class ProjectWriteRejected extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectWriteRejected";
  }
}

/** A draft was derived from content that is no longer the committed document. */
export class ProjectContentConflict extends ProjectWriteRejected {
  readonly code = "project/content-conflict";

  constructor(path: string) {
    super(
      path,
      "The authoring document changed since this edit was prepared. " +
        "Keep the draft and reload or reconcile it before saving; nothing was submitted.",
    );
    this.name = "ProjectContentConflict";
  }
}

/**
 * Diagram sources are JSON objects, not retained text files. Compare JSON values
 * without treating indentation or object-key order as a semantic edit. Array
 * order remains significant (including authored sequence and relationship order).
 * An explicit stack avoids recursion limits for an externally supplied baseline.
 */
function equalJsonValue(left: unknown, right: unknown): boolean {
  const pending: [unknown, unknown][] = [[left, right]];
  while (pending.length > 0) {
    const [a, b] = pending.pop()!;
    if (a === b) continue;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const first = a as Record<string, unknown>;
    const second = b as Record<string, unknown>;
    const keys = Object.keys(first);
    if (keys.length !== Object.keys(second).length) return false;
    for (const key of keys) {
      if (!Object.hasOwn(second, key)) return false;
      pending.push([first[key], second[key]]);
    }
  }
  return true;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkContentPrecondition(
  snapshot: ProjectSnapshot,
  operation: ReturnType<typeof operationForWrite>,
  path: string,
  expectedContent: string | undefined,
): void {
  const native = operation.type === "replace-native-source";
  const current = snapshot.sources[operation.documentId];
  if (
    !Object.hasOwn(snapshot.sources, operation.documentId) ||
    (native ? typeof current !== "string" : !isJsonObject(current))
  ) {
    throw new ProjectWriteRejected(path, "The committed authoring source is missing or invalid.");
  }
  // Undefined alone means an unconditional replacement was requested. An empty
  // string is a real expected native document, never an omitted precondition.
  if (expectedContent === undefined) return;
  if (typeof expectedContent !== "string")
    throw new ProjectWriteRejected(path, "Expected authoring content must be text.");

  if (native) {
    // HTML whitespace and line endings can be authored content. Do not trim,
    // normalize, serialize through a DOM, or compare with generated preview HTML.
    if (current !== expectedContent) throw new ProjectContentConflict(path);
    return;
  }

  let expected: unknown;
  try {
    expected = JSON.parse(expectedContent);
  } catch {
    throw new ProjectWriteRejected(path, "Expected diagram content must be a JSON object.");
  }
  if (!isJsonObject(expected))
    throw new ProjectWriteRejected(path, "Expected diagram content must be a JSON object.");
  if (!equalJsonValue(current, expected)) throw new ProjectContentConflict(path);
}

/** Authoring paths are portable and forward-slashed; a writer may pass either form. */
function normalizePath(path: string): string {
  return path.split("\\").join("/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/**
 * Translates one file write into the operation that owns that document.
 *
 * Native documents carry authored HTML; diagram documents carry JSON source.
 * Sending diagram JSON as native HTML, or the reverse, is rejected by the
 * command validator — but catching it here names the file that caused it.
 */
export function operationForWrite(
  snapshot: ProjectSnapshot,
  path: string,
  content: string,
): { type: string; documentId: string; html?: string; source?: unknown } {
  const wanted = normalizePath(path);
  const document = snapshot.manifest.documents.find(
    (candidate) => normalizePath(candidate.path) === wanted,
  );

  if (!document) {
    throw new ProjectWriteRejected(
      path,
      `No authoritative document in this project has the path ${wanted}. ` +
        "A managed project is edited through project commands; writing an unknown " +
        "file would bypass the revision journal.",
    );
  }

  if (document.kind === "native") {
    return { type: "replace-native-source", documentId: document.id, html: content };
  }

  let source: unknown;
  try {
    source = JSON.parse(content);
  } catch {
    throw new ProjectWriteRejected(
      path,
      `${wanted} is a ${document.kind} document, so its source must be JSON. ` +
        "Refusing to store unparsable bytes as authored diagram source.",
    );
  }
  return { type: "replace-diagram-source", documentId: document.id, source };
}

/**
 * A writer that commits through the project command path.
 *
 * Two checks protect different windows: expectedContent detects an edit that
 * committed before this snapshot was read; expectedRevision lets the service
 * reject a race after the read. Fetching a fresh revision must never silently
 * rebase a stale whole-document edit onto newer content.
 *
 * Callers omitting expectedContent retain the existing unconditional-replacement
 * behavior against the fetched revision. Draft-based editors must supply their
 * original authoring content; this adapter cannot reconstruct an omitted base.
 * No automatic retry with a newer revision or fallback file write occurs here.
 */
export function createManagedProjectWriter(options: CommandWriterOptions): ProjectFileWriter {
  const newCommandId = options.newCommandId ?? (() => crypto.randomUUID());

  return async function writeThroughCommand(path, content, expectedContent) {
    const snapshot = await options.readSnapshot();
    if (snapshot.manifest.id !== options.projectId) {
      throw new ProjectWriteRejected(path, "The committed snapshot belongs to another project.");
    }
    if (!Number.isSafeInteger(snapshot.manifest.revision) || snapshot.manifest.revision < 0) {
      throw new ProjectWriteRejected(path, "The committed snapshot has an invalid revision.");
    }
    const operation = operationForWrite(snapshot, path, content);
    checkContentPrecondition(snapshot, operation, path, expectedContent);

    await options.sendCommand({
      commandId: newCommandId(),
      origin: "ui",
      projectId: options.projectId,
      expectedRevision: snapshot.manifest.revision,
      operations: [operation],
    });
  };
}
