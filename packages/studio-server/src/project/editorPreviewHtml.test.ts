import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { editorPreviewFixture } from "../../../project-model/src/editorPreview.fixture";
import { decorateEditorPreview } from "./editorPreviewHtml";

describe("AFM-060 preview ownership decoration", () => {
  it("pins root context and replaces an existing base only in the derived document", () => {
    const { session } = editorPreviewFixture();
    const html =
      '<html><head><base href="https://foreign.example/"></head><body><div data-composition-id="title">Title</div></body></html>';
    const result = decorateEditorPreview(html, session, session.scenes[0]);
    const { document } = parseHTML(result);
    assert.equal(document.querySelectorAll("base").length, 1);
    assert.ok(document.querySelector("base")!.getAttribute("href")!.includes(session.buildHash));
    assert.equal(document.documentElement.getAttribute("data-vflow-generated-editable"), "false");
    assert.ok(html.includes('href="https://foreign.example/"'));
  });
  it("marks native authoring path, not its generated scene filename", () => {
    const { session } = editorPreviewFixture();
    const { document } = parseHTML(
      decorateEditorPreview(
        '<html><head></head><body><div data-composition-id="title"></div></body></html>',
        session,
        session.scenes[0],
      ),
    );
    const node = document.querySelector('[data-composition-id="title"]')!;
    assert.equal(node.getAttribute("data-composition-file"), "title.html");
    assert.equal(node.getAttribute("data-vflow-generated-path"), "scene-0-opening.html");
  });
  it("marks diagram ownership without authorizing a generated HTML write", () => {
    const { session } = editorPreviewFixture();
    const { document } = parseHTML(
      decorateEditorPreview(
        '<html><head></head><body><div data-composition-id="diagram"></div></body></html>',
        session,
        session.scenes[1],
      ),
    );
    const node = document.querySelector('[data-composition-id="diagram"]')!;
    assert.equal(node.getAttribute("data-vflow-edit-owner"), "diagram-command");
    assert.equal(node.getAttribute("data-vflow-source-path"), "architecture.json");
    assert.equal(node.getAttribute("data-composition-file"), null);
  });
  it("retains separate master appearance contexts for a repeated document", () => {
    const { session } = editorPreviewFixture();
    const html = `<html><head></head><body>${session.scenes.map((s) => `<div id="${s.hostId}"></div>`).join("")}</body></html>`;
    const { document } = parseHTML(decorateEditorPreview(html, session));
    assert.equal(
      document.getElementById("el-1")!.getAttribute("data-vflow-scene-id"),
      "system.one",
    );
    assert.equal(
      document.getElementById("el-2")!.getAttribute("data-vflow-scene-id"),
      "system:two",
    );
  });
  it("rejects a master whose expected scene disappeared during bundling", () => {
    assert.throws(
      () =>
        decorateEditorPreview(
          "<html><head></head><body></body></html>",
          editorPreviewFixture().session,
        ),
      /missing/,
    );
  });
  it("gives standalone roots scene-local frame duration and output dimensions", () => {
    const { session } = editorPreviewFixture();
    const scene = session.scenes[1]!;
    const { document } = parseHTML(
      decorateEditorPreview(
        '<html><head></head><body><div data-composition-id="diagram" data-start="10" data-duration="1"></div></body></html>',
        session,
        scene,
      ),
    );
    const node = document.querySelector('[data-composition-id="diagram"]')!;
    assert.equal(node.getAttribute("data-start"), "0");
    assert.equal(Number(node.getAttribute("data-duration")), (scene.durationFrames * 1001) / 30000);
    assert.equal(node.getAttribute("data-width"), "1280");
  });
});
