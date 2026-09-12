// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installReactActEnvironment } from "../../hooks/domSelectionTestHarness";
import { NLEProvider, useNLEContext, type NLEContextValue } from "./NLEContext";
import {
  navigationFixture,
  laterNavigationFixture,
} from "../../project/managedPreviewNavigation.fixture";
import type { EditorPreviewSession } from "@hyperframes/project-model";

installReactActEnvironment();
const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
async function mount(session: EditorPreviewSession | null) {
  const fetcher = vi.fn(() => Promise.reject(new Error("unexpected native request")));
  vi.stubGlobal("fetch", fetcher);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  let context!: NLEContextValue;
  const maps: Map<string, string>[] = [],
    onError = vi.fn();
  function Probe() {
    context = useNLEContext();
    return null;
  }
  function View(props: { session: EditorPreviewSession | null }) {
    return (
      <NLEProvider
        projectId="nav-project"
        managedNavigation={{ session: props.session, onError }}
        onCompIdToSrcChange={(m) => maps.push(new Map(m))}
      >
        <Probe />
      </NLEProvider>
    );
  }
  await act(async () => {
    root.render(<View session={session} />);
  });
  return {
    root,
    View,
    fetcher,
    maps,
    onError,
    get context() {
      return context;
    },
  };
}
describe("NLE managed wiring", () => {
  it("does not fetch native index.html while a managed session is waiting", async () => {
    const h = await mount(null);
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.context.timelineDisabled).toBe(true);
  });
  it("publishes compiler bindings rather than fetching native source maps", async () => {
    const h = await mount(navigationFixture());
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.maps.at(-1)?.get("slot-2")).toBe("title.html");
    expect(h.maps.at(-1)?.has("slot-1")).toBe(false);
  });
  it("rejects a drill-down without a matching displayed preview", async () => {
    const h = await mount(navigationFixture());
    await act(async () =>
      h.context.handleDrillDown({ id: "slot-2", compositionSrc: "title.html" } as never),
    );
    expect(h.context.compositionStack).toHaveLength(1);
    expect(h.onError).toHaveBeenCalled();
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("does not retain a legacy map when a later pinned build is published", async () => {
    const h = await mount(navigationFixture());
    await act(async () => h.root.render(<h.View session={laterNavigationFixture()} />));
    expect(h.context.compositionStack[0]!.previewUrl).toContain("e".repeat(64));
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.context.timelineDisabled).toBe(true);
  });
});
