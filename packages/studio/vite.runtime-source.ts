/**
 * The dev server's `/api/runtime.js` endpoint must always answer.
 *
 * It used to `await` an `ssrLoadModule` of the core runtime with no bound. A
 * stalled load therefore produced no response at all: in a captured AFM-059
 * startup failure the request sat pending for the whole 60s mount wait, the
 * preview iframe never fired `load`, and the editor reported the timeline as
 * "load-pending" forever. Worse, the server did not recover — the next two
 * requests to the same endpoint also went unanswered for 180s each, and only a
 * restart cleared it.
 *
 * The prebuilt `packages/core/dist` runtime was sitting there the whole time,
 * already wired as a fallback for the case where the source load *returns*
 * nothing. It simply could not be reached when the load never returned at all.
 * Bounding the wait reaches it.
 *
 * Source is still preferred, and still re-read on every request, so a dev
 * editing the runtime keeps seeing their edits: Vite's own module graph is the
 * cache, and nothing is memoised here that would outlive an HMR invalidation.
 */

/** How long a single request waits for the source build before falling back. */
export const RUNTIME_SOURCE_TIMEOUT_MS = 10_000;

export type RuntimeSourceOrigin = "source" | "dist" | "none";

export interface RuntimeSourceOutcome {
  source: string | null;
  origin: RuntimeSourceOrigin;
  /** True when the source build did not settle within the bound. */
  timedOut: boolean;
}

export interface RuntimeSourceDeps {
  /** Loads the runtime from source. May reject, resolve null, or never settle. */
  loadSource: () => Promise<string | null>;
  /** Reads the prebuilt artifact, or returns null when it is absent. */
  readDist: () => string | null;
  timeoutMs?: number;
  /** Injected so tests do not depend on real time. */
  delay?: (ms: number) => Promise<void>;
}

const STALLED = Symbol("runtime-source-stalled");

/**
 * A resolver shared by every request to the endpoint.
 *
 * Concurrent requests share one in-flight source build rather than each
 * starting their own — a stalled build otherwise accumulates one stuck load per
 * request for as long as the page keeps retrying.
 */
export function createRuntimeSourceResolver(
  deps: RuntimeSourceDeps,
): () => Promise<RuntimeSourceOutcome> {
  const timeoutMs = deps.timeoutMs ?? RUNTIME_SOURCE_TIMEOUT_MS;
  const delay =
    deps.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let inFlight: Promise<string | null> | null = null;

  const startOrJoin = (): Promise<string | null> => {
    if (inFlight) return inFlight;
    // A rejected build must not be remembered as the shared in-flight promise,
    // or one transient failure would be replayed to every later request.
    const started = deps
      .loadSource()
      .then((value) => {
        inFlight = null;
        return value;
      })
      .catch(() => {
        inFlight = null;
        return null;
      });
    inFlight = started;
    return started;
  };

  return async (): Promise<RuntimeSourceOutcome> => {
    // A stalled build keeps its in-flight promise deliberately: if it ever does
    // settle, the request that finds it settled gets the source. What is NOT
    // allowed is making the client wait for that to happen.
    const settled = await Promise.race([
      startOrJoin(),
      delay(timeoutMs).then(() => STALLED as typeof STALLED),
    ]);
    if (settled !== STALLED && typeof settled === "string" && settled.length > 0)
      return { source: settled, origin: "source", timedOut: false };
    const timedOut = settled === STALLED;
    const dist = deps.readDist();
    if (typeof dist === "string" && dist.length > 0)
      return { source: dist, origin: "dist", timedOut };
    return { source: null, origin: "none", timedOut };
  };
}

/** What to log when a request did not get the source it preferred. */
export function runtimeSourceWarning(outcome: RuntimeSourceOutcome): string | null {
  if (outcome.origin === "source") return null;
  const why = outcome.timedOut
    ? `the source build did not finish within ${RUNTIME_SOURCE_TIMEOUT_MS}ms`
    : "the source build produced nothing";
  return outcome.origin === "dist"
    ? `[Studio runtime] Served the prebuilt packages/core/dist runtime because ${why}. It may predate the source under test.`
    : `[Studio runtime] No runtime available: ${why}, and packages/core/dist has no prebuilt artifact.`;
}
