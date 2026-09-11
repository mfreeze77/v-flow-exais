import type { ProjectCommand } from "./commands";
import type { ProjectSnapshot } from "./project";

export function projectFixture(): ProjectSnapshot {
  return {
    manifest: {
      schemaVersion: 1,
      id: "project-test",
      title: "Source-grounded project",
      revision: 0,
      documents: [
        {
          id: "diagram-one",
          kind: "architecture",
          path: "diagrams/architecture.json",
          authoritative: true,
        },
      ],
      scenes: [
        {
          id: "scene-one",
          kind: "diagram",
          documentId: "diagram-one",
          startFrame: 0,
          durationFrames: 180,
          presentation: {
            title: "Authored branches",
            focusObjectIds: ["gateway", "api_a", "api_b"],
            relationshipIds: ["edge-a", "edge-b"],
          },
        },
      ],
      output: { width: 1280, height: 720, fps: { numerator: 30000, denominator: 1001 } },
      policy: { sourceSharing: "private", htmlTrust: "blocked" },
    },
    sources: {
      "diagram-one": {
        schema_version: 1,
        diagram_type: "architecture",
        meta: { title: "Authored branches" },
        components: [
          { id: "gateway", label: "Gateway" },
          { id: "api_a", label: "API A" },
          { id: "api_b", label: "API B" },
        ],
        connections: [
          { id: "edge-a", from: "gateway", to: "api_a" },
          { id: "edge-b", from: "gateway", to: "api_b" },
        ],
      },
    },
  };
}

export function renameCommand(id = "rename-one", expectedRevision = 0): ProjectCommand {
  return {
    commandId: id,
    origin: "ui",
    projectId: "project-test",
    expectedRevision,
    operations: [
      { type: "rename-object", documentId: "diagram-one", objectId: "api_a", label: "Orders API" },
    ],
  };
}
