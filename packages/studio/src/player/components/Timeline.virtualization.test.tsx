// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "./Timeline";
import { usePlayerStore } from "../store/playerStore";
import { getTimelineCanvasHeight, TRACK_H } from "./timelineLayout";
import { TIMELINE_VIEWPORT_BUDGETS } from "../lib/timelineViewportBudgets";
import { timelineClipFocusId } from "./timelineNavigationIdentity";

// The real flag's env parsing has its own test. These layout tests exercise both
// branches with ONE module/store generation; resetting modules was rebuilding the
// whole editor graph inside test deadlines and made failed-case cleanup fragile.
const mode = vi.hoisted(() => ({ virtualized: true }));
vi.mock("./timelineRowVirtualizationFlag", () => ({
  get STUDIO_TIMELINE_ROW_VIRTUALIZATION_ENABLED() {
    return mode.virtualized;
  },
}));
const mounted = new Map<ReturnType<typeof createRoot>, HTMLElement>();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [
        {
          target,
          borderBoxSize: [{ inlineSize: target.clientWidth, blockSize: target.clientHeight }],
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
let clientWidth = 900;
let clientHeight = 240;

beforeAll(() => {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => clientWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
});

beforeEach(() => {
  clientWidth = 900;
  clientHeight = 240;
  mode.virtualized = true;
  usePlayerStore.getState().reset();
  // Geometry is already controlled by MockResizeObserver. Drive the browser
  // scheduler explicitly too: these assert layout/state, not machine throughput.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "Date",
      "performance",
    ],
  });
});

function unmount(root: ReturnType<typeof createRoot>) {
  const host = mounted.get(root);
  if (!host) return;
  try {
    act(() => root.unmount());
  } finally {
    mounted.delete(root);
    host.remove();
  }
}

afterEach(() => {
  const failures: unknown[] = [];
  for (const root of [...mounted.keys()]) {
    try {
      unmount(root);
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    usePlayerStore.getState().reset();
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
    mode.virtualized = true;
    document.body.innerHTML = "";
  }
  if (failures.length) throw new AggregateError(failures, "Timeline cleanup failed");
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  if (originalClientWidth)
    Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
  else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  if (originalClientHeight)
    Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
  else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  document.body.innerHTML = "";
});

/**
 * The virtualized list only mounts rows/clips after its ResizeObserver and the
 * follow-up layout effect have both flushed, which is more than one React tick.
 * Drive the configured fake clock until the actual DOM predicate holds. An
 * exhausted frame budget fails here instead of silently returning a false-ready
 * state and contaminating every later case. The wall-clock test timeout is unchanged.
 */
async function settleUntil(predicate: () => boolean, tries = 60): Promise<void> {
  for (let attempt = 0; attempt < tries; attempt++) {
    if (predicate()) return;
    await advanceFrame();
  }
  expect(predicate(), `Timeline readiness did not settle within ${tries} driven frames`).toBe(true);
}

async function advanceFrame(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(17);
  });
}

async function mountTimeline(element: React.ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.set(root, host);
  await act(async () => root.render(element));
  await act(async () => {});
  return { host, root };
}

async function dispatchScroll(scroller: HTMLElement): Promise<void> {
  await act(async () => {
    scroller.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(17);
  });
}

function clipsByTrack(count: number, duration = 1, includeLabels = false) {
  return Array.from({ length: count }, (_, track) => ({
    id: `clip-${track}`,
    ...(includeLabels ? { label: `Clip ${track}` } : {}),
    tag: "div",
    start: 0,
    duration,
    track,
  }));
}

async function scrollTimelineHorizontally(
  scroller: HTMLElement,
  scrollLeft: number,
): Promise<void> {
  scroller.scrollLeft = scrollLeft;
  await dispatchScroll(scroller);
}

