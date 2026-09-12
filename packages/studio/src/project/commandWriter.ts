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
  /** Reads the current snapshot, so a write always commits against a live revision. */
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
 * The expected revision is read immediately before sending, so a concurrent
 * commit surfaces as the service's own revision conflict rather than being
 * silently overwritten. That is the behaviour the file writer's
 * `expectedContent` check was approximating, now enforced by the project.
 */
export function createManagedProjectWriter(options: CommandWriterOptions): ProjectFileWriter {
  const newCommandId = options.newCommandId ?? (() => crypto.randomUUID());

  return async function writeThroughCommand(path, content) {
    const snapshot = await options.readSnapshot();
    const operation = operationForWrite(snapshot, path, content);

    await options.sendCommand({
      commandId: newCommandId(),
      origin: "ui",
      projectId: options.projectId,
      expectedRevision: snapshot.manifest.revision,
      operations: [operation],
    });
  };
}
