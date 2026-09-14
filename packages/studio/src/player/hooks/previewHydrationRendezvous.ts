/** One document's hydration attempt. No polling, network, or global state. */
export interface PreviewHydrationRendezvous {
  isCurrent: () => boolean;
  initialize: () => boolean;
  subscribe: (notify: () => void) => () => void;
  schedule: (notify: () => void) => () => void;
  onTimeout: () => void;
}
export function watchPreviewHydration(options: PreviewHydrationRendezvous): () => void {
  let stopped = false;
  let initializing = false;
  let unsubscribe: (() => void) | undefined;
  let cancel: (() => void) | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    unsubscribe?.();
    cancel?.();
  };
  const attempt = () => {
    if (stopped || initializing) return;
    try {
      if (!options.isCurrent()) {
        stop();
        return;
      }
      initializing = true;
      if (options.initialize()) stop();
    } catch (error) {
      stop();
      throw error;
    } finally {
      initializing = false;
    }
  };
  try {
    // Subscribe before inspecting the runtime: ready may arrive while the
    // caller initializes it. A synchronous subscriber is supported as well.
    unsubscribe = options.subscribe(attempt);
    if (stopped) unsubscribe();
    else {
      attempt();
      if (!stopped) {
        cancel = options.schedule(() => {
          if (stopped) return;
          const wasCurrent = options.isCurrent();
          try {
            attempt();
          } finally {
            const timedOut = !stopped && wasCurrent;
            stop();
            if (timedOut) options.onTimeout();
          }
        });
        if (stopped) cancel();
      }
    }
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}
