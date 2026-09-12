import { useMemo } from "react";
import { createProjectReadClient } from "./editorReadClient";
import { activeManagedProjectId } from "./projectOwnership";

export function useProjectReadClient(projectId: string | null) {
  const ownership =
    projectId !== null && activeManagedProjectId() === projectId ? "managed" : "native";
  return useMemo(
    () => (projectId ? createProjectReadClient(projectId, ownership) : null),
    [projectId, ownership],
  );
}
