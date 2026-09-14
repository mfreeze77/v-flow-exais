import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { EditorPreviewSession } from "@hyperframes/project-model";
import type { CompositionLevel } from "./CompositionBreadcrumb";
import { usePlayerStore } from "../../player";
import { useManagedPreviewNavigation } from "../../project/useManagedPreviewNavigation";
import {
  managedNativeSourceMap,
  previewSecondsFromFrame,
} from "../../project/managedPreviewNavigation";

export interface ManagedCompositionNavigationOptions {
  /** null means managed but waiting. It never enables native-file fallback. */
  session: EditorPreviewSession | null;
  onSceneChange?: (sceneId: string | null, sourcePath: string | null) => void;
  onError?: (error: Error) => void;
}

export function useManagedCompositionStack(options: {
  projectId: string;
  activeCompositionPath?: string | null;
  onCompositionChange?: (path: string | null) => void;
  managedNavigation?: ManagedCompositionNavigationOptions;
}) {
  const { managedNavigation, projectId, activeCompositionPath } = options;
  const { navigation, state } = useManagedPreviewNavigation(
    projectId,
    managedNavigation?.session,
    managedNavigation?.onError,
  );
  const callbacks = useRef(options);
  callbacks.current = options;
  /**
   * Values the effects below read at run time but must not re-run for.
   *
   * Both effects are deliberately triggered by a narrow key — the view being
   * displayed, or the build being navigated — and read the rest of the session
   * fresh. Listing `state.session`, `state.frame` and the rest as dependencies
   * would satisfy the lint rule by making them fire on every frame update,
   * which is a behaviour change, not a fix. A ref keeps the reads current and
   * the triggers narrow, matching the `callbacks` ref already above.
   */
  const latest = useRef({ state, managedNavigation });
  latest.current = { state, managedNavigation };
  // Named so the dependency arrays contain identifiers, not expressions: the
  // rule cannot compare a re-evaluated expression between renders.
  const isManaged = managedNavigation !== undefined;
  const masterSeekRef = useRef(0);
  const report = useCallback((error: unknown) => {
    callbacks.current.managedNavigation?.onError?.(
      error instanceof Error ? error : new Error(String(error)),
    );
  }, []);
  const announced = useRef<{
    navigation: typeof navigation;
    viewKey: string;
    buildHash: string;
    sourcePath: string | null;
  } | null>(null);
  const announce = useCallback(() => {
    const current = navigation.snapshot();
    if (!current.session || !current.token) return;
    if (
      announced.current?.navigation === navigation &&
      announced.current.viewKey === current.viewKey &&
      (current.scene?.sourcePath ?? null) === (callbacks.current.activeCompositionPath ?? null)
    )
      return;
    // Record before callbacks; a parent render must not announce this visit twice.
    announced.current = {
      navigation,
      viewKey: current.viewKey,
      buildHash: current.session.buildHash,
      sourcePath: current.scene?.sourcePath ?? null,
    };
    callbacks.current.onCompositionChange?.(current.scene?.sourcePath ?? null);
    callbacks.current.managedNavigation?.onSceneChange?.(
      current.scene?.sceneId ?? null,
      current.scene?.sourcePath ?? null,
    );
  }, [navigation]);
  // Reset old generated element identities before a different pinned view can
  // receive interaction. The native preview remains on its original code path.
  useLayoutEffect(() => {
    if (!isManaged) return;
    usePlayerStore.getState().setElements([]);
    usePlayerStore.getState().setTimelineReady(false);
    usePlayerStore.getState().clearSeekRequest();
    usePlayerStore.getState().setSelectedElementId(null);
    const { state: live } = latest.current;
    if (live.session) {
      usePlayerStore.getState().setCurrentTime(previewSecondsFromFrame(live.session, live.frame));
      masterSeekRef.current = previewSecondsFromFrame(live.session, live.returnFrame);
    }
  }, [state.viewKey, navigation, isManaged]);

  useEffect(() => {
    const { state: live, managedNavigation: nav } = latest.current;
    if (!nav || !live.session || !live.token) return;
    const current = navigation.snapshot();
    const prior = announced.current;
    // A parent path echoed from our last announcement is not a new request.
    // After regeneration, preserve the identity-based reconciliation result;
    // never reopen another appearance merely because its source path matches.
    if (
      prior?.navigation === navigation &&
      prior.buildHash !== current.session?.buildHash &&
      prior.sourcePath === (activeCompositionPath ?? null)
    ) {
      announce();
      return;
    }
    if ((current.scene?.sourcePath ?? null) === (activeCompositionPath ?? null)) {
      announce();
      return;
    }
    try {
      if (!activeCompositionPath) navigation.master(current.token!);
      else
        navigation.open(
          { sourcePath: activeCompositionPath },
          current.token!,
          usePlayerStore.getState().currentTime,
        );
    } catch (error) {
      report(error);
    }
    // Announce the actual retained view even when an external request was rejected.
    // The inspector must not retain a deleted/repointed scene after a new build.
    announce();
    // A repeated source path is deliberately not guessed. Scene-click
    // navigation below retains a specific appearance before announcing its path.
  }, [activeCompositionPath, state.session?.buildHash, navigation, isManaged, report, announce]);

  const handleNavigateComposition = useCallback(
    (index: number) => {
      if (!state.token) return;
      try {
        if (index === 0) {
          navigation.master(state.token);
          announce();
        } else if (index !== 1 || !state.scene)
          throw new Error("editor/invalid-navigation: unknown breadcrumb.");
      } catch (error) {
        report(error);
      }
    },
    [navigation, state.token, state.scene, announce, report],
  );

  const handleDrillDown = useCallback(
    (element: { id: string; compositionSrc?: string }) => {
      if (!state.token || !state.session) return;
      try {
        navigation.open(
          {
            renderToken: element.id,
            buildHash: state.token.buildHash,
            revisionHash: state.token.revisionHash,
          },
          state.token,
          usePlayerStore.getState().currentTime,
        );
        announce();
      } catch (error) {
        report(error);
      }
    },
    [navigation, state.token, state.session, announce, report],
  );

  const compositionStack = useMemo<CompositionLevel[]>(
    () =>
      state.levels.length
        ? state.levels.map((level) => ({ ...level }))
        : [{ id: "master", label: "Preparing managed preview", previewUrl: "about:blank" }],
    [state.levels],
  );
  const updateCompositionStack = useCallback<
    React.Dispatch<React.SetStateAction<CompositionLevel[]>>
  >(
    (action) => {
      try {
        const requested =
          typeof action === "function" ? action(compositionStack.map((v) => ({ ...v }))) : action;
        if (
          !requested.length ||
          requested.length > compositionStack.length ||
          requested.some((level, index) => {
            const existing = compositionStack[index];
            return (
              !existing || level.id !== existing.id || level.previewUrl !== existing.previewUrl
            );
          })
        )
          throw new Error(
            "editor/invalid-navigation: managed breadcrumbs cannot inject a URL or source path.",
          );
        handleNavigateComposition(requested.length - 1);
      } catch (error) {
        report(error);
      }
    },
    [compositionStack, handleNavigateComposition, report],
  );
  const compIdToSrc = useMemo(
    () => (state.session ? managedNativeSourceMap(state.session) : new Map<string, string>()),
    [state.session],
  );
  const setCompIdToSrc = useCallback<
    React.Dispatch<React.SetStateAction<Map<string, string>>>
  >(() => {
    report(new Error("editor/invalid-navigation: managed source maps are compiler-owned."));
  }, [report]);
  return {
    compositionStack,
    updateCompositionStack,
    handleNavigateComposition,
    handleDrillDown,
    masterSeekRef,
    compIdToSrc,
    setCompIdToSrc,
    managedState: state,
  };
}
