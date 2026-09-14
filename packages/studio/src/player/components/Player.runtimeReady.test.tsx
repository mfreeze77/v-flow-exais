// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Player } from "./Player";

vi.mock("@hyperframes/player", () => ({}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null;
let connected: RuntimeFixture[] = [];
let warm = false;
class RuntimeFixture extends HTMLElement {
  readonly iframeElement = document.createElement("iframe");
  connectedCallback() {
    connected.push(this);
    this.iframeElement.setAttribute("src", this.getAttribute("src") ?? "/preview");
    if (warm) this.dispatchEvent(new Event("ready"));
  }
}
if (!customElements.get("hyperframes-player"))
  customElements.define("hyperframes-player", RuntimeFixture);

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  connected = [];
  warm = false;
  document.body.innerHTML = "";
});
async function mount(onReady?: (iframe: HTMLIFrameElement) => void) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const ref = createRef<HTMLIFrameElement>();
  const onLoad = vi.fn();
  const render = async (ready = onReady) => {
    await act(async () =>
      root?.render(
        createElement(Player, {
          ref,
          directUrl: "/preview",
          onLoad,
          onReady: ready,
          suppressLoadingOverlay: true,
        }),
      ),
    );
  };
  await render();
  expect(connected).toHaveLength(1);
  return { fixture: connected[0]!, ref, onLoad, render };
}

describe("runtime-ready is a separate emitting-frame notification", () => {
  it("does not call onLoad when only runtime-ready arrives", async () => {
    const ready = vi.fn();
    const h = await mount(ready);
    await act(async () => h.fixture.dispatchEvent(new Event("ready")));
    expect(ready).toHaveBeenCalledExactlyOnceWith(h.fixture.iframeElement);
    expect(h.onLoad).not.toHaveBeenCalled();
  });
  it("does not pretend document load means the runtime is ready", async () => {
    const ready = vi.fn();
    const h = await mount(ready);
    await act(async () => h.fixture.iframeElement.dispatchEvent(new Event("load")));
    expect(h.onLoad).toHaveBeenCalledExactlyOnceWith(h.fixture.iframeElement);
    expect(ready).not.toHaveBeenCalled();
  });
  it("observes a ready event delivered synchronously during connection", async () => {
    warm = true;
    const ready = vi.fn();
    const h = await mount(ready);
    expect(ready).toHaveBeenCalledExactlyOnceWith(h.fixture.iframeElement);
  });
  it("reads the latest committed observer without remounting", async () => {
    const old = vi.fn(),
      next = vi.fn();
    const h = await mount(old);
    await h.render(next);
    expect(connected).toHaveLength(1);
    await act(async () => h.fixture.dispatchEvent(new Event("ready")));
    expect(old).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledExactlyOnceWith(h.fixture.iframeElement);
  });
  it("removes the ready listener on unmount", async () => {
    const ready = vi.fn();
    const h = await mount(ready);
    act(() => root?.unmount());
    root = null;
    h.fixture.dispatchEvent(new Event("ready"));
    expect(ready).not.toHaveBeenCalled();
  });
  it("preserves a caller with no runtime-ready observer", async () => {
    const h = await mount();
    await act(async () => h.fixture.dispatchEvent(new Event("ready")));
    expect(h.onLoad).not.toHaveBeenCalled();
    expect(h.ref.current).toBe(h.fixture.iframeElement);
  });
});
