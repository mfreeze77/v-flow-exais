import { describe, expect, it } from "vitest";
import {
  assertProject,
  OBJECT_COLLECTIONS,
  quarantineOrphanedTargets,
  RELATIONSHIP_COLLECTIONS,
  validateProject,
  type RegenerationConflict,
  type ProjectSnapshot,
} from "./project";
import { migrateRelationshipIds } from "./identity";
import { applyProjectCommand } from "./commands";
import { projectFixture, renameCommand } from "./test-fixture";
import type { DiagramKind } from "./index";

describe("AFM-017: authoritative project envelope", () => {
  it("roundtrips all five diagram kinds plus native HTML without duplicating source", () => {
    const project = projectFixture();
    project.manifest.documents = [];
    project.manifest.scenes = [];
    project.sources = {};
    for (const [index, kind] of Object.keys(OBJECT_COLLECTIONS).entries()) {
      const family = kind as DiagramKind;
      project.manifest.documents.push({
        id: kind,
        kind: family,
        path: `diagrams/${kind}.json`,
        authoritative: true,
      });
      project.sources[kind] = {
        diagram_type: kind,
        [OBJECT_COLLECTIONS[family]]: [{ id: "first" }],
        [RELATIONSHIP_COLLECTIONS[family]]: [],
      };
      project.manifest.scenes.push({
        id: `scene-${kind}`,
        kind: "diagram",
        documentId: kind,
        startFrame: index * 30,
        durationFrames: 30,
        presentation: { title: kind, focusObjectIds: ["first"], relationshipIds: [] },
      });
    }
    const native =
      '<div data-composition-id="native" data-custom-metadata="retained">Editable title</div>';
    project.manifest.documents.push({
      id: "native",
      kind: "native",
      path: "native/title.html",
      authoritative: true,
    });
    project.sources.native = native;
    project.manifest.scenes.push({
      id: "scene-native",
      kind: "native",
      documentId: "native",
      startFrame: 150,
      durationFrames: 30,
      presentation: { title: "Title", focusObjectIds: [], relationshipIds: [] },
    });
    expect(validateProject(project)).toEqual([]);
    const reopened = JSON.parse(JSON.stringify(project)) as ProjectSnapshot;
    expect(reopened.sources.native).toBe(native);
    expect(reopened.manifest.documents).toHaveLength(6);
    expect(reopened.manifest.output.fps).toEqual({ numerator: 30000, denominator: 1001 });
  });

  it.each([
    "../escape.json",
    "C:/private.json",
    "diagrams/../../escape.json",
    "diagrams/CON.json",
    ".vflow/CURRENT",
    "generated/index.html",
  ])("rejects unsafe/derived authoring path %s", (path) => {
    const project = projectFixture();
    project.manifest.documents[0]!.path = path;
    expect(validateProject(project).some((item) => item.code === "document/unsafe-path")).toBe(
      true,
    );
  });

  it("rejects unknown versions without rewriting the input", () => {
    const project = projectFixture();
    const unknown = { ...project, manifest: { ...project.manifest, schemaVersion: 77 } };
    const original = JSON.stringify(unknown);
    expect(validateProject(unknown)[0]?.code).toBe("project/unsupported-version");
    expect(JSON.stringify(unknown)).toBe(original);
  });

  it("rejects duplicate document IDs and portable path collisions", () => {
    const project = projectFixture();
    project.manifest.documents.push({
      ...project.manifest.documents[0]!,
      path: "DIAGRAMS/ARCHITECTURE.JSON",
    });
    const codes = validateProject(project).map((item) => item.code);
    expect(codes).toContain("document/duplicate-id");
    expect(codes).toContain("document/path-collision");
  });
});

describe("AFM-018: durable relationship and scene identities", () => {
  it.each(["architecture", "sequence"] as const)(
    "preserves repeated %s relationships through reorder and label edits",
    (kind) => {
      const key = RELATIONSHIP_COLLECTIONS[kind];
      const original = {
        [key]: [
          { from: "a", to: "b" },
          { from: "a", to: "b" },
        ],
      };
      const first = migrateRelationshipIds(original, kind);
      const edges = first.source[key] as { id: string; label?: string }[];
      expect(new Set(edges.map((edge) => edge.id)).size).toBe(2);
      edges.reverse();
      edges[0]!.label = "Renamed";
      const second = migrateRelationshipIds(first.source, kind);
      expect(second.assigned).toBe(0);
      expect(second.source).toEqual(first.source);
      expect(first.original).toEqual(original);
      expect(original[key]).toEqual([
        { from: "a", to: "b" },
        { from: "a", to: "b" },
      ]);
    },
  );

  it("rejects ambiguous existing identities", () => {
    expect(() =>
      migrateRelationshipIds({ connections: [{ id: "same" }, { id: "same" }] }, "architecture"),
    ).toThrow(/ambiguous/);
  });
});

