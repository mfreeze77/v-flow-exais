// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Player } from "./Player";

vi.mock("@hyperframes/player", () => ({}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null;
let connected: LoadFixture[] = [];
let warm = false;

/** Controlled lifecycle delivery; the independent Chromium fixture tests real load dispatch. */
class LoadFixture extends HTMLElement {
  readonly iframeElement = document.createElement("iframe");
  previewDocument = document.implementation.createHTMLDocument();
  constructor() {
    super();
    Object.defineProperty(this.iframeElement, "contentDocument", {
      configurable: true,
      get: () => this.previewDocument,
    });
    Object.defineProperty(this.previewDocument, "URL", {
      value: "about:blank",
      configurable: true,
    });
  }
  connectedCallback() {
    connected.push(this);
    // Mirrors the ordering observed in Chromium: inner blank load before the
    // custom element assigns src, with Studio's listener already installed.
    this.iframeElement.dispatchEvent(new Event("load"));
    this.iframeElement.setAttribute("src", this.getAttribute("src") ?? "/preview");
    if (warm) this.deliver("http://localhost/preview");
  }
  deliver(url: string) {
    Object.defineProperty(this.previewDocument, "URL", { value: url, configurable: true });
    this.iframeElement.dispatchEvent(new Event("load"));
    this.dispatchEvent(new Event("ready"));
  }
}
if (!customElements.get("hyperframes-player"))
  customElements.define("hyperframes-player", LoadFixture);

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  connected = [];
  warm = false;
  document.body.innerHTML = "";
});
async function mount(onLoad: (frame: HTMLIFrameElement) => void) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const ref = createRef<HTMLIFrameElement>();
  await act(async () => {
    root?.render(
      createElement(Player, { ref, directUrl: "/preview", onLoad, suppressLoadingOverlay: true }),
    );
  });
  expect(connected).toHaveLength(1);
  return { fixture: connected[0]!, ref };
}

describe("preview load notification", () => {
  it("does not send a bootstrap document to the owner", async () => {
    const onLoad = vi.fn();
    await mount(onLoad);
    expect(onLoad).not.toHaveBeenCalled();
  });
  it("delivers the actual requested load with its emitting iframe", async () => {
    const onLoad = vi.fn();
    const { fixture, ref } = await mount(onLoad);
    await act(async () => fixture.deliver("http://localhost/preview"));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(fixture.iframeElement);
    expect(ref.current).toBe(fixture.iframeElement);
  });
  it("observes a warm requested load during connection without waiting or polling", async () => {
    warm = true;
    const onLoad = vi.fn();
    const { fixture } = await mount(onLoad);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(fixture.iframeElement);
  });
  it("uses the latest committed callback without remounting or navigating", async () => {
    const first = vi.fn(),
      second = vi.fn();
    const { fixture, ref } = await mount(first);
    await act(async () => {
      root?.render(
        createElement(Player, {
          ref,
          directUrl: "/preview",
          onLoad: second,
          suppressLoadingOverlay: true,
        }),
      );
    });
    expect(connected).toHaveLength(1);
    await act(async () => fixture.deliver("http://localhost/preview"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(fixture.iframeElement);
  });
  it("does not hide an assigned empty/error document from the owner", async () => {
    const onLoad = vi.fn();
    const { fixture } = await mount(onLoad);
    await act(async () => fixture.deliver("about:blank"));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(fixture.iframeElement);
  });
  it("removes the listener on unmount", async () => {
    const onLoad = vi.fn();
    const { fixture } = await mount(onLoad);
    act(() => root?.unmount());
    root = null;
    fixture.deliver("http://localhost/preview");
    expect(onLoad).not.toHaveBeenCalled();
  });
});
