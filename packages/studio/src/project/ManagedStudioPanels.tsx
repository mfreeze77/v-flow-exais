import { useEffect, useRef, useState } from "react";
import type { EditorDocumentContent } from "@hyperframes/project-model";
import { useNLEContext } from "../components/nle/NLEContext";
import { useDomEditActionsContext, useDomEditSelectionContext } from "../contexts/DomEditContext";
import { usePlayerStore } from "../player";
import { createManagedEditorReader } from "./editorReadClient";
import { managedStudioHash } from "./managedStudioAccess";
import {
  managedStudioPin,
  sameManagedStudioPin,
  ManagedStudioRejected,
} from "./managedStudioPolicy";
import {
  assertInspectorDocument,
  commitDiagramLabel,
  commitNativeInspectorEdit,
  diagramObjectRows,
  nativeInspectorTargets,
  type NativeInspectorTarget,
} from "./managedInspectorEdits";
import type { ManagedStudioSurface } from "./useManagedStudioSurface";

export function ManagedStudioHeader({ surface }: { surface: ManagedStudioSurface }) {
  const { journal, status, capture } = surface;
  const [error, setError] = useState<string | null>(null);
  if (!journal || !status) return null;
  const run = (task: Promise<unknown>) => {
    void task.catch((cause) => setError(String(cause)));
  };
  return (
    <header
      className="border-b border-neutral-700 p-3 text-neutral-200"
      aria-label="Managed Studio"
    >
      <div className="flex gap-3 items-center">
        <a href={managedStudioHash(journal.projectId, false)}>Project workspace</a>
        <strong>{capture?.view.title ?? "Managed Studio"}</strong>
        <span>Revision {status.revision ?? "…"} · project journal</span>
        <button
          disabled={!status.canUndo || status.busy || surface.loading}
          onClick={() => run(journal.undo())}
        >
          Undo
        </button>
        <button
          disabled={!status.canRedo || status.busy || surface.loading}
          onClick={() => run(journal.redo())}
        >
          Redo
        </button>
      </div>
      <p className="text-xs text-neutral-400">
        Managed editing preview: native text/styles and diagram labels. Timeline selection and
        scrubbing only; lifecycle, media and keyframe mutations are not enabled.
      </p>
      {!!capture?.view.unresolvedConflictCount && (
        <p role="status">
          {capture.view.unresolvedConflictCount} saved regeneration conflicts. Repair them in the
          project workspace.
        </p>
      )}
      {(error || surface.error) && <p role="alert">{error ?? surface.error}</p>}
    </header>
  );
}

export function ManagedSceneSidebar({ surface }: { surface: ManagedStudioSurface }) {
  const nle = useNLEContext();
  const disabled =
    surface.loading || !surface.capture || !surface.status?.loaded || !!surface.status.busy;
  return (
    <aside
      className="w-56 shrink-0 overflow-auto border-r border-neutral-800 p-3"
      aria-label="Managed scenes"
    >
      <h2>Scenes</h2>
      <button disabled={disabled} onClick={() => nle.handleNavigateComposition(0)}>
        Master preview
      </button>
      {surface.capture?.preview.scenes.map((scene) => (
        <button
          key={scene.sceneId}
          className="block w-full text-left border border-neutral-700 my-2 p-2"
          aria-pressed={surface.sceneId === scene.sceneId}
          disabled={disabled}
          onClick={() =>
            nle.handleDrillDown({
              id: scene.hostId,
              compositionSrc: scene.outputPath,
              tag: "div",
              start:
                (scene.startFrame * surface.capture!.preview.output.fps.denominator) /
                surface.capture!.preview.output.fps.numerator,
              duration:
                (scene.durationFrames * surface.capture!.preview.output.fps.denominator) /
                surface.capture!.preview.output.fps.numerator,
              track: 0,
            })
          }
        >
          <strong className="block">{scene.sceneId}</strong>
          <small>
            {scene.documentKind} · {scene.durationFrames} frames
          </small>
        </button>
      ))}
      <p className="text-xs text-neutral-400">
        Scene-instance identity is retained when documents appear more than once.
      </p>
    </aside>
  );
}

