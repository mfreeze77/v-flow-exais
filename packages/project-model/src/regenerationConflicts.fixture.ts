import type { ProjectSnapshot } from "./project";

export function conflictProjectFixture(): ProjectSnapshot {
  return {
    manifest: {
      schemaVersion: 1,
      id: "conflict-test",
      title: "Conflict persistence",
      revision: 0,
      documents: [
        { id: "diagram", kind: "architecture", path: "diagram.json", authoritative: true },
      ],
      scenes: [
        {
          id: "first",
          kind: "diagram",
          documentId: "diagram",
          startFrame: 0,
          durationFrames: 180,
          presentation: {
            title: "Branches",
            focusObjectIds: ["gateway", "api_b"],
            relationshipIds: ["edge-a", "edge-b"],
          },
        },
      ],
      output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
      policy: { htmlTrust: "trusted-local", sourceSharing: "private" },
    },
    sources: {
      diagram: {
        schema_version: 1,
        diagram_type: "architecture",
        meta: { title: "Branches", viewBox: [900, 570], legend: { mode: "hidden" } },
        components: [
          { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
          { id: "api_a", type: "backend", label: "API A", pos: [320, 40], size: [180, 70] },
          { id: "api_b", type: "backend", label: "API B", pos: [320, 160], size: [180, 70] },
        ],
        connections: [
          { id: "edge-a", from: "gateway", to: "api_a" },
          { id: "edge-b", from: "gateway", to: "api_b" },
        ],
        cards: [],
      },
    },
  };
}
