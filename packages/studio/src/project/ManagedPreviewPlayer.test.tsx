// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installReactActEnvironment } from "../hooks/domSelectionTestHarness";
import { navigationFixture } from "./managedPreviewNavigation.fixture";
import {
  createManagedPreviewNavigation,
  previewSecondsFromFrame,
} from "./managedPreviewNavigation";
import { ManagedPreviewPlayer } from "./ManagedPreviewPlayer";

// This is the React/custom-element event contract, NOT real player playback.
vi.mock("@hyperframes/player", () => ({}));
installReactActEnvironment();
const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
});
async function mount(scene = false) {
  const session = navigationFixture(),
    navigation = createManagedPreviewNavigation(session.projectId);
  navigation.publish(session);
  if (scene) navigation.open({ sceneId: "flow" }, navigation.snapshot().token!);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const onError = vi.fn();
  await act(async () =>
    root.render(
      <ManagedPreviewPlayer
        state={navigation.snapshot()}
        navigation={navigation}
        onError={onError}
      />,
    ),
  );
  const player = host.querySelector("hyperframes-player") as HTMLElement & {
    currentTime: number;
    duration: number;
    seek: (t: number) => void;
  };
  Object.defineProperties(player, {
    currentTime: { value: 0, writable: true, configurable: true },
    duration: { value: 10, writable: true, configurable: true },
    seek: { value: vi.fn(), configurable: true },
  });
  return { host, root, player, navigation, session, onError };
}
describe("managed player event lifecycle", () => {
  it("uses the pinned master URL and exactly one player", async () => {
    const h = await mount();
    expect(h.host.querySelectorAll("hyperframes-player")).toHaveLength(1);
    expect(h.player.getAttribute("src")).toContain(`/editor/previews/${h.session.buildHash}/view`);
  });
  it("opens the inline standalone view with the retained breadcrumb", async () => {
    const h = await mount(true);
    expect(h.player.getAttribute("src")).toContain("sceneId=flow");
    expect(h.host.querySelector('[aria-label="Composition navigation"]')).not.toBeNull();
  });
  it("ready uses the latest desired frame including a seek made during load", async () => {
    const h = await mount();
    h.navigation.seekMaster(previewSecondsFromFrame(h.session, 45), h.navigation.snapshot().token!);
    act(() => h.player.dispatchEvent(new Event("ready")));
    expect(h.player.seek).toHaveBeenCalledWith(previewSecondsFromFrame(h.session, 45));
  });
  it("records current time without creating another clock", async () => {
    const h = await mount(true);
    h.player.currentTime = previewSecondsFromFrame(h.session, 25);
    act(() => h.player.dispatchEvent(new Event("timeupdate")));
    expect(h.navigation.snapshot().frame).toBe(25);
  });
  it("ignores outgoing-player time events after navigation changed", async () => {
    const h = await mount();
    h.navigation.open({ sceneId: "flow" }, h.navigation.snapshot().token!);
    h.player.currentTime = 5;
    act(() => h.player.dispatchEvent(new Event("timeupdate")));
    expect(h.navigation.snapshot().frame).toBe(0);
    expect(h.onError).not.toHaveBeenCalled();
  });
  it("removes listeners on unmount", async () => {
    const h = await mount();
    act(() => h.root.unmount());
    roots.splice(roots.indexOf(h.root), 1);
    h.player.currentTime = 2;
    h.player.dispatchEvent(new Event("timeupdate"));
    expect(h.navigation.snapshot().frame).toBe(0);
  });
  it("breadcrumb return preserves the master position", async () => {
    const h = await mount(true);
    act(() =>
      (
        h.host.querySelector('[aria-label="Back to parent composition"]') as HTMLButtonElement
      ).click(),
    );
    expect(h.navigation.snapshot().scene).toBeNull();
    expect(h.navigation.snapshot().frame).toBe(0);
  });
});
