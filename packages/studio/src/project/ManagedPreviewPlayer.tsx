import { createElement, useRef } from "react";
import "@hyperframes/player";
import {
  previewSecondsFromFrame,
  type ManagedNavigationState,
  type ManagedPreviewNavigation,
} from "./managedPreviewNavigation";
import { useMountEffect } from "../hooks/useMountEffect";
import { CompositionBreadcrumb } from "../components/nle/CompositionBreadcrumb";

type Player = HTMLElement & { currentTime: number; duration: number; seek(time: number): void };

/** Same retained player and breadcrumb as the NLE; navigation owns no clock. */
export function ManagedPreviewPlayer({
  state,
  navigation,
  onError,
}: {
  state: ManagedNavigationState;
  navigation: ManagedPreviewNavigation;
  onError: (error: Error) => void;
}) {
  const player = useRef<Player | null>(null);
  useMountEffect(() => {
    const element = player.current;
    const session = state.session,
      token = state.token;
    if (!element || !session || !token) return;
    let active = true;
    const observe = () => {
      if (!active) return;
      try {
        navigation.observe(element.currentTime, token);
      } catch (error) {
        // Navigation may already have changed while this element is unmounting.
        if ((error as { code?: string }).code !== "editor/stale-navigation")
          onError(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const ready = () => {
      if (!active || !Number.isFinite(element.duration) || element.duration <= 0) return;
      // Use the latest desired frame: a user may seek while this player loads.
      const current = navigation.snapshot();
      if (current.token?.generation !== token.generation) return;
      const frameSeconds = previewSecondsFromFrame(session, 1);
      element.seek(
        Math.max(
          0,
          Math.min(
            previewSecondsFromFrame(session, current.frame),
            element.duration - frameSeconds,
          ),
        ),
      );
    };
    element.addEventListener("timeupdate", observe);
    element.addEventListener("ready", ready);
    return () => {
      active = false;
      element.removeEventListener("timeupdate", observe);
      element.removeEventListener("ready", ready);
    };
  });
  if (!state.session || !state.token) return null;
  const back = () => {
    try {
      navigation.master(state.token!);
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  };
  return (
    <section
      aria-label="Pinned composition preview"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !state.scene) return;
        const target = event.target as HTMLElement;
        if (target.closest("input,textarea,select,[contenteditable=true]")) return;
        event.preventDefault();
        back();
      }}
    >
      <CompositionBreadcrumb
        stack={state.levels.map((level) => ({ ...level }))}
        onNavigate={(index) => {
          if (index === 0) back();
        }}
      />
      {state.notice && <p role="status">{state.notice}</p>}
      <p className="vf-muted">
        {state.scene ? `Scene-local playback · ${state.scene.sceneId}` : "Master playback"}
        {" · revision "}
        {state.session.revision}
        {state.scene?.editOwner === "diagram-command" &&
          " · diagram edits remain semantic commands"}
      </p>
      {createElement("hyperframes-player", {
        ref: player,
        src: state.levels.at(-1)!.previewUrl,
        "runtime-src": "/api/runtime.js",
        controls: "",
        width: state.session.output.width,
        height: state.session.output.height,
        style: {
          width: "100%",
          aspectRatio: `${state.session.output.width}/${state.session.output.height}`,
          display: "block",
        },
      })}
    </section>
  );
}
