/**
 * AFM-059/060: playback navigation, not another authoring/history owner.
 * Both the managed workspace and retained NLE use this state machine. A scene
 * appearance is selected by stable identity, never by generated filename order.
 */
import {
  assertEditorPreviewSession,
  editorPreviewUrl,
  EditorPreviewError,
  resolvePreviewScene,
  sceneLocalFrame,
  type CompiledSceneBinding,
  type EditorPreviewSession,
} from "@hyperframes/project-model";

export interface ManagedPreviewToken {
  projectId: string;
  buildHash: string;
  revisionHash: string;
  /** Distinguishes two visits to the same URL and late events from the first. */
  generation: number;
}
export type ManagedSceneTarget = Parameters<typeof resolvePreviewScene>[1];
export interface ManagedCompositionLevel {
  id: string;
  label: string;
  previewUrl: string;
}
export interface ManagedNavigationState {
  session: EditorPreviewSession | null;
  scene: CompiledSceneBinding | null;
  levels: readonly ManagedCompositionLevel[];
  token: ManagedPreviewToken | null;
  viewKey: string;
  /** Current playhead in this view, and the master position to return to. */
  frame: number;
  returnFrame: number;
  notice: string | null;
}

function reject(code: string, message: string): never {
  throw new EditorPreviewError(`editor/${code}`, message, 409);
}
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const left = Object.keys(a),
    right = Object.keys(b);
  return (
    left.length === right.length &&
    left.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
function clampFrame(frame: number, length: number): number {
  if (!Number.isSafeInteger(frame) || frame < 0) reject("invalid-navigation", "Invalid frame.");
  return Math.min(length - 1, frame);
}
export function previewFrameFromSeconds(session: EditorPreviewSession, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0)
    reject("invalid-navigation", "Playback time must be finite and nonnegative.");
  const fps = session.output.fps;
  const frame = Math.round((seconds * fps.numerator) / fps.denominator);
  if (!Number.isSafeInteger(frame)) reject("invalid-navigation", "Playback time is out of range.");
  return frame;
}
export function previewSecondsFromFrame(session: EditorPreviewSession, frame: number): number {
  if (!Number.isSafeInteger(frame) || frame < 0) reject("invalid-navigation", "Invalid frame.");
  return (frame * session.output.fps.denominator) / session.output.fps.numerator;
}
export function managedMasterTime(state: ManagedNavigationState): number {
  if (!state.session) return 0;
  return previewSecondsFromFrame(state.session, (state.scene?.startFrame ?? 0) + state.frame);
}

/** Only native authoring can enter the inherited DOM source-resolution map. */
export function managedNativeSourceMap(session: EditorPreviewSession): Map<string, string> {
  assertEditorPreviewSession(session);
  const result = new Map<string, string>();
  for (const scene of session.scenes) {
    if (scene.editOwner !== "native-document") continue;
    for (const key of [scene.renderId, scene.hostId, scene.hostCompositionId, scene.outputPath])
      result.set(key, scene.sourcePath);
  }
  return result;
}

/** Root attributes are stamped by decorateEditorPreview, not inferred from el-0. */
export function assertDisplayedPreview(
  root: Pick<Element, "getAttribute"> | null,
  token: ManagedPreviewToken,
): void {
  if (
    !root ||
    root.getAttribute("data-vflow-project-id") !== token.projectId ||
    root.getAttribute("data-vflow-build-hash") !== token.buildHash ||
    root.getAttribute("data-vflow-revision-hash") !== token.revisionHash
  )
    reject("stale-navigation", "The displayed preview does not match this navigation request.");
}

/** Cache-busting parameters may vary; scene/build address may not. */
export function assertDisplayedManagedView(
  root: Pick<Element, "getAttribute"> | null,
  token: ManagedPreviewToken,
  actualUrl: string,
  expectedPath: string,
): void {
  assertDisplayedPreview(root, token);
  let matches = false;
  try {
    const actual = new URL(actualUrl, "http://vflow.invalid");
    const expected = new URL(expectedPath, actual.origin);
    matches =
      actual.pathname === expected.pathname &&
      actual.searchParams.get("sceneId") === expected.searchParams.get("sceneId");
  } catch {
    /* Not a managed preview URL. */
  }
  if (!matches) reject("stale-navigation", "The displayed composition is not the selected view.");
}

