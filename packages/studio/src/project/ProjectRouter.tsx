import { useState } from "react";
import { StudioApp } from "../App";
import { useMountEffect } from "../hooks/useMountEffect";
import { parseProjectIdFromHash } from "../utils/projectRouting";
import { ProjectLauncher } from "./ProjectLauncher";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { projectApi } from "./api";
import "./project.css";

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
