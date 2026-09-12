import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { sceneEmissionAddress } from "@hyperframes/project-model";
import {
  assertDisplayedManagedView,
  assertDisplayedPreview,
  createManagedPreviewNavigation,
  managedMasterTime,
  managedNativeSourceMap,
  previewFrameFromSeconds,
  previewSecondsFromFrame,
} from "./managedPreviewNavigation";
import { navigationFixture, laterNavigationFixture } from "./managedPreviewNavigation.fixture";

function ready() {
  const session = navigationFixture();
  const nav = createManagedPreviewNavigation(session.projectId);
  nav.publish(session);
  return { nav, session, token: nav.snapshot().token! };
}
function reordered() {
  const next = laterNavigationFixture();
  next.scenes = [next.scenes[2]!, next.scenes[1]!, next.scenes[0]!].map((s, i) => ({
    ...s,
    ...sceneEmissionAddress(s.sceneId, i),
    startFrame: i === 0 ? 0 : i === 1 ? 75 : 255,
  }));
  return next;
}

describe("AFM-059/060: managed navigation is pinned playback, never a writer", () => {
  it("constructs without native URLs or a render-time hostile-ID failure", () => {
    assert.equal(createManagedPreviewNavigation("../../hostile").snapshot().session, null);
    assert.deepEqual(createManagedPreviewNavigation("../../hostile").snapshot().levels, []);
  });
  it("opens the pinned master, not /api/projects/id/preview", () => {
    const { nav, session } = ready();
    assert.equal(
      nav.snapshot().levels[0]!.previewUrl,
      `/api/vflow/projects/nav-project/editor/previews/${session.buildHash}/view`,
    );
  });
  it("does not mutate the supplied authoring-derived binding data", () => {
    const session = navigationFixture(),
      before = structuredClone(session);
    const nav = createManagedPreviewNavigation(session.projectId);
    nav.publish(session);
    nav.open({ sceneId: "intro" }, nav.snapshot().token!);
    assert.deepEqual(session, before);
    assert.equal(Object.isFrozen(session), false);
  });
  it("snapshots are stable between updates and cannot be mutated by callers", () => {
    const { nav } = ready();
    assert.equal(nav.snapshot(), nav.snapshot());
    assert.throws(() => {
      nav.snapshot().session!.scenes[0]!.sourcePath = "oops";
    });
  });
  it("notifications stop after unsubscribe", () => {
    const { nav, token } = ready();
    let count = 0;
    const off = nav.subscribe(() => count++);
    nav.observe(1, token);
    off();
    nav.observe(2, token);
    assert.equal(count, 1);
  });
  it("repeated publication of the same build does not reset the view", () => {
    const { nav, session, token } = ready();
    nav.open({ sceneId: "intro" }, token);
    const before = nav.snapshot();
    nav.publish(structuredClone(session));
    assert.equal(nav.snapshot(), before);
  });
  it("equivalent object-key order is not a new build", () => {
    const { nav, session } = ready();
    const reorderedKeys = Object.fromEntries(Object.entries(session).reverse());
    const before = nav.snapshot();
    nav.publish(reorderedKeys as typeof session);
    assert.equal(nav.snapshot(), before);
  });
  it("rejects a different project's session without losing the valid preview", () => {
    const { nav } = ready();
    const before = nav.snapshot();
    assert.throws(
      () => nav.publish({ ...laterNavigationFixture(), projectId: "another" }),
      /another project/,
    );
    assert.equal(nav.snapshot(), before);
  });
  it("rejects publication of an older revision", () => {
    const { nav, session } = ready();
    nav.publish(laterNavigationFixture());
    const before = nav.snapshot();
    assert.throws(() => nav.publish(session), /older preview/);
    assert.equal(nav.snapshot(), before);
  });
  it("rejects two index hashes for one authoring revision", () => {
    const { nav, session } = ready();
    assert.throws(() => nav.publish({ ...session, revisionHash: "f".repeat(64) }), /two index/);
  });
  it("rejects changed authoring content under one revision", () => {
    const { nav, session } = ready();
    assert.throws(
      () => nav.publish({ ...session, authoringHash: "f".repeat(64) }),
      /different content/,
    );
  });
  it("accepts a different runtime build with the same authoring identity", () => {
    const { nav, session } = ready();
    nav.publish({ ...session, buildHash: "9".repeat(64) });
    assert.equal(nav.snapshot().session!.revision, 4);
  });
  it("selects either appearance of the same native document distinctly", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "intro" }, token);
    assert.equal(nav.snapshot().scene!.documentId, "title");
    nav.open({ sceneId: "outro" }, nav.snapshot().token!);
    assert.equal(nav.snapshot().scene!.documentId, "title");
    assert.equal(nav.snapshot().scene!.sceneId, "outro");
  });
  it("does not guess a repeated source path", () => {
    const { nav, token } = ready();
    assert.throws(() => nav.open({ sourcePath: "title.html" }, token), /exactly one/);
    assert.equal(nav.snapshot().scene, null);
  });
  it("resolves a unique authoring path", () => {
    const { nav, token } = ready();
    nav.open({ sourcePath: "system.architecture.json" }, token);
    assert.equal(nav.snapshot().scene!.sceneId, "flow");
  });
  it("resolves a render token only with its pinned provenance", () => {
    const { nav, token } = ready();
    nav.open(
      { renderToken: "el-2", buildHash: token.buildHash, revisionHash: token.revisionHash },
      token,
    );
    assert.equal(nav.snapshot().scene!.sceneId, "outro");
  });
  it("rejects a render token without its build provenance", () => {
    const { nav, token } = ready();
    assert.throws(() => nav.open({ renderToken: "el-0" }, token), /pinned preview/);
  });
  it("rejects contradictory scene and source identities", () => {
    const { nav, token } = ready();
    assert.throws(
      () => nav.open({ sceneId: "flow", sourcePath: "title.html" }, token),
      /exactly one/,
    );
  });
  it("rejects unknown generated paths instead of opening a native route", () => {
    const { nav, token } = ready();
    assert.throws(() => nav.open({ sourcePath: "scene-88-made-up.html" }, token), /exactly one/);
    assert.equal(nav.snapshot().levels.length, 1);
  });
  it("uses integer frame conversion at fractional fps", () => {
    const { nav, session, token } = ready();
    nav.observe(previewSecondsFromFrame(session, 100), token);
    nav.open({ sceneId: "flow" }, token);
    assert.equal(nav.snapshot().frame, 25);
    assert.equal(nav.snapshot().returnFrame, 100);
    assert.equal(managedMasterTime(nav.snapshot()), (100 * 1001) / 30000);
  });
  it("returns to the saved master position, including frame zero", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "flow" }, token);
    nav.observe(1, nav.snapshot().token!);
    nav.master(nav.snapshot().token!);
    assert.equal(nav.snapshot().frame, 0);
    assert.equal(nav.snapshot().scene, null);
  });
  it("keeps the saved master position when switching between scenes", () => {
    const { nav, token } = ready();
    nav.observe(1, token);
    const saved = nav.snapshot().frame;
    nav.open({ sceneId: "flow" }, token);
    nav.observe(2, nav.snapshot().token!);
    nav.open({ sceneId: "outro" }, nav.snapshot().token!);
    nav.master(nav.snapshot().token!);
    assert.equal(nav.snapshot().frame, saved);
  });
  it("opening the current scene is a no-op", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "flow" }, token);
    nav.observe(1, nav.snapshot().token!);
    const before = nav.snapshot();
    nav.open({ sceneId: "flow" }, before.token!);
    assert.equal(nav.snapshot(), before);
  });
  it("clamps seeks to the half-open master range", () => {
    const { nav, token } = ready();
    nav.seekMaster(1000, token);
    assert.equal(nav.snapshot().frame, 329);
  });
  it("clamps scene playback to the half-open scene range", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "flow" }, token);
    nav.observe(1000, nav.snapshot().token!);
    assert.equal(nav.snapshot().frame, 179);
  });
  it("an explicit master seek leaves standalone playback", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "flow" }, token);
    nav.seekMaster(0, nav.snapshot().token!);
    assert.equal(nav.snapshot().scene, null);
    assert.equal(nav.snapshot().frame, 0);
  });
  for (const value of [-1, NaN, Infinity, Number.MAX_VALUE])
    it(`rejects invalid playback time ${value}`, () => {
      const { nav, token } = ready();
      assert.throws(() => nav.observe(value, token));
      assert.equal(nav.snapshot().frame, 0);
    });
  it("rejects a timeupdate from the outgoing master", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "flow" }, token);
    const before = nav.snapshot();
    assert.throws(() => nav.observe(1, token), /obsolete/);
    assert.equal(nav.snapshot(), before);
  });
  it("rejects a late event from an earlier visit to the same URL", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "flow" }, token);
    const first = nav.snapshot().token!;
    nav.master(first);
    nav.open({ sceneId: "flow" }, nav.snapshot().token!);
    assert.throws(() => nav.observe(1, first), /obsolete/);
  });
  it("rejects old el-0 provenance after reorder instead of selecting the new el-0", () => {
    const { nav, token } = ready();
    nav.publish(reordered());
    assert.throws(
      () =>
        nav.open(
          { renderToken: "el-0", buildHash: token.buildHash, revisionHash: token.revisionHash },
          nav.snapshot().token!,
        ),
      /pinned preview/,
    );
  });
  it("keeps the same scene selected across reordering by identity", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "intro" }, token);
    nav.publish(reordered());
    assert.equal(nav.snapshot().scene!.sceneId, "intro");
    assert.equal(nav.snapshot().scene!.hostId, "el-2");
  });
  it("removed scene returns to master with an explicit notice", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "outro" }, token);
    const next = laterNavigationFixture();
    next.scenes.pop();
    next.durationFrames = 255;
    nav.publish(next);
    assert.equal(nav.snapshot().scene, null);
    assert.match(nav.snapshot().notice!, /removed or changed/);
  });
  it("repointing a stable scene to a different document does not silently select it", () => {
    const { nav, token } = ready();
    nav.open({ sceneId: "flow" }, token);
    const next = laterNavigationFixture();
    next.scenes[1]!.documentId = "another-diagram";
    nav.publish(next);
    assert.equal(nav.snapshot().scene, null);
    assert.ok(nav.snapshot().notice);
  });
  it("source maps expose native authoring, not diagram generated HTML", () => {
    const { session } = ready();
    const map = managedNativeSourceMap(session);
    assert.equal(map.get("slot-0"), "title.html");
    assert.equal(map.get("slot-2"), "title.html");
    assert.equal(map.has("slot-1"), false);
    assert.equal(map.has("scene-1-flow.html"), false);
    assert.equal(
      [...map.values()].some((v) => v.startsWith("scene-")),
      false,
    );
  });
  it("a source-map consumer cannot mutate the controller's data", () => {
    const { nav, session } = ready();
    managedNativeSourceMap(session).clear();
    assert.equal(managedNativeSourceMap(nav.snapshot().session!).size, 8);
  });
  it("converts exact fractional frame boundaries round-trip", () => {
    const { session } = ready();
    for (const frame of [0, 1, 74, 75, 100, 329])
      assert.equal(
        previewFrameFromSeconds(session, previewSecondsFromFrame(session, frame)),
        frame,
      );
  });
  it("checks displayed project/build/index metadata before handling NLE events", () => {
    const { token } = ready();
    const attrs = {
      "data-vflow-project-id": token.projectId,
      "data-vflow-build-hash": token.buildHash,
      "data-vflow-revision-hash": token.revisionHash,
    };
    const root = {
      getAttribute: (name: string) => (attrs as Record<string, string>)[name] ?? null,
    };
    assert.doesNotThrow(() => assertDisplayedPreview(root, token));
    assert.throws(
      () => assertDisplayedPreview(root, { ...token, buildHash: "f".repeat(64) }),
      /displayed preview/,
    );
    assert.throws(() => assertDisplayedPreview(null, token), /displayed preview/);
  });
  it("rejects a different scene at the same build address", () => {
    const { nav, token } = ready();
    const url = nav.snapshot().levels[0]!.previewUrl;
    const root = {
      getAttribute: (name: string) =>
        (
          ({
            "data-vflow-project-id": token.projectId,
            "data-vflow-build-hash": token.buildHash,
            "data-vflow-revision-hash": token.revisionHash,
          }) as Record<string, string>
        )[name] ?? null,
    };
    assert.doesNotThrow(() => assertDisplayedManagedView(root, token, `${url}?t=123`, url));
    assert.throws(
      () => assertDisplayedManagedView(root, token, `${url}?sceneId=intro`, url),
      /selected view/,
    );
  });
});
