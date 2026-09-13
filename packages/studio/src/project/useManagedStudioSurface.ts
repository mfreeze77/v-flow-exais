import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { EditorPreviewSession, EditorProjectView } from "@hyperframes/project-model";
import type { JournalHistoryDelegate, JournalHistoryState } from "./journalHistoryTypes";
import type { ManagedCompositionNavigationOptions } from "../components/nle/useManagedCompositionStack";
import { createJournalWriter } from "./projectJournalProtocol";
import { createManagedEditorReader } from "./editorReadClient";
import { createEditorPreviewClient } from "./editorPreviewClient";
import { ManagedStudioRejected } from "./managedStudioPolicy";

const noSubscribe = () => () => {};
const noSnapshot = () => null;

/** Presentation/loading state only: the existing journal remains the write/history owner. */
export function useManagedStudioSurface(
  projectId: string | null,
  journal: JournalHistoryDelegate | undefined,
  refreshKey: number,
) {
  const status = useSyncExternalStore<JournalHistoryState | null>(
    journal?.subscribe ?? noSubscribe,
    journal?.getSnapshot ?? noSnapshot,
    journal?.getSnapshot ?? noSnapshot,
  );
  const [capture, setCapture] = useState<{
    view: EditorProjectView;
    preview: EditorPreviewSession;
  } | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const sceneEpoch = useRef(0);
  const current = useRef({ capture, sceneId, sceneEpoch: sceneEpoch.current, status });
  current.current = { capture, sceneId, sceneEpoch: sceneEpoch.current, status };
  const revision = status?.revision;
  const loaded = status?.loaded;
  const sequence = status?.commitSequence;
  const enabled = !!journal;

  useEffect(() => {
    const epoch = ++generation.current;
    const controller = new AbortController();
    if (!journal || !projectId || journal.projectId !== projectId || !loaded || revision == null) {
      setLoading(enabled);
      return () => controller.abort();
    }
    setLoading(true);
    setError(null);
    void (async () => {
      const view = await createManagedEditorReader(projectId).view(controller.signal);
      if (view.revision !== revision)
        throw new Error("Authoring changed. Reload journal history before editing.");
      const preview = await createEditorPreviewClient(projectId).prepare(view, controller.signal);
      const now = journal.getSnapshot();
      if (!now.loaded || now.revision !== view.revision || now.busy || now.uncertain)
        throw new Error("The journal changed during preview preparation. Reload before editing.");
      if (!controller.signal.aborted && generation.current === epoch) setCapture({ view, preview });
    })()
      .catch((cause) => {
        if (!controller.signal.aborted && generation.current === epoch)
          setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted && generation.current === epoch) setLoading(false);
      });
    return () => controller.abort();
  }, [journal, projectId, enabled, revision, loaded, sequence, refreshKey]);

  const onSceneChange = useCallback((next: string | null) => {
    if (current.current.sceneId !== next) sceneEpoch.current++;
    current.current = { ...current.current, sceneId: next, sceneEpoch: sceneEpoch.current };
    setSceneId(next);
  }, []);
  const onError = useCallback((cause: Error) => setError(cause.message), []);
  // Annotated rather than inferred: as a bare literal this narrowed to the
  // one-parameter `onSceneChange` implemented above, while the contract — and
  // the caller in useManagedCompositionStack — passes (sceneId, sourcePath).
  // The implementation may ignore the second argument; the type must not deny
  // that it is passed.
  const navigation = useMemo(
    (): ManagedCompositionNavigationOptions | undefined =>
      journal
        ? {
            session: capture?.preview ?? null,
            onSceneChange,
            onError,
          }
        : undefined,
    [journal, capture, onSceneChange, onError],
  );
  // All inherited mutation paths are unavailable in the initial managed surface.
  // Only the bounded inspector is handed the actual journal authority.
  const blockedWriter = useMemo(
    () =>
      journal
        ? createJournalWriter({
            owner: "project-journal",
            projectId: journal.projectId,
            async commitEdit() {
              throw new ManagedStudioRejected(
                "Use the managed inspector. This inherited mutation is not adapted.",
              );
            },
          })
        : undefined,
    [journal],
  );
  const latest = useCallback(() => current.current, []);
  return {
    enabled,
    journal,
    status,
    capture,
    sceneId,
    sceneEpoch: sceneEpoch.current,
    error,
    loading,
    navigation,
    blockedWriter,
    latest,
  };
}
export type ManagedStudioSurface = ReturnType<typeof useManagedStudioSurface>;
