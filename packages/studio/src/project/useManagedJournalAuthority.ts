import { useEffect, useMemo } from "react";
import { activeManagedProjectId } from "./projectOwnership";
import { projectApi } from "./api";
import { createManagedJournal } from "./managedJournal";

/** No request during render. React Strict Mode can release/reacquire the lease. */
export function useManagedJournalAuthority(projectId: string | null) {
  const managedId = activeManagedProjectId();
  const authority = useMemo(() => {
    if (!managedId) return undefined;
    // Do not fall back to native persistence during resolution or a project switch.
    return createManagedJournal({
      projectId: managedId,
      read: () => projectApi(`/projects/${encodeURIComponent(managedId)}`),
      send: (command) => projectApi(`/projects/${encodeURIComponent(managedId)}/commands`, command),
    });
  }, [managedId]);
  useEffect(() => {
    if (!authority || projectId !== authority.projectId) return;
    const release = authority.activate();
    void authority.refresh().catch(() => {
      /* Exposed through the history status banner. */
    });
    return release;
  }, [authority, projectId]);
  return authority;
}
