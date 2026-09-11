import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { examplePath } from "@hyperframes/diagram-engine";
import {
  migrateRelationshipIds,
  type DiagramKind,
  type ProjectSnapshot,
} from "@hyperframes/project-model";
import { compileProject } from "./compiler";
import { namespaceSvg } from "./namespaceSvg";

it("isolates IDs and references for repeated scene instances without changing semantic identities", () => {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" aria-labelledby="title"><title id="title">Graph</title><defs><marker id="arrow"/></defs><path id="edge" data-node-id="semantic-id" marker-end="url(#arrow)"/></svg>';
  const a = namespaceSvg(source, "one");
  const b = namespaceSvg(source, "two");
  expect(a).toContain('aria-labelledby="one-title"');
  expect(a).toContain("url(#one-arrow)");
  expect(b).toContain("url(#two-arrow)");
  expect(a).toContain('data-node-id="semantic-id"');
  expect(b).not.toContain("one-arrow");
});
it.each([
  '<svg><g id="same"/><g id="same"/></svg>',
  '<svg><path marker-end="url(#missing)"/></svg>',
  "<svg><script>throw 1</script></svg>",
  '<svg><image href="https://example.com/track.png"/></svg>',
])("rejects ambiguous or active SVG: %s", (svg) => {
  expect(() => namespaceSvg(svg, "scene")).toThrow();
});
it.each([
  ["architecture", "web-app.architecture.json"],
  ["workflow", "agent-tool-call.workflow.json"],
  ["sequence", "cache-miss-request.sequence.json"],
  ["dataflow", "product-analytics.dataflow.json"],
  ["lifecycle", "agent-run.lifecycle.json"],
] as [DiagramKind, string][])(
  "emits two independently scoped %s scenes through the retained compiler",
  async (kind, file) => {
    const source = migrateRelationshipIds(
      JSON.parse(readFileSync(examplePath(file), "utf8")),
      kind,
    ).source;
    const snapshot: ProjectSnapshot = {
      manifest: {
        schemaVersion: 1,
        id: "motion-test",
        title: "Family integration",
        revision: 0,
        documents: [{ id: "diagram", kind, path: file, authoritative: true }],
        scenes: [0, 1].map((index) => ({
          id: `instance-${index}`,
          documentId: "diagram",
          kind: "diagram",
          startFrame: index * 180,
          durationFrames: 180,
          presentation: { title: "Repeated scene", focusObjectIds: [], relationshipIds: [] },
        })),
        output: { width: 1280, height: 720, fps: { numerator: 30000, denominator: 1001 } },
        policy: { htmlTrust: "blocked", sourceSharing: "private" },
      },
      sources: { diagram: source },
    };
    const original = JSON.stringify(snapshot);
    const build = await compileProject(snapshot);
    expect(JSON.stringify(snapshot)).toBe(original);
    expect(build.artifacts.diagram?.kind).toBe(kind);
    expect(build.files["scene-0-instance-0.html"]).toContain("scene-0-instance-0");
    expect(build.files["scene-1-instance-1.html"]).toContain("scene-1-instance-1");
    expect(build.receipt.durationFrames).toBe(360);
    expect(build.files["index.html"]).toContain("12.012");
  },
);
