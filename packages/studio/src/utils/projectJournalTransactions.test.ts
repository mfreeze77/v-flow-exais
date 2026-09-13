import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { saveProjectFilesWithHistory } from "./studioFileHistory";
import { persistSdkSerialize, persistSdkCandidateMutation } from "./sdkEditTransaction";
import { createJournalWriter } from "../project/projectJournalProtocol";
import { isSelfWriteEcho, resetSelfWriteRegistry } from "../hooks/sdkSelfWriteRegistry";

function setup(fail = false) {
  const edits: any[] = [];
  let records = 0,
    reloads = 0;
  const writer = createJournalWriter({
    owner: "project-journal",
    projectId: "p",
    async commitEdit(edit) {
      edits.push(edit);
      if (fail) throw new Error("rejected before commit");
      return Object.keys(edit.files);
    },
  });
  const deps = {
    writeProjectFile: writer,
    editHistory: {
      recordEdit: async () => {
        records++;
        throw new Error("second history owner");
      },
    },
    reloadPreview: () => {
      reloads++;
    },
    domEditSaveTimestampRef: { current: 0 },
    readProjectFile: async () => "A",
  };
  return {
    writer,
    deps,
    edits,
    get records() {
      return records;
    },
    get reloads() {
      return reloads;
    },
  };
}

describe("existing SDK transaction delegates to a project-journal capability", () => {
  it("commits exactly once without recording native history", async () => {
    const h = setup();
    await persistSdkSerialize(() => "B", "title.html", "A", h.deps);
    assert.equal(h.edits.length, 1);
    assert.equal(h.records, 0);
    assert.equal(h.reloads, 1);
    assert.deepEqual(h.edits[0].files, { "title.html": { before: "A", after: "B" } });
  });
  it("does not register a filesystem echo for a project commit", async () => {
    resetSelfWriteRegistry();
    const h = setup();
    await persistSdkSerialize(() => "B", "title.html", "A", h.deps);
    assert.equal(isSelfWriteEcho("title.html", "B"), false);
    assert.equal(h.deps.domEditSaveTimestampRef.current, 0);
  });
  it("does not compensate a rejected command with a second write", async () => {
    const h = setup(true);
    await assert.rejects(
      persistSdkSerialize(() => "B", "title.html", "A", h.deps),
      /rejected/,
    );
    assert.equal(h.edits.length, 1);
    assert.equal(h.records, 0);
    assert.equal(h.reloads, 0);
  });
  it("does not mutate or record a no-op", async () => {
    const h = setup();
    await persistSdkSerialize(() => "A", "title.html", "A", h.deps);
    assert.equal(h.edits.length, 0);
    assert.equal(h.records, 0);
  });
  it("passes a user label but not an independent history coalescing operation", async () => {
    const h = setup();
    await persistSdkSerialize(() => "B", "title.html", "A", h.deps, {
      label: "Rename heading",
      coalesceKey: "x",
      coalesceMs: 500,
    });
    assert.equal(h.edits[0].label, "Rename heading");
    assert.equal(h.records, 0);
  });
  it("a refresh exception cannot reverse a confirmed command", async () => {
    const h = setup();
    await persistSdkSerialize(() => "B", "title.html", "A", {
      ...h.deps,
      refresh: () => {
        throw new Error("preview");
      },
    });
    assert.equal(h.edits.length, 1);
    assert.equal(h.records, 0);
  });
  it("publishes a candidate only after its project commit completes", async () => {
    const order: string[] = [];
    const live = { serialize: () => "A", dispose() {} };
    let value = "A";
    const candidate = {
      serialize: () => value,
      batch: (fn: () => void) => fn(),
      dispose() {
        order.push("dispose");
      },
    };
    const writer = createJournalWriter({
      owner: "project-journal",
      projectId: "p",
      commitEdit: async () => {
        order.push("commit");
        return ["title.html"];
      },
    });
    const h = setup();
    const result = await persistSdkCandidateMutation(
      live as any,
      "title.html",
      "A",
      {
        ...h.deps,
        writeProjectFile: writer,
        createCandidateSession: async () => candidate as any,
        publishSession: () => {
          order.push("publish");
          return "published";
        },
      },
      () => {
        value = "B";
      },
    );
    assert.equal(result.status, "committed");
    assert.deepEqual(order, ["commit", "publish"]);
  });
  it("disposes an uncommitted candidate without changing the live session", async () => {
    let disposed = 0,
      published = 0;
    const h = setup(true);
    const live = {
      serialize: () => "A",
      dispose() {
        throw new Error("live disposed");
      },
    };
    const candidate = {
      serialize: () => "B",
      batch: (fn: () => void) => fn(),
      dispose() {
        disposed++;
      },
    };
    const result = await persistSdkCandidateMutation(
      live as any,
      "title.html",
      "A",
      {
        ...h.deps,
        createCandidateSession: async () => candidate as any,
        publishSession: () => {
          published++;
          return "published";
        },
      },
      () => {},
    );
    assert.equal(result.status, "failed");
    assert.equal(disposed, 1);
    assert.equal(published, 0);
  });
});

