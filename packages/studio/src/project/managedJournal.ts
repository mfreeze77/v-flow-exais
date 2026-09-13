/** AFM-072: one observed authoring revision, one command, one project history.
 * Transport is injected; no filesystem, IndexedDB, SDK or preview dependency.
 * The server remains the domain validator and the atomic transaction authority.
 */
import type { ProjectSnapshot } from "@hyperframes/project-model";
import { checkContentPrecondition, operationForWrite } from "./commandWriter";
import { createJournalWriter, type JournalEdit } from "./projectJournalProtocol";
import type {
  JournalHistoryDelegate,
  JournalHistoryResult,
  JournalHistoryState,
} from "./journalHistoryTypes";

export interface JournalCommand {
  commandId: string;
  origin: "ui";
  projectId: string;
  expectedRevision: number;
  operations: unknown[];
}
interface ReadState {
  snapshot: ProjectSnapshot;
  canUndo: boolean;
  canRedo: boolean;
}
interface Pending {
  command: JournalCommand;
  before: ProjectSnapshot;
  label: string;
  paths: string[];
}
export interface ManagedJournalOptions {
  projectId: string;
  read: () => Promise<unknown>;
  send: (command: JournalCommand) => Promise<unknown>;
  newCommandId?: () => string;
}

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const safeRevision = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const kinds = new Set(["native", "architecture", "workflow", "sequence", "dataflow", "lifecycle"]);

/** Check what this client uses. Full schema/compile validation remains server-owned. */
function snapshotFrom(value: unknown, projectId: string): ProjectSnapshot {
  if (!record(value) || !record(value.manifest) || !record(value.sources))
    throw new Error("journal/invalid-state: missing authoring state.");
  const m = value.manifest;
  if (
    m.id !== projectId ||
    !safeRevision(m.revision) ||
    !Array.isArray(m.documents) ||
    !m.documents.length
  )
    throw new Error("journal/invalid-state: project or revision mismatch.");
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const doc of m.documents) {
    if (
      !record(doc) ||
      !text(doc.id) ||
      !text(doc.path) ||
      !text(doc.kind) ||
      !kinds.has(doc.kind) ||
      doc.authoritative !== true ||
      ids.has(doc.id) ||
      paths.has(doc.path) ||
      !Object.hasOwn(value.sources, doc.id)
    )
      throw new Error("journal/invalid-state: invalid authoring document.");
    const source = value.sources[doc.id];
    if (doc.kind === "native" ? !text(source) : !record(source) || source.diagram_type !== doc.kind)
      throw new Error("journal/invalid-state: invalid source kind.");
    ids.add(doc.id);
    paths.add(doc.path);
  }
  return structuredClone(value) as unknown as ProjectSnapshot;
}
function readState(value: unknown, projectId: string): ReadState {
  if (!record(value) || typeof value.canUndo !== "boolean" || typeof value.canRedo !== "boolean")
    throw new Error("journal/invalid-state: history availability is missing.");
  return {
    snapshot: snapshotFrom(value.snapshot, projectId),
    canUndo: value.canUndo,
    canRedo: value.canRedo,
  };
}
function committedState(value: unknown, pending: Pending): ProjectSnapshot {
  if (
    !record(value) ||
    !record(value.pointer) ||
    typeof value.replayed !== "boolean" ||
    !text(value.pointer.sha256) ||
    !/^[a-f0-9]{64}$/.test(value.pointer.sha256) ||
    !text(value.pointer.directory) ||
    !/^\d+-[0-9a-f-]{36}$/.test(value.pointer.directory)
  )
    throw new Error(
      "journal/invalid-acknowledgement: the commit may have succeeded; retry the same command.",
    );
  const snapshot = snapshotFrom(value.snapshot, pending.command.projectId);
  if (
    snapshot.manifest.revision !== pending.command.expectedRevision + 1 ||
    value.pointer.revision !== snapshot.manifest.revision
  )
    throw new Error("journal/invalid-acknowledgement: unexpected committed revision.");
  return snapshot;
}
function fileText(snapshot: ProjectSnapshot, id: string): string {
  const source = snapshot.sources[id];
  return typeof source === "string" ? source : JSON.stringify(source, null, 2);
}
function restoredResult(
  before: ProjectSnapshot,
  after: ProjectSnapshot,
  label: string,
): JournalHistoryResult {
  const files: NonNullable<JournalHistoryResult["files"]> = Object.create(null);
  for (const doc of after.manifest.documents) {
    const prior = before.manifest.documents.find(
      (item) => item.id === doc.id && item.path === doc.path,
    );
    const previous = prior ? fileText(before, doc.id) : "";
    const restored = fileText(after, doc.id);
    if (previous !== restored) files[doc.path] = { previous, restored };
  }
  return { ok: true, label, paths: Object.keys(files), files, requiresFullReload: true };
}
/** Explicit server refusals are not unknown acknowledgements; 5xx/network failures are. */
function refused(error: unknown): boolean {
  const status = record(error) ? error.status : undefined;
  return typeof status === "number" && [400, 401, 403, 404, 409, 413, 422].includes(status);
}

