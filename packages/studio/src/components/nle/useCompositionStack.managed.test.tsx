// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installReactActEnvironment } from "../../hooks/domSelectionTestHarness";
import { useCompositionStack } from "./useCompositionStack";
import { usePlayerStore } from "../../player";
import {
  navigationFixture,
  laterNavigationFixture,
} from "../../project/managedPreviewNavigation.fixture";
import type { ManagedCompositionNavigationOptions } from "./useManagedCompositionStack";
import type { EditorPreviewSession } from "@hyperframes/project-model";

installReactActEnvironment();
const mounted: Root[] = [];
afterEach(() => {
  for (const root of mounted.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function harness(
  session: EditorPreviewSession | null = navigationFixture(),
  path?: string | null,
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(root);
  const onError = vi.fn(),
    onSceneChange = vi.fn(),
    onCompositionChange = vi.fn();
  let result!: ReturnType<typeof useCompositionStack>;
  function View(props: {
    projectId?: string;
    session: EditorPreviewSession | null;
    path?: string | null;
    native?: boolean;
  }) {
    const managedNavigation: ManagedCompositionNavigationOptions | undefined = props.native
      ? undefined
      : { session: props.session, onError, onSceneChange };
    result = useCompositionStack({
      projectId: props.projectId ?? "nav-project",
      activeCompositionPath: props.path,
      onCompositionChange,
      managedNavigation,
    });
    return null;
  }
  await act(async () => {
    root.render(<View session={session} path={path} />);
  });
  return {
    get value() {
      return result;
    },
    root,
    View,
    onError,
    onSceneChange,
    onCompositionChange,
  };
}

describe("retained composition stack consumes managed identities", () => {
  it("waits on about:blank, never constructs a native managed fallback", async () => {
    const h = await harness(null);
    expect(h.value.compositionStack[0]!.previewUrl).toBe("about:blank");
    expect(h.value.managedState?.session).toBeNull();
  });
  it("publishes the pinned master through the retained stack", async () => {
    const h = await harness();
    expect(h.value.compositionStack[0]!.previewUrl).toContain("/editor/previews/");
    expect(h.value.compositionStack[0]!.previewUrl).not.toContain("/api/projects/");
  });
  it("navigates repeated appearances by render binding, not identical source paths", async () => {
    const h = await harness();
    await act(async () => h.value.handleDrillDown({ id: "slot-2", compositionSrc: "title.html" }));
    expect(h.value.managedState?.scene?.sceneId).toBe("outro");
    expect(h.onSceneChange).toHaveBeenLastCalledWith("outro", "title.html");
    expect(h.onCompositionChange).toHaveBeenLastCalledWith("title.html");
  });
  it("does not turn ambiguous source-path activation into a guessed scene", async () => {
    const h = await harness(navigationFixture(), "title.html");
    expect(h.value.compositionStack).toHaveLength(1);
    expect(h.onError).toHaveBeenCalled();
  });
  it("activates a unique source path without native index.html", async () => {
    const h = await harness(navigationFixture(), "system.architecture.json");
    expect(h.value.managedState?.scene?.sceneId).toBe("flow");
    expect(h.value.compositionStack[1]!.previewUrl).toContain("sceneId=flow");
  });
  it("returning to master restores frame zero rather than a scene-local time", async () => {
    const h = await harness();
    usePlayerStore.getState().setCurrentTime(0);
    await act(async () => h.value.handleDrillDown({ id: "slot-1" }));
    usePlayerStore.getState().setCurrentTime(2);
    await act(async () => h.value.handleNavigateComposition(0));
    expect(h.value.compositionStack).toHaveLength(1);
    expect(usePlayerStore.getState().currentTime).toBe(0);
  });
  it("rejects an arbitrary stack URL rather than entering it as authoring", async () => {
    const h = await harness();
    await act(async () =>
      h.value.updateCompositionStack([
        { id: "evil", label: "evil", previewUrl: "/api/projects/nav-project/preview" },
      ]),
    );
    expect(h.onError).toHaveBeenCalled();
    expect(h.value.compositionStack[0]!.previewUrl).toContain("/editor/previews/");
  });
  it("late old-build callbacks do not resolve a reused el-0 in the next build", async () => {
    const h = await harness();
    const oldDrill = h.value.handleDrillDown;
    await act(async () => h.root.render(<h.View session={laterNavigationFixture()} />));
    await act(async () => oldDrill({ id: "el-0" }));
    expect(h.value.compositionStack).toHaveLength(1);
    expect(h.onError).toHaveBeenCalled();
  });
  it("changing projects starts with no previous scene or authoring map", async () => {
    const h = await harness();
    await act(async () => h.value.handleDrillDown({ id: "slot-2" }));
    await act(async () => h.root.render(<h.View projectId="other-project" session={null} />));
    expect(h.value.compositionStack[0]!.previewUrl).toBe("about:blank");
    expect(h.value.compIdToSrc.size).toBe(0);
  });
  it("unmanaged native source paths retain the previous preview URL", async () => {
    const h = await harness();
    await act(async () =>
      h.root.render(<h.View native projectId="native" session={null} path="parts/one.html" />),
    );
    expect(h.value.compositionStack[1]!.previewUrl).toBe(
      "/api/projects/native/preview/comp/parts/one.html",
    );
  });
});