export function ManagedAuthoringInspector({ surface }: { surface: ManagedStudioSurface }) {
  const { capture, sceneId, journal, status } = surface;
  const nle = useNLEContext();
  const { domEditSelection } = useDomEditSelectionContext();
  const { buildDomSelectionFromTarget, applyDomSelection } = useDomEditActionsContext();
  const [source, setSource] = useState<EditorDocumentContent | null>(null);
  const [targets, setTargets] = useState<NativeInspectorTarget[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadDraft, setReloadDraft] = useState(0);
  const drafts = useRef(
    new Map<
      string,
      {
        source: EditorDocumentContent;
        targets: NativeInspectorTarget[];
        selected: string;
        text: string;
      }
    >(),
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!drafts.current.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const dirty = !!sceneId && drafts.current.has(sceneId);
  const scene = capture?.preview.scenes.find((item) => item.sceneId === sceneId);
  const view = capture?.view;
  const projectId = journal?.projectId;
  const path = scene?.sourcePath;
  const documentId = scene?.documentId;
  const visit = surface.sceneEpoch;
  useEffect(() => {
    const controller = new AbortController();
    setSource(null);
    setTargets([]);
    setSelected("");
    setError(null);
    if (!view || !projectId || !path || !documentId) return () => controller.abort();
    const savedDraft = sceneId ? drafts.current.get(sceneId) : undefined;
    if (savedDraft) {
      setSource(savedDraft.source);
      setTargets(savedDraft.targets);
      setSelected(savedDraft.selected);
      setText(savedDraft.text);
      if (savedDraft.source.revisionHash !== view.revisionHash)
        setError(
          "Your unsaved draft is retained from an earlier revision. Copy/reconcile it or explicitly discard it before editing this newer revision.",
        );
      return () => controller.abort();
    }
    void createManagedEditorReader(projectId)
      .readDocument(path, { view, signal: controller.signal })
      .then(async (value) => {
        if (!value) throw new Error("Authoring document is missing.");
        assertInspectorDocument(value, view, documentId);
        const choices = value.kind === "native" ? await nativeInspectorTargets(value) : [];
        if (controller.signal.aborted) return;
        setSource(value);
        setTargets(choices);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(String(cause));
      });
    return () => controller.abort();
  }, [view, projectId, path, documentId, visit, sceneId, reloadDraft]);

  // Selection is accepted only from this immutable scene preview, not a generated DOM id alone.
  useEffect(() => {
    if (!source || !capture || !scene || !domEditSelection || dirty) return;
    const element = domEditSelection.element;
    const root = element.ownerDocument.documentElement;
    if (
      root.getAttribute("data-vflow-build-hash") !== capture.preview.buildHash ||
      root.getAttribute("data-vflow-revision-hash") !== capture.preview.revisionHash
    )
      return;
    const owner = element.closest("[data-vflow-scene-id]");
    if (
      owner?.getAttribute("data-vflow-scene-id") !== scene.sceneId ||
      owner.getAttribute("data-vflow-document-id") !== scene.documentId
    )
      return;
    const key =
      source.kind === "native"
        ? element.getAttribute("data-hf-id")
        : element.closest("[data-node-id]")?.getAttribute("data-node-id");
    if (!key) return;
    if (source.kind === "native") {
      const target = targets.find((item) => item.hfId === key);
      if (target) {
        setSelected(target.hfId);
        setText(target.text ?? "");
      }
    } else {
      const row = diagramObjectRows(source).find((item) => item.id === key);
      if (row) {
        setSelected(row.id);
        setText(row.label);
      }
    }
  }, [source, capture, scene, domEditSelection, targets, dirty]);

  const disabled =
    !source || !scene || !journal || !status?.loaded || status.busy || surface.loading || saving;
  async function select(key: string) {
    if (!source) return;
    if (dirty && key !== selected) {
      setError("Save or discard the current draft before selecting another target.");
      return;
    }
    setSelected(key);
    setText(
      source.kind === "native"
        ? (targets.find((item) => item.hfId === key)?.text ?? "")
        : (diagramObjectRows(source).find((item) => item.id === key)?.label ?? ""),
    );
    const attr = source.kind === "native" ? "data-hf-id" : "data-node-id";
    const element = nle.iframeRef.current?.contentDocument?.querySelector<HTMLElement>(
      `[${attr}="${CSS.escape(key)}"]`,
    );
    if (element) {
      const selection = await buildDomSelectionFromTarget(element);
      const latest = surface.latest();
      if (latest.sceneEpoch === visit && latest.sceneId === sceneId) applyDomSelection(selection);
    }
  }
  async function save(style?: "color" | "fontSize" | "opacity", value?: string) {
    if (!source || !capture || !sceneId || !journal || !status) return;
    assertInspectorDocument(source, capture.view, scene!.documentId);
    const pin = managedStudioPin(capture.view, capture.preview, sceneId, status);
    const assertCurrent = () => {
      const latest = surface.latest();
      if (
        !latest.capture ||
        !latest.sceneId ||
        !latest.status ||
        latest.sceneEpoch !== visit ||
        !sameManagedStudioPin(
          pin,
          managedStudioPin(
            latest.capture.view,
            latest.capture.preview,
            latest.sceneId,
            latest.status,
          ),
        )
      )
        throw new ManagedStudioRejected(
          "The scene changed while preparing this edit. The draft has not been submitted.",
        );
    };
    setSaving(true);
    setError(null);
    try {
      if (source.kind === "native")
        await commitNativeInspectorEdit({
          content: source,
          hfId: selected,
          edit: style
            ? { type: "style", property: style, value: value ?? "" }
            : { type: "text", value: text },
          journal,
          assertCurrent,
        });
      else
        await commitDiagramLabel({
          content: source,
          objectId: selected,
          label: text,
          journal,
          assertCurrent,
        });
      drafts.current.delete(sceneId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }
  const rows = source && source.kind !== "native" ? diagramObjectRows(source) : [];
  return (
    <aside
      className="w-80 shrink-0 overflow-auto border-l border-neutral-800 p-3 text-neutral-200"
      aria-label="Managed authoring inspector"
    >
      <h2>Authoring inspector</h2>
      {!sceneId && (
        <p>Open a scene from the timeline or scene list to edit its authored content.</p>
      )}
      {scene && (
        <p className="text-xs">
          {scene.sourcePath} · {scene.sceneId}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {source && (
        <>
          <label className="block">
            {source.kind === "native" ? "Native text element" : "Diagram object"}
            <select
              aria-label="Authoring target"
              value={selected}
              disabled={disabled}
              onChange={(e) => {
                void select(e.target.value).catch((cause) => setError(String(cause)));
              }}
            >
              <option value="">Choose a target</option>
              {source.kind === "native"
                ? targets.map((target) => (
                    <option key={target.hfId} value={target.hfId}>
                      {target.tag}: {target.text?.slice(0, 50)}
                    </option>
                  ))
                : rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label} ({row.id})
                    </option>
                  ))}
            </select>
          </label>
          <label className="block">
            {source.kind === "native" ? "Text" : "Label"}
            <textarea
              aria-label="Authored text"
              value={text}
              disabled={disabled || !selected}
              maxLength={source.kind === "native" ? 10000 : 240}
              onChange={(e) => {
                setText(e.target.value);
                if (sceneId)
                  drafts.current.set(sceneId, { source, targets, selected, text: e.target.value });
              }}
            />
          </label>
          {dirty && (
            <button
              disabled={saving}
              onClick={() => {
                if (sceneId) drafts.current.delete(sceneId);
                setReloadDraft((value) => value + 1);
              }}
            >
              Discard local draft and reload
            </button>
          )}
          <button
            disabled={disabled || !selected}
            onClick={() => {
              void save().catch((cause) => setError(String(cause)));
            }}
          >
            Save authored text
          </button>
          {source.kind === "native" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                void save(
                  String(values.get("property")) as "color" | "fontSize" | "opacity",
                  String(values.get("value")),
                ).catch((cause) => setError(String(cause)));
              }}
            >
              <label>
                Style
                <select name="property" disabled={disabled}>
                  <option value="color">Colour (#RRGGBB)</option>
                  <option value="fontSize">Font size (px)</option>
                  <option value="opacity">Opacity (0–1)</option>
                </select>
              </label>
              <input
                name="value"
                aria-label="Style value"
                defaultValue="#ffffff"
                disabled={disabled}
              />
              <button disabled={disabled || !selected || dirty}>Save style</button>
            </form>
          )}
        </>
      )}
      <p className="text-xs text-neutral-400">
        One save is one project-journal transaction. Generated SVG, arbitrary attributes, media,
        keyframes and lifecycle edits are not enabled here.
      </p>
      <button onClick={() => usePlayerStore.getState().requestSeek(0)}>Seek to scene start</button>
    </aside>
  );
}