export function createManagedJournal(options: ManagedJournalOptions): JournalHistoryDelegate {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(options.projectId))
    throw new Error("journal/invalid-project: managed project ID required.");
  let current: ReadState | null = null;
  let pending: Pending | null = null;
  let active = false;
  let leases = 0;
  let epoch = 0;
  const listeners = new Set<() => void>();
  let state: JournalHistoryState = Object.freeze({
    owner: "project-journal",
    projectId: options.projectId,
    loaded: false,
    revision: null,
    canUndo: false,
    canRedo: false,
    busy: false,
    uncertain: false,
    pendingCommandId: null,
    error: null,
    refreshError: null,
    commitSequence: 0,
  });
  const publish = (patch: Partial<JournalHistoryState>) => {
    state = Object.freeze({ ...state, ...patch });
    if (active)
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          /* An observer cannot roll back a durable commit. */
        }
      }
  };
  const requireActive = () => {
    if (!active) throw new Error("journal/inactive: this editor session is not active.");
  };
  const requireReady = () => {
    requireActive();
    if (pending || state.uncertain)
      throw new Error("journal/uncertain: retry the original command before editing again.");
    if (state.busy) throw new Error("journal/busy: an authoring action is already in progress.");
    if (!state.loaded || !current)
      throw new Error("journal/not-loaded: reload committed authoring state first.");
    return current;
  };
  async function refresh(): Promise<void> {
    requireActive();
    if (pending || state.busy)
      throw new Error("journal/busy: cannot reload during an unresolved action.");
    const captured = ++epoch;
    publish({ loaded: false, canUndo: false, canRedo: false, error: null, refreshError: null });
    try {
      const read = readState(await options.read(), options.projectId);
      if (!active || captured !== epoch) return;
      current = read;
      publish({
        loaded: true,
        revision: read.snapshot.manifest.revision,
        canUndo: read.canUndo,
        canRedo: read.canRedo,
      });
    } catch (error) {
      if (active && captured === epoch) publish({ error: message(error) });
      throw error;
    }
  }
  async function sendPending(): Promise<JournalHistoryResult> {
    const attempt = pending;
    if (!attempt) throw new Error("journal/no-pending-command");
    publish({ busy: true, uncertain: false, error: null });
    let after: ProjectSnapshot;
    try {
      after = committedState(await options.send(structuredClone(attempt.command)), attempt);
    } catch (error) {
      if (refused(error)) {
        pending = null;
        publish({
          busy: false,
          loaded: false,
          canUndo: false,
          canRedo: false,
          pendingCommandId: null,
          error: message(error),
          uncertain: false,
        });
      } else {
        publish({
          busy: false,
          loaded: false,
          canUndo: false,
          canRedo: false,
          uncertain: true,
          error: message(error),
        });
      }
      throw error;
    }
    pending = null;
    current = { snapshot: after, canUndo: false, canRedo: false };
    publish({
      revision: after.manifest.revision,
      loaded: false,
      pendingCommandId: null,
      uncertain: false,
      commitSequence: state.commitSequence + 1,
    });
    // A confirmed commit stays confirmed even if the availability read fails.
    try {
      const read = readState(await options.read(), options.projectId);
      if (read.snapshot.manifest.revision !== after.manifest.revision)
        throw new Error(
          "journal/stale-refresh: another change arrived; explicitly reload before further editing.",
        );
      current = read;
      publish({ loaded: true, canUndo: read.canUndo, canRedo: read.canRedo, refreshError: null });
    } catch (error) {
      publish({
        loaded: false,
        canUndo: false,
        canRedo: false,
        refreshError: `Change saved; history refresh failed: ${message(error)}`,
      });
    } finally {
      publish({ busy: false });
    }
    return restoredResult(attempt.before, after, attempt.label);
  }
  function start(operations: unknown[], label: string, paths: string[], before: ProjectSnapshot) {
    const commandId = (options.newCommandId ?? (() => crypto.randomUUID()))();
    if (!text(commandId) || !commandId.trim() || commandId.length > 128)
      throw new Error("journal/invalid-command-id");
    pending = {
      command: {
        commandId,
        origin: "ui",
        projectId: options.projectId,
        expectedRevision: before.manifest.revision,
        operations: structuredClone(operations),
      },
      before: structuredClone(before),
      label,
      paths: [...paths],
    };
    epoch++;
    publish({ pendingCommandId: commandId });
    return sendPending();
  }
  async function commitEdit(edit: JournalEdit): Promise<string[]> {
    const observed = requireReady();
    if (
      !record(edit) ||
      !text(edit.label) ||
      !edit.label.trim() ||
      edit.label.length > 240 ||
      !text(edit.kind) ||
      !record(edit.files)
    )
      throw new Error("journal/invalid-edit");
    const entries = Object.entries(edit.files);
    if (!entries.length || entries.length > 100)
      throw new Error("journal/invalid-edit: one to 100 documents required.");
    const operations: unknown[] = [];
    const paths: string[] = [];
    const seen = new Set<string>();
    for (const [path, change] of entries) {
      if (!record(change) || !text(change.before) || !text(change.after))
        throw new Error(
          "journal/baseline-required: each document needs explicit before and after content.",
        );
      const operation = operationForWrite(observed.snapshot, path, change.after);
      if (seen.has(operation.documentId))
        throw new Error("journal/duplicate-document: aliases cannot write one document twice.");
      seen.add(operation.documentId);
      // DOM/SDK edits can only author native documents. Source editing is explicit.
      if (operation.type !== "replace-native-source" && edit.kind !== "source")
        throw new Error(
          "journal/compiler-owned: use a semantic/source command, not a native DOM edit.",
        );
      checkContentPrecondition(observed.snapshot, operation, path, change.before);
      if (change.before === change.after) continue;
      operations.push(operation);
      const doc = observed.snapshot.manifest.documents.find(
        (item) => item.id === operation.documentId,
      )!;
      paths.push(doc.path);
    }
    if (!operations.length) return [];
    await start(operations, edit.label, paths, observed.snapshot);
    return paths;
  }
  async function history(direction: "undo" | "redo"): Promise<JournalHistoryResult> {
    const observed = requireReady();
    if (!observed[direction === "undo" ? "canUndo" : "canRedo"])
      return { ok: false, reason: "empty" };
    return start([{ type: direction }], "project change", [], observed.snapshot);
  }
  const writer = createJournalWriter({
    owner: "project-journal",
    projectId: options.projectId,
    commitEdit,
  });
  return {
    owner: "project-journal",
    projectId: options.projectId,
    writer,
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    activate() {
      leases++;
      active = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        leases--;
        if (!leases) {
          active = false;
          epoch++;
        }
      };
    },
    refresh,
    commitEdit,
    undo: () => history("undo"),
    redo: () => history("redo"),
    async retryPending() {
      requireActive();
      if (!pending || !state.uncertain || state.busy)
        throw new Error("journal/no-uncertain-command");
      return sendPending();
    },
    async recordEdit() {
      throw new Error(
        "journal/unowned-record: commit authoring and history together; do not append a native undo entry.",
      );
    },
  };
}
