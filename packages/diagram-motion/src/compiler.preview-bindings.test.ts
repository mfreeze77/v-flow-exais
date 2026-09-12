import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { examplePath } from "@hyperframes/diagram-engine";
import { migrateRelationshipIds } from "@hyperframes/project-model";
import { editorPreviewFixture } from "../../project-model/src/editorPreview.fixture";
import { compileProject } from "./compiler";

function source() {
  const value = editorPreviewFixture().snapshot;
  value.sources.diagram = migrateRelationshipIds(
    JSON.parse(readFileSync(examplePath("web-app.architecture.json"), "utf8")),
    "architecture",
  ).source;
  value.sources.title =
    '<!doctype html><html><head><script src="assets/gsap.min.js"></script></head><body><div id="title" data-composition-id="title" data-width="1280" data-height="720" data-start="0" data-duration="2.5025"><h1>Native title</h1><script>window.__timelines={title:gsap.timeline({paused:true}).to({},{duration:2.5025})};</script></div></body></html>';
  return value;
}

describe("AFM-060 emitted scene/authoring mapping", () => {
  it("records actual emitted filenames and does not mutate authored native content", async () => {
    const snapshot = source();
    const before = JSON.stringify(snapshot);
    const result = await compileProject(snapshot);
    const bindings = result.receipt.sceneBindings as any[];
    assert.equal(bindings.length, 3);
    for (const binding of bindings) {
      assert.ok(Object.hasOwn(result.files, binding.outputPath));
      assert.ok(
        result.files["index.html"]!.includes(`data-composition-src="${binding.outputPath}"`),
      );
      assert.ok(result.files["index.html"]!.includes(`data-vflow-scene-id="${binding.sceneId}"`));
    }
    assert.equal(result.files[bindings[0].outputPath], snapshot.sources.title);
    assert.equal(JSON.stringify(snapshot), before);
  });
  it("retains one document identity for two independently emitted appearances", async () => {
    const result = await compileProject(source());
    const bindings = result.receipt.sceneBindings as any[];
    assert.equal(bindings[1].documentId, bindings[2].documentId);
    assert.notEqual(bindings[1].outputPath, bindings[2].outputPath);
    assert.notEqual(bindings[1].sceneId, bindings[2].sceneId);
    assert.equal(bindings[1].editOwner, "diagram-command");
  });
});
