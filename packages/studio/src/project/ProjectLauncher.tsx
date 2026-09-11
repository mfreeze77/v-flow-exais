import { useState } from "react";
import { useMountEffect } from "../hooks/useMountEffect";
import { projectApi, openProject } from "./api";
import { BatchPanel } from "./BatchPanel";
import { SourceReview } from "./SourceReview";
import { StorySettings } from "./StorySettings";
import { StoryPlanReview } from "./StoryPlanReview";
import type { StoryOptions } from "@hyperframes/studio-server";

export function ProjectLauncher() {
  const [kind, setKind] = useState<"local" | "github">("local");
  const [sourcePath, setSourcePath] = useState(".");
  const [url, setUrl] = useState("");
  const [roots, setRoots] = useState<any[]>([]);
  const [rootId, setRootId] = useState("workspace");
  const [projects, setProjects] = useState<any[]>([]);
  const [nativeProjects, setNativeProjects] = useState<any[]>([]);
  const [intake, setIntake] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [storyDraftDirty, setStoryDraftDirty] = useState(false);
  const [planningEpoch, setPlanningEpoch] = useState(0);
  const [storyOptions, setStoryOptions] = useState<StoryOptions>({
    audience: "developers",
    purpose: "explain",
    durationSeconds: 40,
    count: 3,
  });
  const refresh = async () => {
    const data = await projectApi("/projects");
    setProjects(data.projects);
  };
  useMountEffect(() => {
    void Promise.all([
      projectApi("/sources"),
      projectApi("/projects"),
      projectApi("/batches"),
      fetch("/api/projects").then((response) => response.json()),
    ])
      .then(([sources, existing, batches, native]) => {
        setRoots(sources.roots);
        setRootId(sources.roots[0]?.id || "workspace");
        setProjects(existing.projects);
        setNativeProjects(native.projects || []);
        if (batches.batches[0]) setBatchId(batches.batches[0].id);
      })
      .catch((reason) => setError(reason.message));
  });
  async function act(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="vf-app vf-launcher">
      <header className="vf-topbar">
        <a className="vf-brand" href="#">
          <span className="vf-brand-mark">V</span> V-FLOW <span>EXAIS</span>
        </a>
        <div className="vf-tag">LOCAL STUDIO</div>
      </header>
      <section className="vf-intro">
        <div className="vf-eyebrow">FROM SOURCE TO SCREEN</div>
        <h1>
          One project.
          <br />
          <em>More than one story.</em>
        </h1>
        <p>
          Turn a repository or local project into a set of editable videos. Review the source, shape
          each story, then render the whole batch.
        </p>
      </section>
      <section className="vf-intake-card" aria-label="Source intake">
        <div className="vf-step">
          01 <span>Choose your source</span>
        </div>
        <div className="vf-tabs">
          <button aria-pressed={kind === "local"} onClick={() => setKind("local")}>
            Local project
          </button>
          <button aria-pressed={kind === "github"} onClick={() => setKind("github")}>
            GitHub repository
          </button>
        </div>
        {kind === "local" ? (
          <div className="vf-source-input">
            <label>
              Mounted source
              <select value={rootId} onChange={(event) => setRootId(event.target.value)}>
                {roots.map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Folder within source
              <input
                aria-label="Project folder"
                value={sourcePath}
                onChange={(event) => setSourcePath(event.target.value)}
                placeholder="."
              />
            </label>
          </div>
        ) : (
          <label>
            Public repository URL
            <input
              type="url"
              aria-label="Repository URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/owner/project"
            />
          </label>
        )}
        <StorySettings value={storyOptions} onChange={setStoryOptions} />
        <div className="vf-row">
          <p className="vf-muted">
            Source inspection reads files and declarations. Repository scripts stay inactive.
          </p>
          <button
            className="vf-primary"
            disabled={!!busy || storyDraftDirty}
            onClick={() =>
              void act("Inspecting source…", async () => {
                const result = await projectApi(
                  "/intakes",
                  kind === "local"
                    ? { kind, rootId, path: sourcePath, story: storyOptions }
                    : { kind, url, story: storyOptions },
                );
                setIntake(result);
                setSelected(result.proposals.map((plan: any) => plan.id));
              })
            }
          >
            {busy || "Inspect source →"}
          </button>
        </div>
      </section>
      {error && (
        <p className="vf-error" role="alert">
          {error}
        </p>
      )}
      {intake && (
        <section aria-label="Video proposals" className="vf-proposals">
          <div className="vf-step">
            02 <span>Review your video plans</span>
          </div>
          <p className="vf-muted">
            {intake.facts.packages.length} packages · {intake.facts.fileCount} source paths ·
            snapshot {intake.facts.snapshotHash.slice(0, 12)}
          </p>
          {intake.facts.understanding && (
            <SourceReview key={intake.id} understanding={intake.facts.understanding} />
          )}
          <button
            disabled={!!busy || storyDraftDirty}
            onClick={() =>
              void act("Replanning from captured source…", async () => {
                const result = await projectApi(`/intakes/${intake.id}/plan`, storyOptions);
                setIntake(result);
                setSelected(result.proposals.map((plan: any) => plan.id));
                setPlanningEpoch((epoch) => epoch + 1);
              })
            }
          >
            Replan with current story settings
          </button>
          <StoryPlanReview
            key={`${intake.id}:${planningEpoch}`}
            intake={intake}
            selected={selected}
            onSelected={setSelected}
            onIntake={setIntake}
            onDraftDirty={setStoryDraftDirty}
            act={act}
            busy={!!busy}
            onCreated={async () => {
              await refresh();
              setIntake(null);
              setStoryDraftDirty(false);
            }}
          />
        </section>
      )}
      <section className="vf-projects">
        <div className="vf-row">
          <h2>Your video projects</h2>
          {projects.length > 0 && (
            <button
              className="vf-primary"
              disabled={!!busy}
              onClick={() =>
                void act("Starting exports…", async () => {
                  const batch = await projectApi("/batches", {
                    projectIds: projects.map((project) => project.id),
                  });
                  setBatchId(batch.id);
                })
              }
            >
              Export all {projects.length} videos
            </button>
          )}
          <label className="vf-button vf-import">
            Import diagram JSON
            <input
              type="file"
              accept=".json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  void act("Importing diagram…", async () => {
                    const result = await projectApi(
                      "/import-diagram",
                      JSON.parse(await file.text()),
                    );
                    openProject(result.id);
                  });
              }}
            />
          </label>
        </div>
        <div className="vf-project-grid">
          {projects.map((project, index) => (
            <button
              className="vf-project-card"
              key={project.id}
              onClick={() => openProject(project.id)}
            >
              <span className="vf-project-art">
                <i />
                <i />
                <i />
                <b>{String(index + 1).padStart(2, "0")}</b>
              </span>
              <strong>{project.title}</strong>
              <span>Revision {project.revision} · Open in Studio ↗</span>
            </button>
          ))}
        </div>
        {!projects.length && (
          <p className="vf-muted">Your reviewed plans will appear here as editable projects.</p>
        )}
        {nativeProjects.length > 0 && (
          <details>
            <summary>Existing native compositions</summary>
            {nativeProjects.map((project) => (
              <button key={project.id} onClick={() => openProject(project.id)}>
                {project.title || project.id}
              </button>
            ))}
          </details>
        )}
      </section>
      {batchId && <BatchPanel key={batchId} batchId={batchId} />}
    </main>
  );
}
