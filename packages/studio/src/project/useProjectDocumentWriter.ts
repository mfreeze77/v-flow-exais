/**
 * AFM-072 — resolves the Studio's write path for the active project.
 *
 * A managed project is authored through commands, so its edits commit to the
 * revision journal and share one history with edits made anywhere else. An
 * unmanaged native project has no journal, and the file writer remains its
 * authority.
 *
 * The choice is made once, here, rather than at each of the six places App.tsx
 * hands a writer to an editing system. That is deliberate: while any of those
 * call sites could pick for itself, "one command/history boundary" is a
 * property of the session, and a per-site choice is how one of them ends up
 * still writing files directly.
 */

import { useMemo } from "react";

import { projectApi } from "./api";
import { activeManagedProjectId } from "./projectOwnership";
import { journalForWriter } from "./projectJournalProtocol";
import { createManagedProjectWriter, type ProjectFileWriter } from "./commandWriter";

/**
 * @param writeFile the direct file writer, used only when no managed project is
 * active. Passing it in keeps this hook free of the file-manager's dependencies
 * and makes both paths visible at the single call site.
 */
export function useProjectDocumentWriter(
  writeFile: ProjectFileWriter,
  journalWriter?: ProjectFileWriter,
): ProjectFileWriter {
  const managedId = activeManagedProjectId();

  return useMemo(() => {
    if (!managedId) return writeFile;
    if (journalWriter) {
      const capability = journalForWriter(journalWriter);
      if (!capability || capability.projectId !== managedId) {
        return async () => {
          throw new Error("journal/project-mismatch: no native fallback.");
        };
      }
      return journalWriter;
    }

    return createManagedProjectWriter({
      projectId: managedId,
      readSnapshot: async () => {
        const state = await projectApi<{ snapshot: unknown }>(`/projects/${managedId}`);
        return state.snapshot as never;
      },
      sendCommand: (command) => projectApi(`/projects/${managedId}/commands`, command),
    });
  }, [managedId, writeFile, journalWriter]);
}
