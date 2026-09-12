import { useState } from "react";
import { StudioApp } from "../App";
import { useMountEffect } from "../hooks/useMountEffect";
import { parseProjectIdFromHash } from "../utils/projectRouting";
import { ProjectLauncher } from "./ProjectLauncher";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { projectApi } from "./api";
import "./project.css";

/**
 * The managed project this session is editing, or null for a native project.
 *
 * Module state rather than context because the Studio's write path is resolved
 * once per session and read from a hook that must not force every editing
 * system to be wrapped in a provider. It is set by the router, which is the
 * only place that knows whether the opened project is managed.
 */
let managedProjectId: string | null = null;

export function activeManagedProjectId(): string | null {
  return managedProjectId;
}

/** Exported for tests; production sets this only from the router. */
export function setActiveManagedProjectId(id: string | null): void {
  managedProjectId = id;
}

function SelectedProject({ id }: { id: string }) {
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
  // Managed projects mount the shared command editor. No autonomous SDK history
  // or persist queue is created for compiler-owned output. Native projects keep
  // the retained full Studio editing surface.
  return managed ? <ProjectWorkspace id={id} /> : <StudioApp />;
}

export function ProjectRouter() {
  const [id, setId] = useState(() => parseProjectIdFromHash(window.location.hash));
  useMountEffect(() => {
    const changed = () => setId(parseProjectIdFromHash(window.location.hash));
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  });
  return id ? <SelectedProject key={id} id={id} /> : <ProjectLauncher />;
}
