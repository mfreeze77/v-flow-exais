import { useRef, useState } from "react";
import "@hyperframes/player";
import {
  type EditorPreviewSession,
  type ProjectSnapshot,
  type ProjectOperation,
} from "@hyperframes/project-model";
import { useManagedPreviewNavigation } from "./useManagedPreviewNavigation";
import { ManagedPreviewPlayer } from "./ManagedPreviewPlayer";
import { managedMasterTime, previewSecondsFromFrame } from "./managedPreviewNavigation";
import { createManagedEditorReader } from "./editorReadClient";
import { createEditorPreviewClient, createPreviewPublicationGate } from "./editorPreviewClient";
import { useMountEffect } from "../hooks/useMountEffect";
import { SourceEditor } from "../components/editor/SourceEditor";
import { projectApi } from "./api";
import { operationForWrite } from "./commandWriter";
import { BatchPanel } from "./BatchPanel";
import { ProposalReview } from "./ProposalReview";
import { ProjectAgentTools } from "./ProjectAgentTools";
import { RegenerationConflictPanel } from "./RegenerationConflictPanel";

type ProjectState = {
  snapshot: ProjectSnapshot;
  canUndo: boolean;
  canRedo: boolean;
  evidence: any;
};
type PlayerElement = HTMLElement & {
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
};
const collections: Record<string, string> = {
  architecture: "components",
  workflow: "nodes",
  sequence: "participants",
  dataflow: "nodes",
  lifecycle: "states",
};
const edgeCollections: Record<string, string> = {
  architecture: "connections",
  workflow: "edges",
  sequence: "messages",
  dataflow: "flows",
  lifecycle: "transitions",
};

