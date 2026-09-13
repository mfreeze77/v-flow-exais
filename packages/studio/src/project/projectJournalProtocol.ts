/** Explicit transaction capability carried by the resolved managed writer.
 * Native writers have no capability and retain their existing save/history path.
 * This is an internal integration contract, not an HTTP authorization mechanism.
 */
import type { ProjectFileWriter } from "./commandWriter";

export interface JournalEdit {
  label: string;
  kind: string;
  files: Record<string, { before: string; after: string }>;
}
export interface JournalWriteCapability {
  readonly owner: "project-journal";
  readonly projectId: string;
  commitEdit(edit: JournalEdit): Promise<string[]>;
}
export type JournalWriter = ProjectFileWriter & {
  readonly vflowProjectJournal: JournalWriteCapability;
};

/** A bare write cannot carry a user-edit boundary. Refuse before mutation. */
export function createJournalWriter(capability: JournalWriteCapability): JournalWriter {
  const writer: ProjectFileWriter = async () => {
    throw new Error(
      "journal/atomic-edit-required: this managed operation must use an atomic authoring edit, not a bare file write.",
    );
  };
  Object.defineProperty(writer, "vflowProjectJournal", { value: capability });
  return writer as JournalWriter;
}

/** Do not quietly fall back if a malformed capability is present. */
export function journalForWriter(writer: ProjectFileWriter): JournalWriteCapability | null {
  if (!Object.hasOwn(writer, "vflowProjectJournal")) return null;
  const value = (writer as JournalWriter).vflowProjectJournal;
  if (
    !value ||
    value.owner !== "project-journal" ||
    typeof value.projectId !== "string" ||
    !value.projectId ||
    typeof value.commitEdit !== "function"
  )
    throw new Error("journal/invalid-capability: refusing the native fallback.");
  return value;
}