describe("multi-document save has one atomic owner", () => {
  it("submits a pair of files in one command and does not invoke native history", async () => {
    const h = setup();
    const paths = await saveProjectFilesWithHistory({
      projectId: "p",
      label: "Pair",
      kind: "manual",
      files: { "a.html": "B", "b.html": "C" },
      readFile: async () => "A",
      writeFile: h.writer,
      recordEdit: h.deps.editHistory.recordEdit,
    });
    assert.deepEqual(paths, ["a.html", "b.html"]);
    assert.equal(h.edits.length, 1);
    assert.equal(h.records, 0);
  });
  it("does not write an earlier file when an atomic command is rejected", async () => {
    const h = setup(true);
    await assert.rejects(
      saveProjectFilesWithHistory({
        projectId: "p",
        label: "Pair",
        kind: "manual",
        files: { "a.html": "B", "b.html": "C" },
        readFile: async () => "A",
        writeFile: h.writer,
        recordEdit: h.deps.editHistory.recordEdit,
      }),
      /rejected/,
    );
    assert.equal(h.edits.length, 1);
    assert.equal(h.records, 0);
  });
  it("rejects another project's writer before reading", async () => {
    const h = setup();
    let reads = 0;
    await assert.rejects(
      saveProjectFilesWithHistory({
        projectId: "other",
        label: "Pair",
        kind: "manual",
        files: { "a.html": "B" },
        readFile: async () => {
          reads++;
          return "A";
        },
        writeFile: h.writer,
        recordEdit: h.deps.editHistory.recordEdit,
      }),
      /project-mismatch/,
    );
    assert.equal(reads, 0);
    assert.equal(h.edits.length, 0);
  });
  it("rejects adoption of a prior filesystem mutation", async () => {
    const h = setup();
    await assert.rejects(
      saveProjectFilesWithHistory({
        projectId: "p",
        label: "Pair",
        kind: "manual",
        files: { "a.html": "B" },
        diskContent: {},
        readFile: async () => "A",
        writeFile: h.writer,
        recordEdit: h.deps.editHistory.recordEdit,
      }),
      /partial-server-edit/,
    );
    assert.equal(h.edits.length, 0);
  });
  it("does not silently derive a raw-source draft baseline from a later read", async () => {
    const h = setup();
    let reads = 0;
    await assert.rejects(
      saveProjectFilesWithHistory({
        projectId: "p",
        label: "Source",
        kind: "source",
        files: { "a.html": "B" },
        readFile: async () => {
          reads++;
          return "A";
        },
        writeFile: h.writer,
        recordEdit: h.deps.editHistory.recordEdit,
      }),
      /draft-baseline-required/,
    );
    assert.equal(reads, 0);
    assert.equal(h.edits.length, 0);
  });
  it("uses an explicit raw-source baseline rather than refreshing it", async () => {
    const h = setup();
    let reads = 0;
    await saveProjectFilesWithHistory({
      projectId: "p",
      label: "Source",
      kind: "source",
      files: { "a.html": "B" },
      expectedContent: { "a.html": "A" },
      readFile: async () => {
        reads++;
        return "foreign";
      },
      writeFile: h.writer,
      recordEdit: h.deps.editHistory.recordEdit,
    });
    assert.equal(reads, 0);
    assert.equal(h.edits[0].files["a.html"].before, "A");
  });
  it("native writers retain write then history and rollback behavior", async () => {
    const writes: string[] = [];
    let content = "A";
    await assert.rejects(
      saveProjectFilesWithHistory({
        projectId: "native",
        label: "Native",
        kind: "manual",
        files: { "a.html": "B" },
        readFile: async () => content,
        writeFile: async (_path, after) => {
          writes.push(after);
          content = after;
        },
        recordEdit: async () => {
          throw new Error("native history failed");
        },
      }),
      /native history failed/,
    );
    assert.deepEqual(writes, ["B", "A"]);
    assert.equal(content, "A");
  });
  it("native raw-source saves keep their previous implicit-baseline contract", async () => {
    let reads = 0,
      writes = 0,
      records = 0;
    await saveProjectFilesWithHistory({
      projectId: "native",
      label: "Source",
      kind: "source",
      files: { a: "B" },
      readFile: async () => {
        reads++;
        return "A";
      },
      writeFile: async () => {
        writes++;
      },
      recordEdit: async () => {
        records++;
      },
    });
    assert.deepEqual([reads, writes, records], [1, 1, 1]);
  });
});
