import { ManagedStudioEntry } from "./ManagedStudioEntry";
import { wantsManagedStudio, managedStudioHash } from "./managedStudioAccess";
import { useState } from "react";
import { StudioApp } from "../App";
import { useMountEffect } from "../hooks/useMountEffect";
import { parseProjectIdFromHash } from "../utils/projectRouting";
import { ProjectLauncher } from "./ProjectLauncher";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { projectApi } from "./api";
import "./project.css";

import { setActiveManagedProjectId } from "./projectOwnership";
export { activeManagedProjectId, setActiveManagedProjectId } from "./projectOwnership";

function SelectedProject({ id, studio }: { id: string; studio: boolean }) {
  const [managed, setManaged] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useMountEffect(() => {
    let active = true;
    projectApi("/projects")
      .then((data) => {
        if (active) setManaged(data.projects.some((project: any) => project.id === id));
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  });
  if (error)
    return (
      <div className="vf-app vf-loading" role="alert">
        {error}
        <a href="#">Back to projects</a>
      </div>
    );
  if (managed === null) return <div className="vf-app vf-loading">Opening project…</div>;
  // Recorded before either surface mounts, so the Studio's write path is
  // decided by what the project is rather than by which component rendered.
  setActiveManagedProjectId(managed ? id : null);
  // The default workspace stays available. The opt-in Studio entry verifies the
  // server fence before mounting the same retained App with managed capabilities.
  return managed ? (
    studio ? (
      <ManagedStudioEntry id={id} />
    ) : (
      <>
        <a
          className="fixed bottom-3 right-3 z-50 rounded bg-teal-900 p-2 text-white"
          href={managedStudioHash(id, true)}
        >
          Open managed Studio preview
        </a>
        <ProjectWorkspace id={id} />
      </>
    )
  ) : (
    <StudioApp />
  );
}

export function ProjectRouter() {
  const [hash, setHash] = useState(() => window.location.hash);
  const id = parseProjectIdFromHash(hash);
  const studio = wantsManagedStudio(hash);
  useMountEffect(() => {
    const changed = () => {
      const next = window.location.hash;
      if (!parseProjectIdFromHash(next)) setActiveManagedProjectId(null);
      setHash(next);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  });
  return id ? (
    <SelectedProject key={`${id}:${studio}`} id={id} studio={studio} />
  ) : (
    <ProjectLauncher />
  );
}
