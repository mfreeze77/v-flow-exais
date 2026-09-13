// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NLEPreview } from "./NLEPreview";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const h = vi.hoisted(() => ({
  loads: [] as Array<{ iframe: HTMLIFrameElement; onLoad: (iframe: HTMLIFrameElement) => void }>,
}));
vi.mock("../../player", async () => {
  const React = await import("react");
  return {
    Player: React.forwardRef<HTMLIFrameElement, { onLoad: (iframe: HTMLIFrameElement) => void }>(
      function ProbePlayer(props, ref) {
        const own = React.useRef<HTMLIFrameElement | null>(null);
        React.useEffect(() => {
          if (own.current) h.loads.push({ iframe: own.current, onLoad: props.onLoad });
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
  const onLoad = vi.fn();
  const render = async (url: string) => {
    await act(async () =>
      root?.render(
        createElement(NLEPreview, {
          projectId: "project-test",
          directUrl: url,
          iframeRef: ref,
          onIframeLoad: onLoad,
        }),
      ),
    );
  };
  await render("/preview?sceneId=first");
  expect(h.loads.length).toBeGreaterThan(0);
  return { render, ref, onLoad };
}
it("forwards the actual load's iframe to its owner", async () => {
  const { ref, onLoad } = await mount();
  const current = h.loads[h.loads.length - 1]!;
  await act(async () => current.onLoad(current.iframe));
  expect(onLoad).toHaveBeenCalledTimes(1);
  expect(onLoad).toHaveBeenCalledWith(ref.current);
});
it("does not forward a load from an unrelated iframe", async () => {
  const { onLoad } = await mount();
  const current = h.loads[h.loads.length - 1]!;
  await act(async () => current.onLoad(document.createElement("iframe")));
  expect(onLoad).not.toHaveBeenCalled();
});
it("a retiring view cannot initialize the replacement view through the shared ref", async () => {
  const { render, ref, onLoad } = await mount();
  const retiring = h.loads[h.loads.length - 1]!;
  await render("/preview?sceneId=second");
  const current = h.loads[h.loads.length - 1]!;
  expect(current.iframe).not.toBe(retiring.iframe);
  expect(ref.current).toBe(current.iframe);
  await act(async () => retiring.onLoad(retiring.iframe));
  expect(onLoad).not.toHaveBeenCalled();
  await act(async () => current.onLoad(current.iframe));
  expect(onLoad).toHaveBeenCalledTimes(1);
  expect(onLoad).toHaveBeenCalledWith(current.iframe);
});
