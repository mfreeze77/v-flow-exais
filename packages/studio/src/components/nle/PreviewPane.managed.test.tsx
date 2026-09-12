// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NLEProvider } from "./NLEContext";
import { PreviewPane } from "./PreviewPane";
import { navigationFixture } from "../../project/managedPreviewNavigation.fixture";
import { installReactActEnvironment } from "../../hooks/domSelectionTestHarness";

// Verify the actual pane hands the correct URL to its player wrapper. Playback
// and layout are intentionally not substituted for a browser acceptance run.
vi.mock("./NLEPreview", () => ({
  NLEPreview: (props: { directUrl?: string }) => (
    <output data-preview-url={props.directUrl ?? "native-default"} />
  ),
}));
vi.mock("./AssetPreviewOverlay", () => ({ AssetPreviewOverlay: () => null }));
vi.mock("../../player", async (original) => ({
  ...(await original<object>()),
  PlayerControls: () => null,
}));
installReactActEnvironment();
const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
async function mount(mode: "waiting" | "managed" | "native") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ content: "" }) })),
  );
  await act(async () =>
    root.render(
      <NLEProvider
        projectId="nav-project"
        managedNavigation={
          mode === "native"
            ? undefined
            : { session: mode === "waiting" ? null : navigationFixture() }
        }
      >
        <PreviewPane />
      </NLEProvider>,
    ),
  );
  return host;
}
describe("managed NLE master URL", () => {
  it("does not mount the native player while waiting for a managed build", async () => {
    const host = await mount("waiting");
    expect(host.querySelector("output")).toBeNull();
    expect(host.textContent).toContain("Preparing managed preview");
  });
  it("passes the pinned URL even at the master level", async () => {
    const host = await mount("managed");
    expect(host.querySelector("output")?.getAttribute("data-preview-url")).toContain(
      "/editor/previews/",
    );
  });
  it("leaves native master routing at its original default", async () => {
    const host = await mount("native");
    expect(host.querySelector("output")?.getAttribute("data-preview-url")).toBe("native-default");
  });
});
