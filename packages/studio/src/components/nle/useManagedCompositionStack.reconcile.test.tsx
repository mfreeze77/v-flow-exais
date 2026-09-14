// @vitest-environment happy-dom
import { act, createElement, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sceneEmissionAddress, type EditorPreviewSession } from "@hyperframes/project-model";
import { useManagedCompositionStack } from "./useManagedCompositionStack";
import {
  navigationFixture,
  laterNavigationFixture,
} from "../../project/managedPreviewNavigation.fixture";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const h = vi.hoisted(() => ({
  error: vi.fn(),
  announced: vi.fn(),
  state: {
    currentTime: 0,
    setElements: vi.fn(),
    setTimelineReady: vi.fn(),
    clearSeekRequest: vi.fn(),
    setSelectedElementId: vi.fn(),
    setCurrentTime: vi.fn(),
  },
}));
vi.mock("../../player", () => ({ usePlayerStore: { getState: () => h.state } }));
let current: ReturnType<typeof useManagedCompositionStack>;
let changePath: (path: string | null) => void;
let root: Root | null = null;
function Probe({ session }: { session: EditorPreviewSession }) {
  const [path, setPath] = useState<string | null>(null);
  changePath = setPath;
  const announce = useCallback(
    (scene: string | null, source: string | null) => h.announced(scene, source),
    [],
  );
  current = useManagedCompositionStack({
    projectId: session.projectId,
    activeCompositionPath: path,
    onCompositionChange: setPath,
    managedNavigation: { session, onSceneChange: announce, onError: h.error },
  });
  return createElement("output", { "data-testid": "source-path" }, path ?? "master");
}
async function render(session = navigationFixture()) {
  if (!root) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => root?.render(createElement(Probe, { session })));
}
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("the inspector follows actual identity-based scene reconciliation", () => {
  it("announces the first committed master once, not before the session exists", async () => {
    await render();
    expect(h.announced).toHaveBeenCalledExactlyOnceWith(null, null);
  });
  it("announces external path navigation, not only timeline clicks", async () => {
    await render();
    h.announced.mockClear();
    await act(async () => changePath("system.architecture.json"));
    expect(current.managedState.scene?.sceneId).toBe("flow");
    expect(h.announced).toHaveBeenCalledExactlyOnceWith("flow", "system.architecture.json");
  });
  it("accepts the emitted scoped timeline key without a path guess", async () => {
    const session = navigationFixture();
    await render(session);
    h.announced.mockClear();
    await act(async () => current.handleDrillDown({ id: session.scenes[0]!.hostKey }));
    expect(current.managedState.scene?.sceneId).toBe("intro");
    expect(h.announced).toHaveBeenCalledExactlyOnceWith("intro", "title.html");
  });
  it("does not duplicate an announcement when the parent echoes its source path", async () => {
    const session = navigationFixture();
    await render(session);
    h.announced.mockClear();
    await act(async () => current.handleDrillDown({ id: session.scenes[0]!.hostKey }));
    await render(structuredClone(session));
    expect(h.announced).toHaveBeenCalledTimes(1);
  });
  it("reports an ambiguous path and retains the actual master", async () => {
    await render();
    await act(async () => changePath("title.html"));
    expect(h.error).toHaveBeenCalledTimes(1);
    expect(current.managedState.scene).toBeNull();
    expect(document.querySelector("output")?.textContent).toBe("master");
  });
  it("notifies the inspector after a new build removes its selected scene", async () => {
    const session = navigationFixture();
    await render(session);
    await act(async () => current.handleDrillDown({ id: session.scenes[0]!.hostKey }));
    h.announced.mockClear();
    const next = laterNavigationFixture();
    next.scenes = next.scenes
      .filter((scene) => scene.sceneId !== "intro")
      .map((scene, index) => ({
        ...scene,
        ...sceneEmissionAddress(scene.sceneId, index),
      }));
    await render(next);
    // Outro still uses title.html: a stale parent echo must NOT select it.
    expect(current.managedState.scene).toBeNull();
    expect(current.managedState.notice).toMatch(/removed/);
    expect(h.announced).toHaveBeenCalledExactlyOnceWith(null, null);
    expect(document.querySelector("output")?.textContent).toBe("master");
  });
  it("retains a compatible repeated appearance through rebuild", async () => {
    const session = navigationFixture();
    await render(session);
    await act(async () => current.handleDrillDown({ id: session.scenes[2]!.hostKey }));
    h.announced.mockClear();
    await render(laterNavigationFixture());
    expect(current.managedState.scene?.sceneId).toBe("outro");
    expect(h.announced).toHaveBeenCalledExactlyOnceWith("outro", "title.html");
  });
  it("returns to master and reports its actual authoring selection", async () => {
    const session = navigationFixture();
    await render(session);
    await act(async () => current.handleDrillDown({ id: session.scenes[0]!.hostKey }));
    h.announced.mockClear();
    await act(async () => current.handleNavigateComposition(0));
    expect(current.managedState.scene).toBeNull();
    expect(h.announced).toHaveBeenCalledExactlyOnceWith(null, null);
  });
});
