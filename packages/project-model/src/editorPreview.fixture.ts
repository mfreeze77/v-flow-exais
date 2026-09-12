import type { ProjectSnapshot } from "./project";
import type { EditorProjectView } from "./editorRead";
import { compileSceneBindings, type EditorPreviewSession } from "./editorPreview";

export function editorPreviewFixture() {
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      id: "preview-test",
      title: "Mixed",
      revision: 3,
      documents: [
        { id: "title", kind: "native", path: "title.html", authoritative: true },
        { id: "diagram", kind: "architecture", path: "architecture.json", authoritative: true },
      ],
      scenes: [
        {
          id: "opening",
          kind: "native",
          documentId: "title",
          startFrame: 0,
          durationFrames: 75,
          presentation: { title: "Opening", focusObjectIds: [], relationshipIds: [] },
        },
        {
          id: "system.one",
          kind: "diagram",
          documentId: "diagram",
          startFrame: 75,
          durationFrames: 180,
          presentation: { title: "System", focusObjectIds: [], relationshipIds: [] },
        },
        {
          id: "system:two",
          kind: "diagram",
          documentId: "diagram",
          startFrame: 255,
          durationFrames: 180,
          presentation: { title: "System again", focusObjectIds: [], relationshipIds: [] },
        },
      ],
      output: { width: 1280, height: 720, fps: { numerator: 30000, denominator: 1001 } },
      policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
    },
    sources: {
      title: "<div data-composition-id='title'>Title</div>",
      diagram: {
        schema_version: 1,
        diagram_type: "architecture",
        meta: { title: "Diagram" },
        components: [],
        connections: [],
        cards: [],
      },
    },
  };
  const session: EditorPreviewSession = {
    schemaVersion: 1,
    projectId: snapshot.manifest.id,
    revision: 3,
    revisionHash: "a".repeat(64),
    buildHash: "b".repeat(64),
    authoringHash: "c".repeat(64),
    output: structuredClone(snapshot.manifest.output),
    durationFrames: 435,
    scenes: compileSceneBindings(snapshot),
    generatedOutputEditable: false,
    historyOwner: "project-journal",
  };
  const view: EditorProjectView = {
    schemaVersion: 1,
    projectId: session.projectId,
    revision: 3,
    revisionHash: session.revisionHash,
    title: "Mixed",
    documents: snapshot.manifest.documents.map((doc) => ({
      documentId: doc.id,
      path: doc.path,
      kind: doc.kind,
      contentHash: "d".repeat(64),
      sceneInstanceIds: snapshot.manifest.scenes
        .filter((s) => s.documentId === doc.id)
        .map((s) => s.id),
    })),
    assets: [],
    scenes: snapshot.manifest.scenes.map(
      ({ id, documentId, kind, startFrame, durationFrames }) => ({
        id,
        documentId,
        kind,
        startFrame,
        durationFrames,
      }),
    ),
    history: { owner: "project-journal", canUndo: true, canRedo: false },
    unresolvedConflictCount: 0,
    writeOwner: "project-command",
    generatedOutputEditable: false,
  };
  return { snapshot, session, view };
}
