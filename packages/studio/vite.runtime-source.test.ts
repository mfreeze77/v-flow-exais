import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeSourceResolver,
  runtimeSourceWarning,
  RUNTIME_SOURCE_TIMEOUT_MS,
} from "./vite.runtime-source";

/** A load that never settles — the captured AFM-059 failure mode. */
const stalls = () => new Promise<string | null>(() => {});
/** Resolves only when released, so a test can order events deliberately. */
function deferred() {
  let release!: (value: string | null) => void;
  const promise = new Promise<string | null>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
/**
 * Deterministic stand-ins for the timeout. Racing a real zero-delay against a
 * promise chain makes the winner depend on how many microtask ticks each side
 * happens to take, so the bound is either explicitly fired or never fired.
 */
const instant = () => Promise.resolve();
const never = () => new Promise<void>(() => {});
/** Fires the bound for the first N requests only. */
function firesFirst(times: number) {
  let remaining = times;
  return () => (remaining-- > 0 ? Promise.resolve() : new Promise<void>(() => {}));
}

describe("dev runtime source resolution", () => {
  it("prefers the source build and reports no timeout", async () => {
    const resolve = createRuntimeSourceResolver({
      loadSource: async () => "SOURCE",
      readDist: () => "DIST",
      delay: never,
    });
    expect(await resolve()).toEqual({ source: "SOURCE", origin: "source", timedOut: false });
  });

  it("answers from dist rather than hanging when the source build stalls", async () => {
    const readDist = vi.fn(() => "DIST");
    const resolve = createRuntimeSourceResolver({ loadSource: stalls, readDist, delay: instant });
    expect(await resolve()).toEqual({ source: "DIST", origin: "dist", timedOut: true });
    expect(readDist).toHaveBeenCalledTimes(1);
  });

  it("still answers a second and third time once a build has stalled", async () => {
    // The captured failure did not recover: the two requests after it also went
    // unanswered. Every later request must be served, not queued behind the stall.
    const resolve = createRuntimeSourceResolver({
      loadSource: stalls,
      readDist: () => "DIST",
      delay: instant,
    });
    for (const _ of [1, 2, 3])
      expect(await resolve()).toEqual({ source: "DIST", origin: "dist", timedOut: true });
  });

  it("does not start a second source build while one is in flight", async () => {
    const gate = deferred();
    const loadSource = vi.fn(() => gate.promise);
    const resolve = createRuntimeSourceResolver({
      loadSource,
      readDist: () => "DIST",
      delay: never,
    });
    const both = Promise.all([resolve(), resolve()]);
    gate.release("SOURCE");
    await both;
    expect(loadSource).toHaveBeenCalledTimes(1);
  });

  it("uses the source again once a stalled build finally settles", async () => {
    const gate = deferred();
    const resolve = createRuntimeSourceResolver({
      loadSource: () => gate.promise,
      readDist: () => "DIST",
      delay: firesFirst(1),
    });
    expect((await resolve()).origin).toBe("dist");
    gate.release("SOURCE");
    expect(await resolve()).toEqual({ source: "SOURCE", origin: "source", timedOut: false });
  });

  it("retries the source after a rejected build instead of replaying the failure", async () => {
    let attempt = 0;
    const resolve = createRuntimeSourceResolver({
      loadSource: async () => {
        attempt++;
        if (attempt === 1) throw new Error("transform failed");
        return "SOURCE";
      },
      readDist: () => "DIST",
      delay: never,
    });
    expect(await resolve()).toEqual({ source: "DIST", origin: "dist", timedOut: false });
    expect(await resolve()).toEqual({ source: "SOURCE", origin: "source", timedOut: false });
  });

  it("falls back to dist when the source build returns nothing, without claiming a timeout", async () => {
    const resolve = createRuntimeSourceResolver({
      loadSource: async () => null,
      readDist: () => "DIST",
      delay: never,
    });
    expect(await resolve()).toEqual({ source: "DIST", origin: "dist", timedOut: false });
  });

  it("treats an empty source build as no source", async () => {
    const resolve = createRuntimeSourceResolver({
      loadSource: async () => "",
      readDist: () => "DIST",
      delay: never,
    });
    expect((await resolve()).origin).toBe("dist");
  });

  it("reports none when neither source nor dist is available", async () => {
    const resolve = createRuntimeSourceResolver({
      loadSource: stalls,
      readDist: () => null,
      delay: instant,
    });
    expect(await resolve()).toEqual({ source: null, origin: "none", timedOut: true });
  });

  it("waits for the source rather than racing to dist when the build is merely slow", async () => {
    const gate = deferred();
    let waited: number | null = null;
    const resolve = createRuntimeSourceResolver({
      loadSource: () => gate.promise,
      readDist: () => "DIST",
      // Record the bound and never fire it, so the source must win on its own.
      delay: (ms) => {
        waited = ms;
        return new Promise<void>(() => {});
      },
    });
    const pending = resolve();
    gate.release("SOURCE");
    expect((await pending).origin).toBe("source");
    expect(waited).toBe(RUNTIME_SOURCE_TIMEOUT_MS);
  });

  it("honours an explicit bound over the default", async () => {
    let waited: number | null = null;
    const resolve = createRuntimeSourceResolver({
      loadSource: stalls,
      readDist: () => "DIST",
      timeoutMs: 25,
      delay: (ms) => {
        waited = ms;
        return Promise.resolve();
      },
    });
    await resolve();
    expect(waited).toBe(25);
  });
});

describe("operator warning", () => {
  it("stays silent when the source was used", () => {
    expect(runtimeSourceWarning({ source: "S", origin: "source", timedOut: false })).toBeNull();
  });
  it("says the artifact may be stale when dist is served after a stall", () => {
    const message = runtimeSourceWarning({ source: "D", origin: "dist", timedOut: true });
    expect(message).toContain("prebuilt");
    expect(message).toContain("may predate the source under test");
    expect(message).toContain(String(RUNTIME_SOURCE_TIMEOUT_MS));
  });
  it("distinguishes an empty build from a stalled one", () => {
    expect(runtimeSourceWarning({ source: "D", origin: "dist", timedOut: false })).toContain(
      "produced nothing",
    );
  });
  it("names the missing prebuilt artifact when there is nothing to serve", () => {
    expect(runtimeSourceWarning({ source: null, origin: "none", timedOut: true })).toContain(
      "no prebuilt artifact",
    );
  });
});
