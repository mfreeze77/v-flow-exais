import type {
  EditorProjectView,
  EditorPreviewSession,
  EditorDocumentContent,
} from "@hyperframes/project-model";
import type { JournalHistoryState } from "./journalHistoryTypes";

export function managedStudioFixture() {
  const ref = { projectId: "project-test", revision: 4, revisionHash: "a".repeat(64) };
  const view: EditorProjectView = {
    ...ref,
    schemaVersion: 1,
    title: "Mixed project",
    assets: [],
    documents: [
      {
        documentId: "title",
        path: "title.html",
        kind: "native",
        contentHash: "c".repeat(64),
        sceneInstanceIds: ["title-scene"],
      },
      {
        documentId: "diagram",
        path: "source.architecture.json",
        kind: "architecture",
        contentHash: "d".repeat(64),
        sceneInstanceIds: ["diagram-scene"],
      },
    ],
    scenes: [
      { id: "title-scene", kind: "native", documentId: "title", startFrame: 0, durationFrames: 75 },
      {
        id: "diagram-scene",
        kind: "diagram",
        documentId: "diagram",
        startFrame: 75,
        durationFrames: 240,
      },
    ],
    history: { owner: "project-journal", canUndo: true, canRedo: false },
    unresolvedConflictCount: 0,
    writeOwner: "project-command",
    generatedOutputEditable: false,
  };
  const preview: EditorPreviewSession = {
    ...ref,
    schemaVersion: 1,
    buildHash: "b".repeat(64),
    authoringHash: "e".repeat(64),
    durationFrames: 315,
    output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
    generatedOutputEditable: false,
    historyOwner: "project-journal",
    scenes: view.scenes.map((s, i) => ({
      sceneId: s.id,
      documentId: s.documentId,
      kind: s.kind,
      documentKind: view.documents[i]!.kind,
      sourcePath: view.documents[i]!.path,
      startFrame: s.startFrame,
      durationFrames: s.durationFrames,
      hostId: `el-${i}`,
      hostKey: `index.html#el-${i}`,
      hostCompositionId: `slot-${i}`,
      renderId: `scene-${i}-${s.id}`,
      outputPath: `scene-${i}-${s.id}.html`,
      editOwner: s.kind === "native" ? "native-document" : "diagram-command",
    })),
  };
  const status: JournalHistoryState = {
    owner: "project-journal",
    projectId: ref.projectId,
    revision: 4,
    loaded: true,
    busy: false,
    uncertain: false,
    pendingCommandId: null,
    canUndo: true,
    canRedo: false,
    error: null,
    refreshError: null,
    commitSequence: 0,
  };
  const native: EditorDocumentContent = {
    ...ref,
    documentId: "title",
    kind: "native",
    path: "title.html",
    contentHash: "c".repeat(64),
    content: '<!doctype html>\r\n<h1 data-hf-id="hf-title">Original</h1>',
  };
  const diagram: EditorDocumentContent = {
    ...ref,
    documentId: "diagram",
    kind: "architecture",
    path: "source.architecture.json",
    contentHash: "d".repeat(64),
    content: JSON.stringify({
      diagram_type: "architecture",
      components: [
        { id: "gateway", label: "Gateway" },
        { id: "api", label: "API" },
      ],
      connections: [{ id: "edge-a", from: "gateway", to: "api" }],
    }),
  };
  return { view, preview, status, native, diagram };
}
