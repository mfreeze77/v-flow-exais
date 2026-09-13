import { useSyncExternalStore } from "react";
import type { JournalHistoryDelegate } from "./journalHistoryTypes";

/** Recovery stays explicit; a lost acknowledgement is never retried with a new ID. */
export function JournalStatusBanner({
  authority,
  onCommitted,
}: {
  authority: JournalHistoryDelegate;
  onCommitted?: () => void;
}) {
  const state = useSyncExternalStore(
    authority.subscribe,
    authority.getSnapshot,
    authority.getSnapshot,
  );
  if (!state.error && !state.refreshError && !state.uncertain) return null;
  return (
    <section
      role="alert"
      aria-label="Project history status"
      className="px-3 py-2 border border-amber-700 text-sm"
    >
      <p>{state.refreshError ?? state.error ?? "The command acknowledgement is unresolved."}</p>
      {state.uncertain ? (
        <button
          disabled={state.busy}
          onClick={() => {
            void authority
              .retryPending()
              .then(() => onCommitted?.())
              .catch(() => {});
          }}
        >
          Retry original command
        </button>
      ) : (
        <>
          <p>Preserve or reconcile any open draft before accepting newer committed history.</p>
          <button
            disabled={state.busy}
            onClick={() => {
              void authority
                .refresh()
                .then(() => onCommitted?.())
                .catch(() => {});
            }}
          >
            Reload committed history
          </button>
        </>
      )}
    </section>
  );
}