export function createManagedPreviewNavigation(projectId: string) {
  // Construction may happen during render. Validate external data at publication,
  // not by throwing before a component can show an error.
  let state: ManagedNavigationState = freeze({
    session: null,
    scene: null,
    levels: [],
    token: null,
    viewKey: "waiting",
    frame: 0,
    returnFrame: 0,
    notice: null,
  });
  let generation = 0;
  const listeners = new Set<() => void>();
  function emit(next: ManagedNavigationState): void {
    state = freeze(next);
    for (const listener of [...listeners]) listener();
  }
  function checked(token: ManagedPreviewToken): EditorPreviewSession {
    if (
      !state.session ||
      !state.token ||
      !token ||
      token.projectId !== state.token.projectId ||
      token.buildHash !== state.token.buildHash ||
      token.revisionHash !== state.token.revisionHash ||
      token.generation !== state.token.generation
    )
      reject("stale-navigation", "Navigation belongs to an obsolete preview. Select again.");
    return state.session;
  }
  function view(
    session: EditorPreviewSession,
    scene: CompiledSceneBinding | null,
    frame: number,
    returnFrame: number,
    notice: string | null = null,
  ): void {
    const token = {
      projectId,
      buildHash: session.buildHash,
      revisionHash: session.revisionHash,
      generation: ++generation,
    };
    const levels: ManagedCompositionLevel[] = [
      { id: "master", label: "Master", previewUrl: editorPreviewUrl(session) },
    ];
    if (scene)
      levels.push({
        // This is a navigation key, not a filename and not a semantic object id.
        id: `managed-scene:${scene.sceneId}`,
        label: `${scene.sourcePath} · ${scene.sceneId}`,
        previewUrl: editorPreviewUrl(session, scene.sceneId),
      });
    emit({
      session,
      scene,
      levels,
      token,
      viewKey: `${session.buildHash}:${token.generation}`,
      frame: clampFrame(frame, scene?.durationFrames ?? session.durationFrames),
      returnFrame: clampFrame(returnFrame, session.durationFrames),
      notice,
    });
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(input: EditorPreviewSession): void {
      assertEditorPreviewSession(input);
      if (input.projectId !== projectId)
        reject("wrong-project", "Preview belongs to another project.");
      const previous = state.session;
      if (previous && input.revision < previous.revision)
        reject("stale-navigation", "An older preview cannot replace the accepted preview.");
      if (
        previous &&
        input.revision === previous.revision &&
        input.revisionHash !== previous.revisionHash
      )
        reject("inconsistent-preview", "One revision cannot have two index identities.");
      if (
        previous &&
        input.revision === previous.revision &&
        (input.authoringHash !== previous.authoringHash ||
          !sameData(input.output, previous.output) ||
          !sameData(input.scenes, previous.scenes))
      )
        reject(
          "inconsistent-preview",
          "One authoring revision was described with different content.",
        );
      if (previous?.buildHash === input.buildHash) {
        if (!sameData(previous, input))
          reject("inconsistent-preview", "An immutable build was described with different data.");
        return;
      }
      const session = structuredClone(input);
      let scene = state.scene
        ? (session.scenes.find((s) => s.sceneId === state.scene!.sceneId) ?? null)
        : null;
      let notice: string | null = null;
      if (
        state.scene &&
        (!scene ||
          scene.documentId !== state.scene.documentId ||
          scene.documentKind !== state.scene.documentKind)
      ) {
        scene = null;
        notice =
          "The selected scene was removed or changed document. Showing the master preview; no other scene was selected.";
      }
      view(
        session,
        scene,
        scene ? state.frame : state.scene ? state.returnFrame : state.frame,
        state.returnFrame,
        notice,
      );
    },
    open(target: ManagedSceneTarget, token: ManagedPreviewToken, currentSeconds?: number): void {
      const session = checked(token);
      const scene = resolvePreviewScene(session, target);
      if (state.scene?.sceneId === scene.sceneId) return;
      const masterFrame = state.scene
        ? state.returnFrame
        : clampFrame(
            currentSeconds === undefined
              ? state.frame
              : previewFrameFromSeconds(session, currentSeconds),
            session.durationFrames,
          );
      view(session, scene, sceneLocalFrame(scene, masterFrame), masterFrame);
    },
    master(token: ManagedPreviewToken): void {
      const session = checked(token);
      if (!state.scene) return;
      view(session, null, state.returnFrame, state.returnFrame);
    },
    seekMaster(seconds: number, token: ManagedPreviewToken): void {
      const session = checked(token);
      const frame = clampFrame(previewFrameFromSeconds(session, seconds), session.durationFrames);
      if (state.scene) view(session, null, frame, frame);
      else emit({ ...state, frame, returnFrame: frame });
    },
    /** Late timeupdate events cannot move the new view's playhead. */
    observe(seconds: number, token: ManagedPreviewToken): void {
      const session = checked(token);
      const frame = clampFrame(
        previewFrameFromSeconds(session, seconds),
        state.scene?.durationFrames ?? session.durationFrames,
      );
      if (state.frame !== frame)
        emit({ ...state, frame, returnFrame: state.scene ? state.returnFrame : frame });
    },
  };
}
export type ManagedPreviewNavigation = ReturnType<typeof createManagedPreviewNavigation>;
