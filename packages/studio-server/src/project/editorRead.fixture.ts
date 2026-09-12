import type { EditorCommittedInput } from "./editorProjection";

export function editorFixture(): EditorCommittedInput {
  return {
    pointer: { revision: 4, sha256: "a".repeat(64) },
    index: { history: { undo: [{}], redo: [] } },
    snapshot: {
      manifest: {
        schemaVersion: 1,
        id: "editor-test",
        revision: 4,
        title: "Mixed authoring",
        documents: [
          { id: "title", path: "title.html", kind: "native", authoritative: true },
          {
            id: "system",
            path: "system.architecture.json",
            kind: "architecture",
            authoritative: true,
          },
        ],
        scenes: [
          {
            id: "intro",
            documentId: "title",
            kind: "native",
            startFrame: 0,
            durationFrames: 75,
            presentation: { title: "Introduction", focusObjectIds: [], relationshipIds: [] },
          },
          {
            id: "first",
            documentId: "system",
            kind: "diagram",
            startFrame: 75,
            durationFrames: 180,
            presentation: { title: "Request", focusObjectIds: [], relationshipIds: [] },
          },
          {
            id: "second",
            documentId: "system",
            kind: "diagram",
            startFrame: 255,
            durationFrames: 180,
            presentation: { title: "State", focusObjectIds: [], relationshipIds: [] },
          },
        ],
        output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
        policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
      },
      sources: Object.assign(Object.create(null), {
        title: "<!doctype html>\r\n<h1>Keep  my spacing</h1>\r\n",
        system: {
          diagram_type: "architecture",
          components: [{ id: "gateway", label: "Gateway" }],
          connections: [],
        },
      }),
    },
  };
}
