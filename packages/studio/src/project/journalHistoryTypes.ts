/** Structural compatibility with native history without a second undo stack. */
import type { JournalEdit, JournalWriter } from "./projectJournalProtocol";

export interface JournalHistoryResult {
  ok: boolean;
  reason?: "empty" | "content-mismatch";
  label?: string;
  paths?: string[];
  files?: Record<string, { previous: string; restored: string }>;
  /** Semantic, timing, asset and conflict changes cannot be replayed as DOM patches. */
  requiresFullReload?: boolean;
}
export interface JournalHistoryState {
  readonly owner: "project-journal";
  readonly projectId: string;
  readonly loaded: boolean;
  readonly revision: number | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly busy: boolean;
  readonly uncertain: boolean;
  readonly pendingCommandId: string | null;
  readonly error: string | null;
  readonly refreshError: string | null;
  readonly commitSequence: number;
}
export interface JournalHistoryDelegate {
  readonly owner: "project-journal";
  readonly projectId: string;
  readonly writer: JournalWriter;
  getSnapshot(): JournalHistoryState;
  subscribe(listener: () => void): () => void;
  /** Explicitly accepts the currently committed state; never called during render. */
  refresh(): Promise<void>;
  commitEdit(edit: JournalEdit): Promise<string[]>;
  undo(): Promise<JournalHistoryResult>;
  redo(): Promise<JournalHistoryResult>;
  /** Exact payload/identity retry only; never rebase onto a fresh revision. */
  retryPending(): Promise<JournalHistoryResult>;
  /** Standalone recordEdit calls cannot append a native history entry. */
  recordEdit(edit: JournalEdit): Promise<void>;
  activate(): () => void;
}
