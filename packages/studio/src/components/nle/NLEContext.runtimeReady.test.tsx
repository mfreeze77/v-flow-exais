// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NLEProvider, useNLEContext, type NLEContextValue } from "./NLEContext";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const h = vi.hoisted(() => ({
  iframeRef: { current: null as HTMLIFrameElement | null },
  baseLoad: vi.fn(),
  seek: vi.fn(),
  error: vi.fn(),
  notify: vi.fn(),
  map: new Map<string, string>(),
  setMap: vi.fn(),
  state: {
    timelineReady: false,
    timelineSessionEpoch: 1,
    elements: [] as Array<{ id: string }>,
    beginTimelineSession: vi.fn(),
    setElements: vi.fn(),
    setSelectedElementId: vi.fn(),
  },
  token: {
    projectId: "project-test",
    buildHash: "b".repeat(64),
    revisionHash: "a".repeat(64),
    generation: 1,
  },
}));
vi.mock("../../player", () => {
  const store = Object.assign((select: (s: typeof h.state) => unknown) => select(h.state), {
    getState: () => h.state,
    subscribe: () => () => {},
  });
  return {
    usePlayerStore: store,
    useTimelinePlayer: () => ({
      iframeRef: h.iframeRef,
      onIframeLoad: h.baseLoad,
      seek: h.seek,
      togglePlay: vi.fn(),
      refreshPlayer: vi.fn(),
    }),
  };
});
vi.mock("./useCompositionStack", () => ({
  useCompositionStack: () => ({
    compositionStack: [{ id: "master", label: "Master", previewUrl: "/preview" }],
    updateCompositionStack: vi.fn(),
    handleNavigateComposition: vi.fn(),
    handleDrillDown: vi.fn(),
    compIdToSrc: h.map,
    setCompIdToSrc: h.setMap,
    managedState: {
      token: h.token,
      viewKey: "master-1",
      frame: 0,
      session: { output: { fps: { numerator: 30, denominator: 1 } } },
      levels: [{ id: "master", label: "Master", previewUrl: "/preview" }],
    },
  }),
}));
vi.mock("../editor/domEditingDom", () => ({ setCompositionSourceMap: vi.fn() }));
vi.mock("../../utils/gsapSoftReload", () => ({ ensureMotionPathPluginLoaded: vi.fn() }));
vi.mock("../../utils/studioUiPreferences", () => ({
  readStudioUiPreferences: () => ({}),
  writeStudioUiPreferences: vi.fn(),
}));
vi.mock("../../utils/assetPreviewStore", () => ({
  useAssetPreviewStore: { getState: () => ({ clearPreviewAsset: vi.fn() }) },
}));
let context: NLEContextValue;
let root: Root | null = null;
function Probe() {
  context = useNLEContext();
  return null;
}
function frame(stamp = h.token, src = "/preview") {
  const el = document.createElement("iframe");
  el.setAttribute("src", src);
  const doc = document.implementation.createHTMLDocument();
  for (const [name, value] of Object.entries({
    "data-vflow-project-id": stamp.projectId,
    "data-vflow-build-hash": stamp.buildHash,
    "data-vflow-revision-hash": stamp.revisionHash,
  }))
    doc.documentElement.setAttribute(name, value);
  Object.defineProperty(el, "contentDocument", { get: () => doc });
  return el;
}
async function render(managed = true) {
  await act(async () =>
    root?.render(
      createElement(NLEProvider, {
        projectId: "project-test",
        managedNavigation: managed ? { session: null, onError: h.error } : undefined,
        onIframeRef: h.notify,
        // NLEProviderProps declares `children` as required, so createElement's
        // third-argument form does not typecheck. The props win; the exemption
        // is scoped to this call, as in NLEContext.previewLoad.test.tsx.
        // oxlint-disable-next-line react/no-children-prop
        children: createElement(Probe),
      }),
    ),
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  h.state.timelineReady = false;
  h.state.elements = [];
  h.baseLoad.mockImplementation(() => {});
  h.iframeRef.current = frame();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ content: "" }) })),
  );
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await render();
  h.notify.mockClear();
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("managed runtime readiness rendezvous", () => {
  it("re-enters real hydration after an earlier load had no runtime", async () => {
    await act(async () => context.onIframeLoad(h.iframeRef.current!));
    expect(h.baseLoad).toHaveBeenCalledTimes(1);
    h.baseLoad.mockImplementation(() => {
      h.state.timelineReady = true;
      h.state.elements = [{ id: "clip" }];
    });
    await act(async () => context.onIframeReady!(h.iframeRef.current!));
    await render();
    expect(h.baseLoad).toHaveBeenCalledTimes(2);
    expect(context.timelineDisabled).toBe(false);
    expect(context.managedTimelinePhase).toBe("ready");
  });
  it("does not manufacture readiness when discovery still returns nothing", async () => {
    await act(async () => context.onIframeReady!(h.iframeRef.current!));
    expect(h.state.timelineReady).toBe(false);
    expect(h.state.elements).toEqual([]);
    expect(context.timelineDisabled).toBe(true);
    expect(context.managedTimelinePhase).toBe("runtime-pending");
  });
  it("does not pause, seek, or notify twice for an already hydrated warm frame", async () => {
    h.state.timelineReady = true;
    h.state.elements = [{ id: "clip" }];
    await act(async () => context.onIframeReady!(h.iframeRef.current!));
    expect(h.baseLoad).not.toHaveBeenCalled();
    expect(h.seek).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });
  it("a ready flag without any elements still attempts hydration", async () => {
    h.state.timelineReady = true;
    await act(async () => context.onIframeReady!(h.iframeRef.current!));
    expect(h.baseLoad).toHaveBeenCalledTimes(1);
    expect(context.managedTimelinePhase).toBe("timeline-pending");
  });
  it("ignores runtime-ready from a retiring iframe", async () => {
    await act(async () => context.onIframeReady!(frame()));
    expect(h.baseLoad).not.toHaveBeenCalled();
    expect(h.error).not.toHaveBeenCalled();
    expect(context.timelineDisabled).toBe(true);
  });
  for (const field of ["projectId", "buildHash", "revisionHash"] as const)
    it(`keeps the ${field} guard on the later ready path`, async () => {
      h.iframeRef.current = frame({ ...h.token, [field]: "wrong" });
      await act(async () => context.onIframeReady!(h.iframeRef.current!));
      expect(h.error).toHaveBeenCalledTimes(1);
      expect(h.baseLoad).not.toHaveBeenCalled();
      expect(context.timelineDisabled).toBe(true);
    });
  it("correct stamps do not authorize readiness from a different scene URL", async () => {
    h.iframeRef.current = frame(h.token, "/preview?sceneId=other");
    await act(async () => context.onIframeReady!(h.iframeRef.current!));
    expect(h.error).toHaveBeenCalledTimes(1);
    expect(h.baseLoad).not.toHaveBeenCalled();
  });
  it("does not add a new ready observer to ordinary native sessions", async () => {
    await render(false);
    expect(context.onIframeReady).toBeUndefined();
    expect(context.managedTimelinePhase).toBeUndefined();
  });
});
