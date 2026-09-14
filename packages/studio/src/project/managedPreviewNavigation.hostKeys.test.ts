import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { managedNativeSourceMap } from "./managedPreviewNavigation";
import { navigationFixture, laterNavigationFixture } from "./managedPreviewNavigation.fixture";

describe("native source mappings include the player's scoped identity", () => {
  it("maps each repeated native hostKey to its authoring path", () => {
    const session = navigationFixture(),
      map = managedNativeSourceMap(session);
    const native = session.scenes.filter((s) => s.kind === "native");
    assert.equal(native.length, 2);
    for (const scene of native) assert.equal(map.get(scene.hostKey), scene.sourcePath);
    assert.notEqual(native[0]!.hostKey, native[1]!.hostKey);
  });
  it("keeps all existing native tokens as compatibility aliases", () => {
    const session = navigationFixture(),
      map = managedNativeSourceMap(session);
    for (const scene of session.scenes.filter((s) => s.kind === "native"))
      for (const key of [scene.renderId, scene.hostId, scene.hostCompositionId, scene.outputPath])
        assert.equal(map.get(key), scene.sourcePath);
  });
  it("does not place diagram generated output in native authoring resolution", () => {
    const session = navigationFixture(),
      map = managedNativeSourceMap(session);
    for (const scene of session.scenes.filter((s) => s.kind === "diagram"))
      for (const key of [scene.hostKey, scene.hostId, scene.outputPath, scene.renderId])
        assert.equal(map.has(key), false);
  });
  it("returns an owned map, not mutable shared state across builds", () => {
    const first = managedNativeSourceMap(navigationFixture());
    first.clear();
    assert.ok(managedNativeSourceMap(laterNavigationFixture()).size > 0);
  });
});
