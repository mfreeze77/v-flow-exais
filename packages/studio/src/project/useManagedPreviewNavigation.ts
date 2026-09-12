import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { EditorPreviewSession } from "@hyperframes/project-model";
import { createManagedPreviewNavigation } from "./managedPreviewNavigation";

/** No network, source mutation, project-global singleton or second playback clock. */
export function useManagedPreviewNavigation(
  projectId: string,
  session: EditorPreviewSession | null | undefined,
  onError?: (error: Error) => void,
) {
  const navigation = useMemo(() => createManagedPreviewNavigation(projectId), [projectId]);
  const state = useSyncExternalStore(
    navigation.subscribe,
    navigation.snapshot,
    navigation.snapshot,
  );
  const [error, setError] = useState<Error | null>(null);
  const reportRef = useRef(onError);
  reportRef.current = onError;
  useLayoutEffect(() => {
    if (!session) return;
    try {
      navigation.publish(session);
      setError(null);
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setError(failure);
      reportRef.current?.(failure);
    }
  }, [navigation, session]);
  return { navigation, state, error };
}