// Retain the existing wall-clock ceiling. Fake time drives only scheduled UI
// work; rows, clip identities, geometry, selection, focus and DOM mutations still
// come from the actual Timeline. Browser performance is measured by its e2e suite.
describe("Timeline row virtualization", { timeout: 30_000 }, () => {
  it("keeps a zero-size first render bounded while the feature flag is enabled", async () => {
    clientWidth = 0;
    clientHeight = 0;
    usePlayerStore.setState({
      duration: 60,
      timelineReady: true,
      elements: clipsByTrack(10_000),
    });

    const { host, root } = await mountTimeline(React.createElement(Timeline, { sessionEpoch: 2 }));

    const rows = host.querySelectorAll("[data-timeline-row]");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(16);

    unmount(root);
    usePlayerStore.getState().reset();
  });

  it("defers rich clip content while scrolling without replacing the clip shell", async () => {
    usePlayerStore.setState({
      duration: 60,
      timelineReady: true,
      selectedElementId: "clip-0",
      elements: [{ id: "clip-0", label: "Clip 0", tag: "div", start: 0, duration: 10, track: 0 }],
    });

    const { host, root } = await mountTimeline(
      React.createElement(Timeline, {
        renderClipContent: () => React.createElement("span", { "data-rich-content": true }),
      }),
    );
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(110);
      });

      const scroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
      const clip = host.querySelector<HTMLElement>('[data-el-id="clip-0"]');
      expect(scroller).not.toBeNull();
      expect(clip).not.toBeNull();
      expect(clip?.title).toBe("Clip 0 • 0.0s – 10.0s");
      expect(host.querySelector("[data-rich-content]")).not.toBeNull();

      if (scroller) await dispatchScroll(scroller);
      expect(host.querySelector('[data-el-id="clip-0"]')).toBe(clip);
      expect(host.querySelector("[data-rich-content]")).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(110);
      });
      expect(host.querySelector('[data-el-id="clip-0"]')).toBe(clip);
      expect(host.querySelector("[data-rich-content]")).not.toBeNull();
    } finally {
      unmount(root);
      usePlayerStore.getState().reset();
    }
  });

  it("mounts a bounded list range over the full geometry height", async () => {
    usePlayerStore.setState({
      duration: 60,
      timelineReady: true,
      elements: clipsByTrack(1_000),
    });

    const { host, root } = await mountTimeline(React.createElement(Timeline, { sessionEpoch: 3 }));

    await settleUntil(
      () =>
        (host.querySelector('[role="treegrid"]')?.querySelectorAll('[role="row"]').length ?? 0) > 0,
    );
    const treegrid = host.querySelector<HTMLElement>('[role="treegrid"]');
    const rows = treegrid?.querySelectorAll('[role="row"]') ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(16);
    expect(rows[0]?.getAttribute("aria-rowindex")).toBe("1");
    expect(treegrid?.getAttribute("aria-rowcount")).toBe("1000");
    expect(treegrid?.hasAttribute("aria-multiselectable")).toBe(false);
    expect(treegrid?.querySelectorAll('[data-timeline-focus-id][tabindex="0"]')).toHaveLength(1);
    expect(treegrid?.parentElement?.style.height).toBe(
      `${getTimelineCanvasHeight(Array.from({ length: 1_000 }, () => TRACK_H))}px`,
    );

    const firstRow = rows[0] as HTMLElement;
    const focusedControl = firstRow.querySelector<HTMLButtonElement>("button");
    expect(focusedControl).not.toBeNull();
    act(() => focusedControl?.focus());
    const scroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
    expect(scroller).not.toBeNull();
    if (scroller) {
      scroller.scrollTop = 500 * 48;
      await act(async () => {
        scroller.dispatchEvent(new Event("scroll"));
      });
    }
    expect(treegrid?.querySelector('[data-timeline-row-key="0"]')).not.toBeNull();
    expect(document.activeElement).toBe(focusedControl);

    unmount(root);
    usePlayerStore.getState().reset();
  });

  it("keeps focus pinning active after the scroll viewport remounts", async () => {
    usePlayerStore.setState({
      duration: 60,
      timelineReady: true,
      elements: clipsByTrack(1_000),
    });

    const { host, root } = await mountTimeline(React.createElement(Timeline, { sessionEpoch: 9 }));
    await settleUntil(() => host.querySelectorAll("[data-timeline-row]").length > 0);
    const firstScroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");

    await act(async () => usePlayerStore.setState({ timelineReady: false }));
    expect(host.querySelector("[data-timeline-scroll-viewport]")).toBeNull();
    await act(async () => usePlayerStore.setState({ timelineReady: true }));
    await settleUntil(() => host.querySelectorAll("[data-timeline-row]").length > 0);

    const scroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
    const firstRow = host.querySelector<HTMLElement>('[data-timeline-row-key="0"]');
    const focusedControl = firstRow?.querySelector<HTMLButtonElement>("button");
    expect(scroller).not.toBe(firstScroller);
    expect(focusedControl).not.toBeNull();
    act(() => focusedControl?.focus());
    if (scroller) {
      scroller.scrollTop = 500 * 48;
      await dispatchScroll(scroller);
    }
    expect(host.querySelector('[data-timeline-row-key="0"]')).not.toBeNull();
    expect(document.activeElement).toBe(focusedControl);

    unmount(root);
    usePlayerStore.getState().reset();
  });

  it("windows clips and ruler cells while retaining an off-window selected clip", async () => {
    usePlayerStore.setState({
      duration: 1_000,
      timelineReady: true,
      timelineProjectId: "project-a",
      timelineSessionEpoch: 4,
      zoomMode: "manual",
      manualZoomPercent: 2_000,
      selectedElementId: "clip-490",
      selectedElementIds: new Set(["clip-490"]),
      // Repeated fixture shape intentionally contrasts row and clip windowing scales.
      // fallow-ignore-next-line code-duplication
      elements: Array.from({ length: 500 }, (_, index) => ({
        id: `clip-${index}`,
        tag: "div",
        start: index * 2,
        duration: 1,
        track: 0,
      })),
    });

    const { host, root } = await mountTimeline(React.createElement(Timeline, { sessionEpoch: 4 }));

    await settleUntil(() => host.querySelectorAll("[data-clip]").length > 1);
    const initialClips = [...host.querySelectorAll<HTMLElement>("[data-clip]")];
    const initialGridCells = host.querySelectorAll("[data-timeline-grid-cell]");
    expect(initialClips.length).toBeGreaterThan(1);
    expect(initialClips.length).toBeLessThanOrEqual(
      TIMELINE_VIEWPORT_BUDGETS.maxMountedClipRootsPerRow + 1,
    );
    expect(initialGridCells.length).toBeLessThan(100);
    expect(host.querySelector('[data-el-id="clip-490"]')).not.toBeNull();
    const initialWindowIds = initialClips.map((clip) => clip.dataset.elId);

    const scroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
    expect(scroller).not.toBeNull();
    if (scroller) await scrollTimelineHorizontally(scroller, 8_000);

    const scrolledClips = [...host.querySelectorAll<HTMLElement>("[data-clip]")];
    expect(scrolledClips.map((clip) => clip.dataset.elId)).not.toEqual(initialWindowIds);
    expect(scrolledClips.length).toBeLessThanOrEqual(
      TIMELINE_VIEWPORT_BUDGETS.maxMountedClipRootsPerRow + 1,
    );
    expect(host.querySelector('[data-el-id="clip-490"]')).not.toBeNull();
    expect(host.querySelectorAll("[data-timeline-grid-cell]").length).toBeLessThan(100);

    await act(async () =>
      usePlayerStore.getState().requestTimelineFocus(timelineClipFocusId("clip-300")),
    );
    await advanceFrame();
    await act(async () => {});
    expect(usePlayerStore.getState().timelineFocus?.id).toBe(timelineClipFocusId("clip-300"));
    const focusedClip = host.querySelector('[data-el-id="clip-300"]');
    expect(document.activeElement).toBe(focusedClip);
    await advanceFrame();
    expect(host.querySelector('[data-el-id="clip-300"]')).toBe(focusedClip);
    expect(document.activeElement).toBe(focusedClip);
    expect(host.querySelector('[data-el-id="clip-490"]')).not.toBeNull();

    if (scroller) await scrollTimelineHorizontally(scroller, 0);
    expect(host.querySelector('[data-el-id="clip-300"]')).toBe(focusedClip);
    expect(document.activeElement).toBe(focusedClip);

    unmount(root);
    usePlayerStore.getState().reset();
  });
});

