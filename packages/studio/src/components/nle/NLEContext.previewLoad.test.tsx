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
  token: {
    projectId: "project-test",
    buildHash: "b".repeat(64),
    revisionHash: "a".repeat(64),
    generation: 1,
  },
}));
vi.mock("../../player", () => {
  const state = {
    timelineReady: true,
    timelineSessionEpoch: 1,
    elements: [],
    beginTimelineSession: vi.fn(),
    setElements: vi.fn(),
    setSelectedElementId: vi.fn(),
  };
  const store = Object.assign((select: (s: typeof state) => unknown) => select(state), {
    getState: () => state,
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
  doc.documentElement.setAttribute("data-vflow-project-id", stamp.projectId);
  doc.documentElement.setAttribute("data-vflow-build-hash", stamp.buildHash);
  doc.documentElement.setAttribute("data-vflow-revision-hash", stamp.revisionHash);
  Object.defineProperty(el, "contentDocument", { get: () => doc });
  return el;
}
beforeEach(async () => {
  vi.clearAllMocks();
  h.iframeRef.current = frame();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  // NLEProviderProps declares `children` as required, so createElement's
  // third-argument form does not satisfy the type. The rule and the component's
  // own props disagree here; the props win, and the exemption is scoped to this
  // call rather than the file.
  await act(async () =>
    root?.render(
      createElement(NLEProvider, {
        projectId: "project-test",
        managedNavigation: { session: null, onError: h.error },
        onIframeRef: h.notify,
        // oxlint-disable-next-line react/no-children-prop
        children: createElement(Probe),
      }),
    ),
  );
  h.notify.mockClear();
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("load identity and the timeline gate", () => {
  it("accepts the correctly stamped current frame", async () => {
    const current = h.iframeRef.current!;
    await act(async () => context.onIframeLoad(current));
    expect(h.baseLoad).toHaveBeenCalledTimes(1);
    expect(h.notify).toHaveBeenCalledWith(current);
    expect(h.error).not.toHaveBeenCalled();
    expect(context.timelineDisabled).toBe(false);
  });
  it("does not initialize the current view in response to a retired frame's load", async () => {
    const retired = frame();
    await act(async () => context.onIframeLoad(retired));
    expect(h.baseLoad).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
    expect(h.error).not.toHaveBeenCalled();
    expect(context.timelineDisabled).toBe(true);
  });
  for (const field of ["projectId", "buildHash", "revisionHash"] as const)
    it(`still rejects a current preview with the wrong ${field}`, async () => {
      h.iframeRef.current = frame({ ...h.token, [field]: "wrong" });
      await act(async () => context.onIframeLoad(h.iframeRef.current!));
      expect(h.error).toHaveBeenCalledTimes(1);
      expect(h.baseLoad).not.toHaveBeenCalled();
      expect(context.timelineDisabled).toBe(true);
    });
  it("still rejects a different scene URL even with correct stamps", async () => {
    h.iframeRef.current = frame(h.token, "/preview?sceneId=another");
    await act(async () => context.onIframeLoad(h.iframeRef.current!));
    expect(h.error).toHaveBeenCalledTimes(1);
    expect(h.baseLoad).not.toHaveBeenCalled();
  });
  it("preserves the no-argument callback contract for existing integrations", async () => {
    await act(async () => context.onIframeLoad());
    expect(h.baseLoad).toHaveBeenCalledTimes(1);
    expect(h.error).not.toHaveBeenCalled();
  });
});