describe("AFM-019 and AFM-025: validated semantic commands", () => {
  it("renames actual source, advances revision, and preserves authored branches", () => {
    const before = projectFixture();
    const next = applyProjectCommand(before, renameCommand());
    expect(next.manifest.revision).toBe(1);
    expect((next.sources["diagram-one"] as Record<string, unknown>).components).toContainEqual({
      id: "api_a",
      label: "Orders API",
    });
    expect(next.sources["diagram-one"]).not.toEqual(before.sources["diagram-one"]);
    expect((next.sources["diagram-one"] as Record<string, unknown>).connections).toEqual(
      (before.sources["diagram-one"] as Record<string, unknown>).connections,
    );
  });

  it("rejects stale writes and unknown operations without mutations", () => {
    const before = projectFixture();
    const bytes = JSON.stringify(before);
    expect(() => applyProjectCommand(before, renameCommand("stale", 12))).toThrow(
      /Expected revision/,
    );
    expect(() =>
      applyProjectCommand(before, { ...renameCommand(), operations: [{ type: "constructor" }] }),
    ).toThrow(/Unknown operation/);
    expect(JSON.stringify(before)).toBe(bytes);
  });

  it("rejects the whole batch when its final operation is invalid", () => {
    const before = projectFixture();
    const command = renameCommand();
    command.operations.push({
      type: "rename-object",
      documentId: "diagram-one",
      objectId: "missing",
      label: "Bad",
    });
    expect(() => applyProjectCommand(before, command)).toThrow(/does not exist/);
    expect(JSON.stringify(before)).not.toContain("Orders API");
  });

  it.each([0, -1, NaN, Infinity, 1.5])("rejects invalid duration %s", (durationFrames) => {
    const project = projectFixture();
    project.manifest.scenes[0]!.durationFrames = durationFrames;
    expect(() => assertProject(project)).toThrow();
  });

  it("blocks removed animated relationships without inventing replacement traffic", () => {
    const project = projectFixture();
    (project.sources["diagram-one"] as Record<string, unknown>).connections = [
      { id: "edge-b", from: "gateway", to: "api_b" },
    ];
    expect(validateProject(project).map((item) => item.code)).toContain(
      "scene/orphaned-relationship",
    );
    expect(JSON.stringify(project)).not.toContain('"from":"api_a"');
  });
});

describe("AFM-048: regeneration reports orphaned intent instead of refusing or guessing", () => {
  /** Deletes one relationship from the fixture's authored source. */
  function withoutEdge(snapshot: ReturnType<typeof projectFixture>, edgeId: string) {
    const next = structuredClone(snapshot);
    const source = next.sources["diagram-one"] as any;
    source.connections = source.connections.filter((edge: any) => edge.id !== edgeId);
    return next;
  }

  it("removes an animated target the source no longer contains and reports it", () => {
    const before = projectFixture();
    const conflicts = quarantineOrphanedTargets(withoutEdge(before, "edge-b"));

    expect(conflicts.length).toBe(1);
    expect(conflicts[0]).toEqual({
      kind: "orphaned-target",
      sceneId: "scene-one",
      targetId: "edge-b",
      field: "relationshipIds",
      detail:
        "The animated relationship was removed from the authored source. No replacement was inferred.",
    });
  });

  it("never reassigns the override to a surviving relationship", () => {
    // The failure this exists to prevent: keeping the project valid by moving
    // the intent to a neighbouring edge, animating a relationship nobody wrote.
    const next = withoutEdge(projectFixture(), "edge-b");
    quarantineOrphanedTargets(next);

    expect(next.manifest.scenes[0].presentation.relationshipIds).toEqual(["edge-a"]);
  });

  it("reports an orphaned focus object separately from a relationship", () => {
    const next = structuredClone(projectFixture());
    const source = next.sources["diagram-one"] as any;
    source.components = source.components.filter((node: any) => node.id !== "api_b");
    source.connections = source.connections.filter((edge: any) => edge.to !== "api_b");

    const conflicts = quarantineOrphanedTargets(next);
    const fields = conflicts.map((conflict) => conflict.field).sort();

    expect(fields).toEqual(["focusObjectIds", "relationshipIds"]);
    expect(!next.manifest.scenes[0].presentation.focusObjectIds.includes("api_b")).toBe(true);
  });

  it("reports nothing when every target still exists", () => {
    expect(quarantineOrphanedTargets(projectFixture())).toEqual([]);
  });

  it("leaves the project valid after quarantine, so the edit can commit", () => {
    // Before this, validateProject rejected the snapshot outright and the whole
    // command failed — the only way to preserve the last valid state was to
    // refuse any deletion an override referenced.
    const next = withoutEdge(projectFixture(), "edge-b");
    quarantineOrphanedTargets(next);

    expect(validateProject(next)).toEqual([]);
  });

  it("surfaces the conflict through applyProjectCommand rather than throwing", () => {
    const before = projectFixture();
    const source = structuredClone(before.sources["diagram-one"]) as any;
    source.connections = source.connections.filter((edge: any) => edge.id !== "edge-b");

    const conflicts: RegenerationConflict[] = [];
    const next = applyProjectCommand(
      before,
      {
        commandId: "regenerate-one",
        origin: "ui",
        projectId: "project-test",
        expectedRevision: 0,
        operations: [{ type: "replace-diagram-source", documentId: "diagram-one", source }],
      },
      conflicts,
    );

    expect(next.manifest.revision).toBe(1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].targetId).toBe("edge-b");
  });
});
