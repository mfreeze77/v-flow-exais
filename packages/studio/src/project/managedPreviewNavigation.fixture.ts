import {
  compileSceneBindings,
  type EditorPreviewSession,
  type ProjectSnapshot,
} from "@hyperframes/project-model";

/** No handcrafted generated addresses: fixtures use the real emission contract. */
export function navigationFixture(): EditorPreviewSession {
  const snapshot = {
    manifest: {
      id: "nav-project",
      documents: [
        { id: "title", kind: "native", path: "title.html", authoritative: true },
        {
          id: "diagram",
          kind: "architecture",
          path: "system.architecture.json",
          authoritative: true,
        },
      ],
      scenes: [
        { id: "intro", documentId: "title", kind: "native", startFrame: 0, durationFrames: 75 },
        { id: "flow", documentId: "diagram", kind: "diagram", startFrame: 75, durationFrames: 180 },
        { id: "outro", documentId: "title", kind: "native", startFrame: 255, durationFrames: 75 },
      ],
    },
  } as unknown as ProjectSnapshot;
  return {
    schemaVersion: 1,
    projectId: "nav-project",
    revision: 4,
    revisionHash: "a".repeat(64),
    buildHash: "b".repeat(64),
    authoringHash: "c".repeat(64),
    output: { width: 1280, height: 720, fps: { numerator: 30000, denominator: 1001 } },
    durationFrames: 330,
    scenes: compileSceneBindings(snapshot),
    generatedOutputEditable: false,
    historyOwner: "project-journal",
  };
}

export function laterNavigationFixture() {
  const next = navigationFixture();
  next.revision++;
  next.revisionHash = "d".repeat(64);
  next.buildHash = "e".repeat(64);
  next.authoringHash = "f".repeat(64);
  return next;
}
