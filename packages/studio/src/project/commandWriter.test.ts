import { describe, expect, it } from "vitest";

import { applyProjectCommand, type ProjectSnapshot } from "@hyperframes/project-model";

import {
  createManagedProjectWriter,
  operationForWrite,
  ProjectWriteRejected,
} from "./commandWriter";

/**
 * A managed project with both document kinds, matching what `importDiagram`
 * produces: a native title card and a diagram.
 *
 * Built here rather than imported: project-model exports no test fixture
 * subpath, and widening a package's public surface for a test is a worse trade
 * than restating eight lines.
 */
function baseProject(): ProjectSnapshot {
  return {
    manifest: {
      schemaVersion: 1,
      id: "project-test",
      title: "Managed project",
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
            focusObjectIds: ["gateway"],
            relationshipIds: ["edge-a"],
          },
        },
      ],
      output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
      policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
    },
    sources: {
      "diagram-one": {
        schema_version: 1,
        diagram_type: "architecture",
        meta: { title: "Authored branches" },
        components: [
          { id: "gateway", label: "Gateway" },
          { id: "api_a", label: "API A" },
        ],
        connections: [{ id: "edge-a", from: "gateway", to: "api_a" }],
      },
    },
  };
}

function mixedSnapshot(): ProjectSnapshot {
  const snapshot = baseProject();
  snapshot.manifest.documents.push({
    id: "title",
    kind: "native",
    path: "title.html",
    authoritative: true,
  });
  snapshot.manifest.scenes.unshift({
    id: "title-scene",
    kind: "native",
    documentId: "title",
    startFrame: 0,
    durationFrames: 30,
    presentation: { title: "Title", focusObjectIds: [], relationshipIds: [] },
  });
  snapshot.manifest.scenes[1]!.startFrame = 30;
  snapshot.sources.title = "<div data-composition-id='title'></div>";
  return snapshot;
}

/** Captures commands instead of posting them, and applies them for real. */
function recorder(snapshot: ProjectSnapshot) {
  const sent: any[] = [];
  let current = snapshot;
  return {
    sent,
    get snapshot() {
      return current;
    },
    writer: createManagedProjectWriter({
      projectId: current.manifest.id,
      readSnapshot: async () => current,
      sendCommand: async (command) => {
        sent.push(command);
        // Applied through the real model, so a command this writer builds must
        // actually be valid — not merely shaped like one.
        current = applyProjectCommand(current, command);
        return {};
      },
      newCommandId: () => `command-${sent.length}`,
    }),
  };
}

describe("AFM-072: a file write on a managed project becomes a project command", () => {
  it("commits native HTML through replace-native-source and advances the revision", async () => {
    const harness = recorder(mixedSnapshot());
    const before = harness.snapshot.manifest.revision;

    await harness.writer("title.html", "<div data-composition-id='title'>edited</div>");

    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0].operations[0]).toMatchObject({
      type: "replace-native-source",
      documentId: "title",
    });
    expect(harness.snapshot.manifest.revision).toBe(before + 1);
    expect(String(harness.snapshot.sources.title)).toContain("edited");
  });

  it("commits diagram JSON through replace-diagram-source", async () => {
    const harness = recorder(mixedSnapshot());
    const source = structuredClone(harness.snapshot.sources["diagram-one"]) as any;
    source.components[0].label = "Edge Gateway";

    await harness.writer("diagrams/architecture.json", JSON.stringify(source));

    expect(harness.sent[0].operations[0].type).toBe("replace-diagram-source");
    const committed = harness.snapshot.sources["diagram-one"] as any;
    expect(committed.components[0].label).toBe("Edge Gateway");
  });

  it("sends the live revision so a concurrent commit is a conflict, not an overwrite", async () => {
    // The file writer approximated this with an expectedContent comparison.
    // Routing through commands makes it the project's own revision check.
    const harness = recorder(mixedSnapshot());
    await harness.writer("title.html", "<div data-composition-id='title'>one</div>");
    await harness.writer("title.html", "<div data-composition-id='title'>two</div>");

    expect(harness.sent[0].expectedRevision).toBe(0);
    expect(harness.sent[1].expectedRevision).toBe(1);
  });

  it("gives each write its own command identity", async () => {
    // A reused command ID is treated as a replay by the journal, so two edits
    // sharing one would silently drop the second.
    const harness = recorder(mixedSnapshot());
    await harness.writer("title.html", "<div data-composition-id='title'>one</div>");
    await harness.writer("title.html", "<div data-composition-id='title'>two</div>");

    expect(harness.sent[0].commandId).not.toBe(harness.sent[1].commandId);
  });

  it("refuses a path no authoritative document claims", async () => {
    // Falling back to a direct write here would restore the bypass this
    // adapter exists to remove.
    const harness = recorder(mixedSnapshot());

    await expect(harness.writer("src/scratch.tsx", "anything")).rejects.toThrow(
      ProjectWriteRejected,
    );
    expect(harness.sent).toHaveLength(0);
  });

  it("refuses unparsable bytes for a diagram document", async () => {
    const harness = recorder(mixedSnapshot());

    await expect(harness.writer("diagrams/architecture.json", "not json")).rejects.toThrow(
      /must be JSON/,
    );
    expect(harness.sent).toHaveLength(0);
  });

  it("matches a document whichever way the writer spells the path", () => {
    const snapshot = mixedSnapshot();
    for (const spelling of ["title.html", "./title.html", "/title.html", "title.html"]) {
      expect(operationForWrite(snapshot, spelling, "<div/>")).toMatchObject({
        documentId: "title",
      });
    }
  });
});
