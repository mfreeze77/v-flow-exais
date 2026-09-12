import { describe, expect, it } from "vitest";
import {
  createSelectionResolver,
  resolveSelection,
  selectionFromAttributes,
} from "./selectionBridge";

describe("managed diagram selection identity", () => {
  it("keeps the importDiagram scene convention compatible with AFM-078", () => {
    expect(resolveSelection({ sceneId: "diagram-scene", renderId: "gateway" })).toMatchObject({
      documentId: "diagram",
      objectId: "gateway",
      relationshipId: null,
      sceneInstanceId: "diagram-scene",
      kind: "object",
    });
  });

  it("keeps two appearances of one object in distinct scene contexts", () => {
    const first = resolveSelection({ sceneId: "diagram-scene", renderId: "gateway" });
    const second = resolveSelection({ sceneId: "second-instance", renderId: "gateway" });
    expect(first?.objectId).toBe(second?.objectId);
    expect(first?.sceneInstanceId).not.toBe(second?.sceneInstanceId);
  });

  it("uses explicit document and revision context when the editor has it", () => {
    expect(
      resolveSelection({
        sceneId: "diagram-scene",
        renderId: "gateway",
        documentId: "architecture-source",
        revision: 12,
      }),
    ).toMatchObject({ documentId: "architecture-source", revision: 12 });
  });

  it("does not collapse authored relationships into object identity", () => {
    expect(
      selectionFromAttributes({
        sceneId: "diagram-scene",
        documentId: "diagram",
        relationshipId: "edge-a",
      }),
    ).toMatchObject({
      kind: "relationship",
      relationshipId: "edge-a",
      objectId: null,
    });
  });

  it("rejects unknown scenes and ids when a committed binding table is authoritative", () => {
    const resolve = createSelectionResolver([
      {
        sceneId: "overview",
        documentId: "arch",
        revision: 7,
        objectIds: ["gateway", "api"],
        relationshipIds: ["edge-a"],
      },
    ]);

    expect(resolve({ sceneId: "missing", renderId: "gateway" })).toBeNull();
    expect(resolve({ sceneId: "overview", renderId: "unknown" })).toBeNull();
    expect(
      resolve({ sceneId: "overview", renderId: "edge-b", relationshipId: "edge-b" }),
    ).toBeNull();
    expect(resolve({ sceneId: "overview", renderId: "gateway" })).toMatchObject({
      documentId: "arch",
      revision: 7,
    });
  });

  it("fails closed when relationship and semantic ids disagree", () => {
    expect(
      resolveSelection({
        sceneId: "diagram-scene",
        renderId: "edge-a",
        relationshipId: "edge-b",
      }),
    ).toBeNull();
  });

  it("does not manufacture identity from incomplete metadata", () => {
    expect(selectionFromAttributes({ sceneId: "diagram-scene" })).toBeNull();
    expect(resolveSelection({ sceneId: "", renderId: "gateway" })).toBeNull();
    expect(resolveSelection({ sceneId: "diagram-scene", renderId: "" })).toBeNull();
  });
});