export function ProjectWorkspace({ id }: { id: string }) {
  const [data, setData] = useState<ProjectState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"scene" | "source">("scene");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [previewSession, setPreviewSession] = useState<EditorPreviewSession | null>(null);
  const { navigation, state: navigationState } = useManagedPreviewNavigation(
    id,
    previewSession,
    (failure) => setError(failure.message),
  );
  const time = managedMasterTime(navigationState);
  const publicationGate = useRef(createPreviewPublicationGate());
  const mounted = useRef(true);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { text: string; revision: number }>>({});
  const canvas = useRef<HTMLDivElement | null>(null);
  const load = async () => {
    const gate = publicationGate.current;
    const epoch = gate.begin();
    try {
      const result = await projectApi<ProjectState>(`/projects/${id}`);
      if (!gate.isCurrent(epoch)) return;
      setData(result);
      setSelected((current) =>
        result.snapshot.manifest.scenes.some((item) => item.id === current)
          ? current
          : (result.snapshot.manifest.scenes[0]?.id ?? null),
      );
      // Never label a newer build with the revision of an earlier GET.
      const view = await createManagedEditorReader(id).view();
      if (!gate.isCurrent(epoch)) return;
      if (view.revision !== result.snapshot.manifest.revision)
        throw new Error(
          "Project changed while loading. Reload; the last valid preview is retained.",
        );
      const session = await createEditorPreviewClient(id).prepare(view);
      if (gate.isCurrent(epoch)) setPreviewSession(session);
    } catch (error) {
      if (gate.isCurrent(epoch)) throw error;
    }
  };
  useMountEffect(() => {
    mounted.current = true;
    publicationGate.current = createPreviewPublicationGate();
    void load().catch((reason) => {
      if (mounted.current) setError(reason.message);
    });
    return () => {
      mounted.current = false;
      publicationGate.current.dispose();
    };
  });
  async function commit(
    operations: ProjectOperation[],
    expectedRevision = data!.snapshot.manifest.revision,
  ) {
    setBusy("Saving…");
    setError("");
    let committed = false;
    try {
      await projectApi(`/projects/${id}/commands`, {
        commandId: crypto.randomUUID(),
        origin: "ui",
        projectId: id,
        expectedRevision,
        operations,
      });
      committed = true;
      await load();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(committed ? `Edit saved; preview refresh failed: ${message}` : message);
      // A preview failure must not turn a confirmed commit into a reported failed write.
      if (!committed) throw reason;
    } finally {
      setBusy("");
    }
  }
  const run = (action: Promise<unknown>) => {
    void action.catch(() => {});
  };
  const seek = (next: number) => {
    if (!navigationState.token || !navigationState.session) return;
    try {
      const wasMaster = navigationState.scene === null;
      navigation.seekMaster(next, navigationState.token);
      // Switching out of a standalone scene remounts the one player. Its ready
      // handler restores this desired position; do not seek the outgoing frame.
      if (wasMaster)
        (canvas.current?.querySelector("hyperframes-player") as PlayerElement | null)?.seek(
          previewSecondsFromFrame(navigationState.session, navigation.snapshot().frame),
        );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  if (!data)
    return (
      <div className="vf-app vf-loading">
        {error ? <p role="alert">{error}</p> : "Opening authoring state…"}
        <a href="#">All projects</a>
      </div>
    );
  const { manifest, sources } = data.snapshot;
  const scene = manifest.scenes.find((item) => item.id === selected) || manifest.scenes[0]!;
  const doc = manifest.documents.find((item) => item.id === scene.documentId)!;
  const source = sources[doc.id]!;
  const objects: any[] =
    typeof source === "string" ? [] : (source[collections[doc.kind]!] as any[]) || [];
  const edges: any[] =
    typeof source === "string" ? [] : (source[edgeCollections[doc.kind]!] as any[]) || [];
  const fps = manifest.output.fps.numerator / manifest.output.fps.denominator;
  const previewFps = navigationState.session
    ? navigationState.session.output.fps.numerator / navigationState.session.output.fps.denominator
    : fps;
  const totalFrames =
    navigationState.session?.durationFrames ??
    Math.max(...manifest.scenes.map((item) => item.startFrame + item.durationFrames));
  const draft = drafts[doc.id];
  const text =
    draft?.text ?? (typeof source === "string" ? source : JSON.stringify(source, null, 2));
  return (
    <main className="vf-app vf-workspace">
      <ProjectAgentTools projectId={id} intakeId={data.evidence?.intakeId} />
      <header className="vf-topbar">
        <a className="vf-brand" href="#">
          <span className="vf-brand-mark">V</span> V-FLOW
        </a>
        <a href="#">← All projects</a>
        <strong>{manifest.title}</strong>
        <span className="vf-tag">Saved revision {manifest.revision}</span>
        <div className="vf-spacer" />
        <button disabled={!!busy} onClick={() => setReviewOpen(true)}>
          Proposals
        </button>
        <button disabled={!data.canUndo || !!busy} onClick={() => run(commit([{ type: "undo" }]))}>
          Undo
        </button>
        <button disabled={!data.canRedo || !!busy} onClick={() => run(commit([{ type: "redo" }]))}>
          Redo
        </button>
        <button
          className="vf-primary"
          disabled={!!busy}
          onClick={() => {
            setBusy("Starting render…");
            projectApi("/batches", { projectIds: [id] })
              .then((batch) => setBatchId(batch.id))
              .catch((reason) => setError(reason.message))
              .finally(() => setBusy(""));
          }}
        >
          Export MP4
        </button>
      </header>
      {reviewOpen && (
        <ProposalReview
          projectId={id}
          intakeId={data.evidence?.intakeId}
          currentRevision={manifest.revision}
          onAccepted={load}
          onClose={() => setReviewOpen(false)}
        />
      )}
      {error && (
        <div className="vf-error" role="alert">
          {error}{" "}
          <button onClick={() => void load().catch((reason) => setError(reason.message))}>
            Reload committed project
          </button>
        </div>
      )}
      <RegenerationConflictPanel
        snapshot={data.snapshot}
        busy={!!busy}
        onResolve={(operation) => run(commit([operation]))}
      />
      <div className="vf-editor-grid">
        <aside className="vf-story-panel">
          <div className="vf-panel-heading">
            STORY <span>{manifest.scenes.length} scenes</span>
          </div>
          {manifest.scenes.map((item, index) => (
            <button
              className={`vf-scene-card ${item.id === scene.id ? "selected" : ""}`}
              key={item.id}
              onClick={() => {
                setSelected(item.id);
                const appearance = navigationState.session?.scenes.find(
                  (binding) => binding.sceneId === item.id,
                );
                if (appearance)
                  seek(previewSecondsFromFrame(navigationState.session!, appearance.startFrame));
              }}
            >
              <span>
                {String(index + 1).padStart(2, "0")} / {item.kind}
              </span>
              <strong>{item.presentation.title}</strong>
              <small>{(item.durationFrames / fps).toFixed(1)}s</small>
            </button>
          ))}
          <details className="vf-evidence">
            <summary>Source evidence</summary>
            <p>{data.evidence?.limitations?.[0] || "Imported authored source."}</p>
            {manifest.revision > 0 && (
              <p>Project contains edits after import. Citations describe the imported snapshot.</p>
            )}
            {data.evidence?.citations?.map((item: any) => (
              <p key={item.path}>
                <code>{item.path}</code>
              </p>
            ))}
          </details>
        </aside>
        <section className="vf-canvas-panel">
          <div className="vf-canvas-label">
            <span>
              {navigationState.session?.output.width ?? manifest.output.width} ×{" "}
              {navigationState.session?.output.height ?? manifest.output.height} ·{" "}
              {previewFps.toFixed(2)} fps
            </span>
            <span>
              {busy ||
                (previewSession?.revision === manifest.revision
                  ? "Preview up to date"
                  : "Showing last valid preview")}
            </span>
          </div>
          {navigationState.session?.scenes.some((item) => item.sceneId === scene.id) && (
            <button
              disabled={!!busy || !navigationState.token}
              onClick={() => {
                try {
                  navigation.open({ sceneId: scene.id }, navigationState.token!);
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : String(reason));
                }
              }}
              aria-label={`Preview scene ${scene.presentation.title} in this editor`}
            >
              Preview selected scene here
            </button>
          )}
          <div className="vf-canvas" ref={canvas}>
            {navigationState.session && (
              <ManagedPreviewPlayer
                key={navigationState.viewKey}
                state={navigationState}
                navigation={navigation}
                onError={(failure) => setError(failure.message)}
              />
            )}
          </div>
          <section className="vf-timeline" aria-label="Project timeline">
            <div className="vf-row">
              <strong>{time.toFixed(2)}s</strong>
              <span>{totalFrames} frames</span>
              <span>{(totalFrames / previewFps).toFixed(1)}s total</span>
            </div>
            <input
              type="range"
              aria-label="Timeline position"
              disabled={!navigationState.token}
              min={0}
              max={totalFrames - 1}
              step={1}
              value={Math.min(totalFrames - 1, Math.round(time * previewFps))}
              onChange={(event) => seek(Number(event.target.value) / previewFps)}
            />
            <div className="vf-timeline-clips">
              {manifest.scenes.map((item) => (
                <button
                  key={item.id}
                  style={{ flex: item.durationFrames }}
                  aria-pressed={scene.id === item.id}
                  onClick={() => {
                    setSelected(item.id);
                    const appearance = navigationState.session?.scenes.find(
                      (binding) => binding.sceneId === item.id,
                    );
                    if (appearance)
                      seek(
                        previewSecondsFromFrame(navigationState.session!, appearance.startFrame),
                      );
                  }}
                >
                  {item.presentation.title}
                  <small>{(item.durationFrames / fps).toFixed(1)}s</small>
                </button>
              ))}
            </div>
          </section>
          {batchId && <BatchPanel key={batchId} batchId={batchId} />}
        </section>
        <aside className="vf-inspector">
          <div className="vf-tabs">
            <button aria-pressed={tab === "scene"} onClick={() => setTab("scene")}>
              Scene
            </button>
            <button aria-pressed={tab === "source"} onClick={() => setTab("source")}>
              Source
            </button>
          </div>
          {tab === "source" ? (
            <>
              <p className="vf-muted">
                {doc.path} · {draft ? `Draft from revision ${draft.revision}` : "Committed source"}
              </p>
              <div className="vf-source-editor">
                <SourceEditor
                  filePath={doc.path}
                  content={text}
                  onChange={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [doc.id]: {
                        text: value,
                        revision: current[doc.id]?.revision ?? manifest.revision,
                      },
                    }))
                  }
                />
              </div>
              <button
                className="vf-primary"
                disabled={!draft || !!busy}
                onClick={() => {
                  try {
                    // One translation from document to operation, shared with
                    // the Studio's managed write path. Two copies would let the
                    // two surfaces disagree about what editing a document means.
                    const operation = operationForWrite(
                      data.snapshot,
                      doc.path,
                      text,
                    ) as ProjectOperation;
                    run(
                      commit([operation], draft!.revision).then(() =>
                        setDrafts((current) => {
                          const next = { ...current };
                          delete next[doc.id];
                          return next;
                        }),
                      ),
                    );
                  } catch (reason) {
                    setError((reason as Error).message);
                  }
                }}
              >
                Validate and save source
              </button>
            </>
          ) : (
            <>
              <form
                key={`${scene.id}-${manifest.revision}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields = new FormData(event.currentTarget);
                  const durationFrames = Number(fields.get("frames"));
                  const presentation = {
                    ...scene.presentation,
                    title: String(fields.get("title")),
                    subtitle: String(fields.get("subtitle")),
                    relationshipIds: fields.getAll("relationship").map(String),
                  };
                  run(
                    commit([
                      { type: "set-scene-presentation", sceneId: scene.id, presentation },
                      { type: "set-scene-duration", sceneId: scene.id, durationFrames },
                    ]),
                  );
                }}
              >
                <label>
                  Scene title
                  <input
                    name="title"
                    defaultValue={scene.presentation.title}
                    required
                    maxLength={240}
                  />
                </label>
                <label>
                  Supporting line
                  <textarea
                    name="subtitle"
                    defaultValue={scene.presentation.subtitle || ""}
                    rows={3}
                  />
                </label>
                <label>
                  Duration in frames
                  <input
                    name="frames"
                    type="number"
                    min={45}
                    max={216000}
                    step={1}
                    defaultValue={scene.durationFrames}
                  />
                </label>
                {edges.length > 0 && (
                  <fieldset>
                    <legend>Animate authored relationships</legend>
                    {edges.map((edge) => (
                      <label className="vf-check" key={edge.id}>
                        <input
                          type="checkbox"
                          name="relationship"
                          value={edge.id}
                          defaultChecked={scene.presentation.relationshipIds.includes(edge.id)}
                        />
                        <span>
                          {edge.from} → {edge.to}
                          <small>{edge.label || edge.id}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <button className="vf-primary" disabled={!!busy}>
                  Save scene
                </button>
              </form>
              {objects.length > 0 && (
                <section className="vf-object-list">
                  <h3>Diagram objects</h3>
                  {objects.map((object) => (
                    <form
                      key={`${object.id}-${manifest.revision}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        run(
                          commit([
                            {
                              type: "rename-object",
                              documentId: doc.id,
                              objectId: object.id,
                              label: String(new FormData(event.currentTarget).get("label")),
                            },
                          ]),
                        );
                      }}
                    >
                      <label>
                        {object.id}
                        <input
                          name="label"
                          aria-label={`Label for ${object.id}`}
                          defaultValue={object.label}
                          required
                          maxLength={240}
                        />
                      </label>
                      <button disabled={!!busy}>Rename</button>
                    </form>
                  ))}
                </section>
              )}
              {doc.kind === "native" && (
                <p className="vf-muted">
                  This scene keeps its authored HTML. Open Source to edit its content and animation.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