/**
 * The rollback build mounts every clip, so the scroll-time concessions
 * windowing makes are pure cost there. This block pins that explicit fallback
 * to doing no per-frame work while a gesture runs.
 */
describe("Timeline without row virtualization", { timeout: 30_000 }, () => {
  async function renderUnvirtualizedTimeline() {
    mode.virtualized = false;
    usePlayerStore.setState({
      duration: 60,
      timelineReady: true,
      selectedElementId: "clip-0",
      elements: clipsByTrack(40, 10, true),
    });

    const { host, root } = await mountTimeline(
      React.createElement(Timeline, {
        renderClipContent: () => React.createElement("span", { "data-rich-content": true }),
      }),
    );
    return {
      host,
      dispose: () => {
        unmount(root);
        usePlayerStore.getState().reset();
        mode.virtualized = true;
      },
    };
  }

  it("mounts every clip rather than a window", async () => {
    const { host, dispose } = await renderUnvirtualizedTimeline();
    try {
      expect(host.querySelectorAll("[data-clip]").length).toBe(40);
    } finally {
      dispose();
    }
  });

  it("keeps clip content mounted across a scroll gesture", async () => {
    const { host, dispose } = await renderUnvirtualizedTimeline();
    try {
      const scroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
      expect(scroller).not.toBeNull();
      const richBefore = host.querySelectorAll("[data-rich-content]").length;
      expect(richBefore).toBe(40);

      if (scroller) await dispatchScroll(scroller);

      expect(host.querySelectorAll("[data-rich-content]").length).toBe(richBefore);
    } finally {
      dispose();
    }
  });

  it("does not swap clip content back in after the gesture settles", async () => {
    const { host, dispose } = await renderUnvirtualizedTimeline();
    try {
      const scroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
      const clip = host.querySelector<HTMLElement>('[data-el-id="clip-0"]');
      if (scroller) await dispatchScroll(scroller);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      expect(host.querySelector('[data-el-id="clip-0"]')).toBe(clip);
      expect(host.querySelectorAll("[data-rich-content]").length).toBe(40);
    } finally {
      dispose();
    }
  });

  it("leaves the scroll position alone, so no snapshot round trip happens", async () => {
    const { host, dispose } = await renderUnvirtualizedTimeline();
    try {
      const scroller = host.querySelector<HTMLElement>("[data-timeline-scroll-viewport]");
      if (!scroller) throw new Error("Expected a timeline scroll viewport");
      scroller.scrollTop = 400;
      await dispatchScroll(scroller);

      expect(scroller.scrollTop).toBe(400);
    } finally {
      dispose();
    }
  });
});
