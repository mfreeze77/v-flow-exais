import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "vitest";
import {
  editorRevisionFromQuery,
  projectEditorDocument,
  projectEditorView,
} from "./editorProjection";

import { editorFixture } from "./editorRead.fixture";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
describe("AFM-059/060 editor projection", () => {
  it("shows authored paths only, not generated scene names or revision directories", () => {
    const view = projectEditorView(editorFixture());
    assert.deepEqual(
      view.documents.map((d) => d.path),
      ["title.html", "system.architecture.json"],
    );
    assert.equal(JSON.stringify(view).includes(".vflow"), false);
    assert.equal(view.generatedOutputEditable, false);
  });
  it("keeps two appearances as one document with two scene identities", () => {
    assert.deepEqual(projectEditorView(editorFixture()).documents[1]!.sceneInstanceIds, [
      "first",
      "second",
    ]);
  });
  it("describes project-owned history rather than manufacturing a native undo stack", () => {
    assert.deepEqual(projectEditorView(editorFixture()).history, {
      owner: "project-journal",
      canUndo: true,
      canRedo: false,
    });
  });
  it("does not mutate a null-prototype snapshot, sources, or history", () => {
    const input = editorFixture(),
      before = JSON.stringify(input);
    projectEditorView(input);
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.getPrototypeOf(input.snapshot.sources), null);
  });
  it("reads native HTML exactly, including CRLF and repeated spaces", () => {
    const input = editorFixture(),
      view = projectEditorView(input);
    const doc = projectEditorDocument(input, view, "title");
    assert.equal(doc.content, input.snapshot.sources.title);
    assert.equal(doc.contentHash, digest(String(input.snapshot.sources.title)));
    assert.equal(doc.contentHash, view.documents[0]!.contentHash);
  });
  it("pretty-prints diagram display content without modifying its committed value", () => {
    const input = editorFixture(),
      view = projectEditorView(input);
    const doc = projectEditorDocument(input, view, "system");
    assert.deepEqual(JSON.parse(doc.content), input.snapshot.sources.system);
    assert.equal(doc.contentHash, digest(doc.content));
  });
  it("rejects stale revisions", () => {
    const input = editorFixture(),
      view = projectEditorView(input);
    assert.throws(() => projectEditorDocument(input, { ...view, revision: 3 }, "title"), /changed/);
  });
  it("rejects another immutable revision hash even at the same revision number", () => {
    const input = editorFixture(),
      view = projectEditorView(input);
    assert.throws(
      () => projectEditorDocument(input, { ...view, revisionHash: "b".repeat(64) }, "title"),
      /changed/,
    );
  });
  it("rejects a token for another project", () => {
    const input = editorFixture(),
      view = projectEditorView(input);
    assert.throws(
      () => projectEditorDocument(input, { ...view, projectId: "other" }, "title"),
      /changed/,
    );
  });
  it("does not treat a generated render filename as a document ID", () => {
    const input = editorFixture();
    assert.throws(
      () => projectEditorDocument(input, projectEditorView(input), "scene-0-intro.html"),
      /No authored/,
    );
  });
  it("rejects missing committed source instead of returning an empty document", () => {
    const input = editorFixture();
    delete input.snapshot.sources.title;
    assert.throws(() => projectEditorView(input), /absent/);
  });
  it("rejects pointer and manifest revision disagreement", () => {
    const input = editorFixture();
    input.pointer.revision = 5;
    assert.throws(() => projectEditorView(input), /disagree/);
  });
  it("accepts zero as a real expected revision", () => {
    assert.equal(editorRevisionFromQuery("editor-test", "0", "a".repeat(64)).revision, 0);
  });
  for (const value of [undefined, "", "NaN", "-1", "01", "1.5", "1e2", "9007199254740992"])
    it(`rejects invalid revision query ${String(value)}`, () => {
      assert.throws(
        () => editorRevisionFromQuery("editor-test", value, "a".repeat(64)),
        /required/,
      );
    });
  it("rejects a missing revision hash", () => {
    assert.throws(() => editorRevisionFromQuery("editor-test", "4", undefined), /required/);
  });
  it("rejects a malformed revision hash", () => {
    assert.throws(() => editorRevisionFromQuery("editor-test", "4", "not-a-hash"), /required/);
  });
});
