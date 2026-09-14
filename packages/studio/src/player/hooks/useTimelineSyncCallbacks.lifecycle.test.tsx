// @vitest-environment happy-dom
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineSyncCallbacks } from "./useTimelineSyncCallbacks";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const h = vi.hoisted(() => ({
  hydrate: vi.fn(),
  store: {
    elements: [],
    duration: 3,
    setClipManifest: vi.fn(),
    setClipParentMap: vi.fn(),
    setDomClipChildren: vi.fn(),
    setSubCompositionHostState: vi.fn(),
  },
}));
vi.mock("../store/playerStore", () => ({
  usePlayerStore: { getState: () => h.store },
  liveTime: { notify: vi.fn() },
}));
vi.mock("../lib/timelineDOM", () => ({ readTimelineDurationFromDocument: () => 3 }));
vi.mock("../lib/timelineIframeHelpers", () => ({
  buildMissingCompositionElements: () => ({ missing: [], updatedEls: [], patched: false }),
}));
vi.mock("../lib/runtimeProtocol", () => ({ acceptedRuntimeMessageFps: () => 30 }));
vi.mock("./timelineSyncHydration", () => ({
  safeContentDocument: (iframe: HTMLIFrameElement | null) => iframe?.contentDocument ?? null,
  hydrateTimelineFromPreview: h.hydrate,
  resolveReloadSeekTime: () => 0,
  seekAdapterToRestorePoint: () => 0,
  syncAdapterDuration: vi.fn(),
  sanitizeDurationSeconds: (value: number) => value,
  clipTreeParentMap: () => new Map(),
  collectSubCompositionDomChildren: () => [],
  collectSubCompositionHostState: () => new Map(),
  buildTimelineElementsFromClips: (clips: unknown[]) => clips,
  withImplicitDomLayers: (clips: unknown[]) => clips,
  isPreviewReadinessMessage: (event: MessageEvent, frame: HTMLIFrameElement | null) =>
    event.source === frame?.contentWindow && event.data?.source === "hf-preview",
}));
let root: Root | null = null;
let hook: ReturnType<typeof useTimelineSyncCallbacks>;
let ready = false;
let frameRef: { current: HTMLIFrameElement | null };
const pause = vi.fn();
const firstSync = vi.fn(),
  secondSync = vi.fn();
function Probe({ sync }: { sync: typeof firstSync }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  frameRef = frame;
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const seek = useRef<number | null>(null),
    refreshing = useRef(false);
  hook = useTimelineSyncCallbacks({
    iframeRef: frame,
    probeIntervalRef: timer,
    pendingSeekRef: seek,
    isRefreshingRef: refreshing,
    getAdapter: () =>
      ready
        ? {
            getDuration: () => 3,
            getTime: () => 0,
            pause,
            play() {},
            seek() {},
            isPlaying: () => false,
          }
        : null,
    syncTimelineElements: sync,
    setDuration() {},
    setCurrentTime() {},
    setTimelineReady() {},
    setIsPlaying() {},
    attachIframeShortcutListeners() {},
    applyPreviewAudioState() {},
  });
  return null;
}
async function render(sync = firstSync) {
  await act(async () => root?.render(createElement(Probe, { sync })));
}
function makeFrame() {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  return frame;
}
beforeEach(async () => {
  ready = false;
  vi.clearAllMocks();
  vi.useFakeTimers();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await render();
  frameRef.current = makeFrame();
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("one hydration listener per live document", () => {
  it("cancels an unresolved old load when a new document loads", () => {
    const add = vi.spyOn(window, "addEventListener"),
      remove = vi.spyOn(window, "removeEventListener");
    hook.onIframeLoad();
    const listener = add.mock.calls.find(([name]) => name === "message")?.[1];
    expect(listener).toBeTypeOf("function");
    frameRef.current = makeFrame();
    hook.onIframeLoad();
    expect(remove).toHaveBeenCalledWith("message", listener);
    expect(vi.getTimerCount()).toBe(1);
  });
  it("cleans a pending listener and timer on unmount", () => {
    const add = vi.spyOn(window, "addEventListener"),
      remove = vi.spyOn(window, "removeEventListener");
    hook.onIframeLoad();
    const listener = add.mock.calls.find(([name]) => name === "message")?.[1];
    expect(listener).toBeTypeOf("function");
    act(() => root?.unmount());
    root = null;
    expect(remove).toHaveBeenCalledWith("message", listener);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not initialize a replacement frame through an outgoing timeout", () => {
    hook.onIframeLoad();
    frameRef.current = makeFrame();
    ready = true;
    vi.advanceTimersByTime(5000);
    expect(h.hydrate).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });
  it("also distinguishes documents that reuse the same iframe", () => {
    hook.onIframeLoad();
    Object.defineProperty(frameRef.current!, "contentDocument", {
      configurable: true,
      value: document.implementation.createHTMLDocument(),
    });
    ready = true;
    vi.advanceTimersByTime(5000);
    expect(h.hydrate).not.toHaveBeenCalled();
  });
  it("the later explicit ready rendezvous recovers beyond the old five-second attempt", () => {
    hook.onIframeLoad();
    vi.advanceTimersByTime(5000);
    expect(h.hydrate).not.toHaveBeenCalled();
    ready = true;
    hook.onIframeLoad();
    expect(h.hydrate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("returns stable callback refs that dispatch to the latest committed render", async () => {
    const captured = hook.processTimelineMessageRef;
    const enrich = hook.enrichMissingCompositionsRef;
    await render(secondSync);
    expect(hook.processTimelineMessageRef).toBe(captured);
    expect(hook.enrichMissingCompositionsRef).toBe(enrich);
    captured.current({
      clips: [{ id: "one", start: 0, duration: 3 }] as never,
      durationInFrames: 90,
    });
    expect(secondSync).toHaveBeenCalledTimes(1);
    expect(firstSync).not.toHaveBeenCalled();
  });
});
