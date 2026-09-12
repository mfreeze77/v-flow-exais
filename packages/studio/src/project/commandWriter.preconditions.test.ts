/**
 * AFM-072: adapter preconditions, not a substitute for journal/UI acceptance.
 * Uses an injected in-memory transport to examine the actual writer's requests.
 * The pinned-container suite also retains commandWriter.test.ts, which applies
 * commands through the real project model.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ProjectSnapshot } from "@hyperframes/project-model";
import {
  createManagedProjectWriter,
  ProjectWriteRejected,
  type CommandWriterOptions,
} from "./commandWriter";

type Command = Parameters<CommandWriterOptions["sendCommand"]>[0];

function fixture(): ProjectSnapshot {
  return {
    manifest: {
      schemaVersion: 1,
      id: "guarded-project",
      title: "Mixed project",
      revision: 4,
      documents: [
        { id: "title", path: "title.html", kind: "native", authoritative: true },
        { id: "diagram", path: "source.json", kind: "architecture", authoritative: true },
      ],
      scenes: [
        {
          id: "title-scene",
          documentId: "title",
          kind: "native",
          startFrame: 0,
          durationFrames: 75,
          presentation: { title: "Title", focusObjectIds: [], relationshipIds: [] },
        },
        {
          id: "diagram-scene",
          documentId: "diagram",
          kind: "diagram",
          startFrame: 75,
          durationFrames: 180,
          presentation: { title: "Diagram", focusObjectIds: [], relationshipIds: [] },
        },
      ],
      output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
      policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
    },
    sources: {
      title: "<h1>Original</h1>",
      diagram: {
        schema_version: 1,
        diagram_type: "architecture",
        meta: { title: "Diagram", subtitle: "Keep me" },
        components: [
          { id: "gateway", label: "Gateway" },
          { id: "api", label: "API" },
        ],
        connections: [{ id: "edge", from: "gateway", to: "api" }],
      },
    },
  };
}

function harness(snapshot = fixture()) {
  const sent: Command[] = [];
  let ids = 0;
  const writer = createManagedProjectWriter({
    projectId: "guarded-project",
    readSnapshot: async () => snapshot,
    sendCommand: async (command) => {
      sent.push(command);
      return {};
    },
    newCommandId: () => `write-${++ids}`,
  });
  return { snapshot, sent, writer, allocatedIds: () => ids };
}

function isContentConflict(error: unknown): boolean {
  assert.ok(error instanceof ProjectWriteRejected);
  assert.equal(error.name, "ProjectContentConflict");
  assert.equal((error as ProjectWriteRejected & { code: string }).code, "project/content-conflict");
  return true;
}

async function rejectsWithoutSending(
  h: ReturnType<typeof harness>,
  path: string,
  content: string,
  expected: string,
  predicate: (error: unknown) => boolean = isContentConflict,
) {
  const before = structuredClone(h.snapshot);
  await assert.rejects(h.writer(path, content, expected), predicate);
  assert.equal(h.sent.length, 0, "a rejected baseline must never reach the command service");
  assert.equal(h.allocatedIds(), 0, "a rejected baseline is not a new command");
  assert.deepEqual(h.snapshot, before, "checking a draft must not mutate committed state");
}

describe("AFM-072 — native authoring content is a precondition", () => {
  it("rejects a stale native draft even when the freshly read revision is current", async () => {
    const h = harness();
    h.snapshot.sources.title = "<h1>Newer edit from another writer</h1>";
    h.snapshot.manifest.revision = 5;
    await rejectsWithoutSending(h, "title.html", "<h1>Stale draft</h1>", "<h1>Original</h1>");
  });

  it("accepts matching native content and pins the revision of that comparison", async () => {
    const h = harness();
    await h.writer("title.html", "<h1>Edited</h1>", "<h1>Original</h1>");
    assert.equal(h.sent.length, 1);
    assert.equal(h.sent[0]!.expectedRevision, 4);
    assert.deepEqual(h.sent[0]!.operations, [
      { type: "replace-native-source", documentId: "title", html: "<h1>Edited</h1>" },
    ]);
    assert.equal(h.snapshot.sources.title, "<h1>Original</h1>");
  });

  it("treats an empty expected string as a supplied precondition", async () => {
    await rejectsWithoutSending(harness(), "title.html", "<h1>Edited</h1>", "");
  });

  it("allows a matching empty native document", async () => {
    const h = harness();
    h.snapshot.sources.title = "";
    await h.writer("title.html", "<h1>First content</h1>", "");
    assert.equal(h.sent.length, 1);
  });

  it("does not trim significant native whitespace", async () => {
    const h = harness();
    h.snapshot.sources.title = "<pre>a  b</pre>";
    await rejectsWithoutSending(h, "title.html", "<pre>changed</pre>", "<pre>a b</pre>");
  });

  it("does not normalize native line endings while checking the baseline", async () => {
    const h = harness();
    h.snapshot.sources.title = "<pre>a\r\nb</pre>";
    await rejectsWithoutSending(h, "title.html", "<pre>changed</pre>", "<pre>a\nb</pre>");
  });

  it("allows an unrelated revision advance when the target document still matches", async () => {
    const h = harness();
    h.snapshot.manifest.revision = 12;
    h.snapshot.manifest.title = "Another edit changed only the project title";
    await h.writer("title.html", "<h1>Edited</h1>", "<h1>Original</h1>");
    assert.equal(h.sent[0]!.expectedRevision, 12);
  });

  it("retains the existing unconditional API when expectedContent is omitted", async () => {
    const h = harness();
    await h.writer("title.html", "<h1>Explicit replacement</h1>");
    assert.equal(h.sent.length, 1);
  });

  it("does not expose the draft or committed content in a conflict message", async () => {
    const h = harness();
    h.snapshot.sources.title = "PRIVATE-COMMITTED-TEXT";
    await assert.rejects(h.writer("title.html", "PRIVATE-DRAFT-TEXT", "PRIVATE-BASE-TEXT"), (error) => {
      isContentConflict(error);
      assert.doesNotMatch(String(error), /PRIVATE-/);
      return true;
    });
  });
});

describe("AFM-072 — diagram baselines compare JSON semantics", () => {
  it("accepts indentation and recursively reordered object keys without rewriting the payload", async () => {
    const h = harness();
    const reverseKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value !== null && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([key, item]) => [key, reverseKeys(item)]),
        );
      return value;
    };
    const expected = JSON.stringify(reverseKeys(h.snapshot.sources.diagram), null, 4);
    const edited = structuredClone(h.snapshot.sources.diagram) as Record<string, unknown>;
    edited.meta = { title: "Edited", subtitle: "Keep me" };
    await h.writer("source.json", JSON.stringify(edited), expected);
    assert.equal(h.sent.length, 1);
    assert.deepEqual(h.sent[0]!.operations, [
      { type: "replace-diagram-source", documentId: "diagram", source: edited },
    ]);
  });

  it("rejects a nested semantic change that occurred before snapshot acquisition", async () => {
    const h = harness();
    const expected = JSON.stringify(h.snapshot.sources.diagram);
    (h.snapshot.sources.diagram as Record<string, unknown>).meta = {
      title: "Changed",
      subtitle: "Keep me",
    };
    await rejectsWithoutSending(h, "source.json", expected, expected);
  });

  it("retains significance of authored array ordering", async () => {
    const h = harness();
    const expected = JSON.stringify(h.snapshot.sources.diagram);
    const source = h.snapshot.sources.diagram as { components: unknown[] };
    source.components.reverse();
    await rejectsWithoutSending(h, "source.json", expected, expected);
  });

  it("detects added JSON fields instead of comparing only known labels", async () => {
    const h = harness();
    const expected = JSON.stringify(h.snapshot.sources.diagram);
    (h.snapshot.sources.diagram as Record<string, unknown>).extra = "new source data";
    await rejectsWithoutSending(h, "source.json", expected, expected);
  });

  for (const expected of ["not json", "null", "[]", "42"]) {
    it(`rejects an invalid diagram baseline: ${expected}`, async () => {
      const h = harness();
      await rejectsWithoutSending(h, "source.json", JSON.stringify(h.snapshot.sources.diagram), expected, (error) => {
        assert.ok(error instanceof ProjectWriteRejected);
        assert.match(error.message, /Expected diagram content must be a JSON object/);
        return true;
      });
    });
  }

  it("compares own __proto__ keys as data rather than inherited properties", async () => {
    const h = harness();
    const source = h.snapshot.sources.diagram as Record<string, unknown>;
    source.meta = JSON.parse('{"title":"Diagram","__proto__":{"label":"new"}}');
    const expected = structuredClone(source);
    expected.meta = JSON.parse('{"title":"Diagram","__proto__":{"label":"old"}}');
    await rejectsWithoutSending(h, "source.json", JSON.stringify(source), JSON.stringify(expected));
  });
});

describe("AFM-072 — errors remain at the authoritative command boundary", () => {
  it("refuses a snapshot from another project even when the path matches", async () => {
    const h = harness();
    h.snapshot.manifest.id = "different-project";
    await assert.rejects(h.writer("title.html", "edited", "<h1>Original</h1>"), /another project/);
    assert.equal(h.sent.length, 0);
  });

  it("propagates a revision race after the read without rebasing or retrying", async () => {
    const snapshot = fixture();
    let reads = 0;
    let attempts = 0;
    const race = new Error("Expected revision 4; current revision is 5");
    const writer = createManagedProjectWriter({
      projectId: snapshot.manifest.id,
      readSnapshot: async () => {
        reads++;
        return structuredClone(snapshot);
      },
      sendCommand: async (command) => {
        attempts++;
        assert.equal(command.expectedRevision, 4);
        // The service acquired its lock after a separate writer committed.
        throw race;
      },
    });
    await assert.rejects(writer("title.html", "edited", "<h1>Original</h1>"), (error) => error === race);
    assert.equal(reads, 1);
    assert.equal(attempts, 1);
  });

  it("does not submit after the authoritative reader fails", async () => {
    let sent = 0;
    const failure = new Error("read unavailable");
    const writer = createManagedProjectWriter({
      projectId: "guarded-project",
      readSnapshot: async () => {
        throw failure;
      },
      sendCommand: async () => {
        sent++;
      },
    });
    await assert.rejects(writer("title.html", "edited", "old"), (error) => error === failure);
    assert.equal(sent, 0);
  });

  it("refuses a missing committed source even when the document is declared", async () => {
    const h = harness();
    delete h.snapshot.sources.title;
    await assert.rejects(h.writer("title.html", "edited"), /source is missing or invalid/);
    assert.equal(h.sent.length, 0);
  });

  it("refuses an invalid runtime precondition instead of treating null as omitted", async () => {
    const h = harness();
    await assert.rejects(h.writer("title.html", "edited", null as unknown as string), /must be text/);
    assert.equal(h.sent.length, 0);
  });

  for (const revision of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    it(`refuses an invalid committed revision: ${revision}`, async () => {
      const h = harness();
      h.snapshot.manifest.revision = revision;
      await assert.rejects(h.writer("title.html", "edited"), /invalid revision/);
      assert.equal(h.sent.length, 0);
    });
  }

  it("still refuses a document path that the project does not own", async () => {
    const h = harness();
    await assert.rejects(h.writer("missing.html", "edited", "old"), /No authoritative document/);
    assert.equal(h.sent.length, 0);
  });

  it("still refuses malformed new diagram content", async () => {
    const h = harness();
    await assert.rejects(h.writer("source.json", "invalid", JSON.stringify(h.snapshot.sources.diagram)), /must be JSON/);
    assert.equal(h.sent.length, 0);
  });

  it("checks the same document after portable path normalization", async () => {
    const h = harness();
    h.snapshot.manifest.documents[0]!.path = "compositions/title.html";
    await h.writer(".\\compositions\\title.html", "edited", "<h1>Original</h1>");
    assert.equal(h.sent[0]!.operations.length, 1);
    assert.equal((h.sent[0]!.operations[0] as { documentId: string }).documentId, "title");
  });
});
