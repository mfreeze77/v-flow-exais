// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NLEPreview } from "./NLEPreview";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const h = vi.hoisted(() => ({
  loads: [] as Array<{ iframe: HTMLIFrameElement; onReady: (iframe: HTMLIFrameElement) => void }>,
}));
vi.mock("../../player", async () => {
  const React = await import("react");
  return {
    Player: React.forwardRef<HTMLIFrameElement, { onReady: (iframe: HTMLIFrameElement) => void }>(
      function ProbePlayer(props, ref) {
        const own = React.useRef<HTMLIFrameElement | null>(null);
        React.useEffect(() => {
          if (own.current) h.loads.push({ iframe: own.current, onReady: props.onReady });
        }, [props]);
        return React.createElement("iframe", {
          ref: (node: HTMLIFrameElement | null) => {
            own.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          },
        });
      },
    ),
  };
});
vi.mock("../../utils/studioUiPreferences", () => ({
  readStudioUiPreferences: () => ({}),
  writeStudioUiPreferences: vi.fn(),
}));
let root: Root | null = null;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  h.loads = [];
  vi.unstubAllGlobals();
});
async function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const ref = createRef<HTMLIFrameElement>();
  const onReady = vi.fn();
  const render = async (url: string) => {
    await act(async () =>
      root?.render(
        createElement(NLEPreview, {
          projectId: "project-test",
          directUrl: url,
          iframeRef: ref,
          onIframeLoad: () => {},
          onIframeReady: onReady,
        }),
      ),
    );
  };
  await render("/preview?sceneId=first");
  expect(h.loads.length).toBeGreaterThan(0);
  return { render, ref, onReady };
}
it("forwards the actual runtime-ready iframe to its owner", async () => {
  const { ref, onReady } = await mount();
  const current = h.loads[h.loads.length - 1]!;
  await act(async () => current.onReady(current.iframe));
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(onReady).toHaveBeenCalledWith(ref.current);
});
it("does not forward ready from an unrelated iframe", async () => {
  const { onReady } = await mount();
  const current = h.loads[h.loads.length - 1]!;
  await act(async () => current.onReady(document.createElement("iframe")));
  expect(onReady).not.toHaveBeenCalled();
});
it("a retiring view cannot initialize the replacement view through the shared ref", async () => {
  const { render, ref, onReady } = await mount();
  const retiring = h.loads[h.loads.length - 1]!;
  await render("/preview?sceneId=second");
  const current = h.loads[h.loads.length - 1]!;
  expect(current.iframe).not.toBe(retiring.iframe);
  expect(ref.current).toBe(current.iframe);
  await act(async () => retiring.onReady(retiring.iframe));
  expect(onReady).not.toHaveBeenCalled();
  await act(async () => current.onReady(current.iframe));
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(onReady).toHaveBeenCalledWith(current.iframe);
});

it("leaves ordinary native preview without a runtime-ready observer", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const ref = createRef<HTMLIFrameElement>();
  await act(async () =>
    root?.render(
      createElement(NLEPreview, {
        projectId: "native",
        iframeRef: ref,
        onIframeLoad: () => {},
      }),
    ),
  );
  expect(h.loads.length).toBeGreaterThan(0);
  expect(h.loads[h.loads.length - 1]!.onReady).toBeUndefined();
});
