// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, vi } from "vitest";
import assert from "node:assert/strict";
import { useManagedStudioSurface, type ManagedStudioSurface } from "./useManagedStudioSurface";
import { managedStudioFixture } from "./managedStudio.fixture";
import type { JournalHistoryDelegate } from "./journalHistoryTypes";

const mocks = vi.hoisted(() => ({ view: vi.fn(), prepare: vi.fn() }));
vi.mock("./editorReadClient", () => ({ createManagedEditorReader: () => ({ view: mocks.view }) }));
vi.mock("./editorPreviewClient", () => ({
  createEditorPreviewClient: () => ({ prepare: mocks.prepare }),
}));
let host: HTMLDivElement, root: Root, latest: ManagedStudioSurface;
let f: ReturnType<typeof managedStudioFixture>;
const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
beforeEach(() => {
  flag.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  f = managedStudioFixture();
  mocks.view.mockReset().mockResolvedValue(f.view);
  mocks.prepare.mockReset().mockResolvedValue(f.preview);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
function authority() {
  let state = f.status;
  const listeners = new Set<() => void>();
  let commits = 0;
  // The unexercised members throw rather than being cast away. `as unknown as`
  // would let this mock drift from the delegate silently; a stub that throws
  // fails loudly if a test ever reaches a path it was never meant to cover.
  const unused = (name: string) => () => {
    throw new Error(`JournalHistoryDelegate.${name} is not exercised by this test`);
  };
  const journal: JournalHistoryDelegate = {
    owner: "project-journal",
    projectId: "project-test",
    getSnapshot: () => state,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    commitEdit: async () => {
      commits++;
      return [];
    },
    get writer(): never {
      return unused("writer")();
    },
    refresh: unused("refresh"),
    undo: unused("undo"),
    redo: unused("redo"),
    retryPending: unused("retryPending"),
    recordEdit: unused("recordEdit"),
    // The surface mounts the delegate, so activate() is genuinely called; it
    // returns the deactivate function React runs on cleanup.
    activate: () => () => {},
  };
  return {
    journal,
    commits: () => commits,
    set: (patch: Partial<typeof state>) => {
      state = { ...state, ...patch };
      for (const cb of listeners) cb();
    },
  };
}
function Harness({ journal, tick = 0 }: { journal?: JournalHistoryDelegate; tick?: number }) {
  latest = useManagedStudioSurface("project-test", journal, tick);
  return <div>{latest.error}</div>;
}
it("does not discover managed state for an ordinary native session", async () => {
  await act(async () => root.render(<Harness />));
  assert.equal(latest.enabled, false);
  assert.equal(mocks.view.mock.calls.length, 0);
});
it("captures one revision then does not re-fetch on unrelated rerender", async () => {
  const h = authority();
  await act(async () => root.render(<Harness journal={h.journal} />));
  assert.equal(latest.capture?.preview.buildHash, f.preview.buildHash);
  assert.equal(mocks.view.mock.calls.length, 1);
  await act(async () => root.render(<Harness journal={h.journal} />));
  assert.equal(mocks.view.mock.calls.length, 1);
});
it("keeps an explicit managed waiting mode before journal readiness", async () => {
  const h = authority();
  h.set({ loaded: false });
  await act(async () => root.render(<Harness journal={h.journal} />));
  assert.equal(latest.enabled, true);
  assert.equal(latest.navigation?.session, null);
  assert.equal(mocks.view.mock.calls.length, 0);
});
it("stale discovery does not prepare a different revision", async () => {
  const h = authority();
  mocks.view.mockResolvedValue({ ...f.view, revision: 99 });
  await act(async () => root.render(<Harness journal={h.journal} />));
  assert.equal(mocks.prepare.mock.calls.length, 0);
  assert(latest.error);
});
it("legacy writer capability rejects without reaching the real journal", async () => {
  const h = authority();
  await act(async () => root.render(<Harness journal={h.journal} />));
  assert(latest.blockedWriter);
  await assert.rejects(
    latest.blockedWriter.vflowProjectJournal.commitEdit({
      label: "bad",
      kind: "manual",
      files: {},
    }),
  );
  assert.equal(h.commits(), 0);
});
it("A to B to A increments visit identity even with the same source and build", async () => {
  const h = authority();
  await act(async () => root.render(<Harness journal={h.journal} />));
  await act(async () => latest.navigation!.onSceneChange!("title-scene", "title.html"));
  const first = latest.latest().sceneEpoch;
  await act(async () =>
    latest.navigation!.onSceneChange!("diagram-scene", "source.architecture.json"),
  );
  await act(async () => latest.navigation!.onSceneChange!("title-scene", "title.html"));
  assert(latest.latest().sceneEpoch > first);
  assert.equal(latest.sceneId, "title-scene");
});
it("a late old preparation cannot replace a newer capture", async () => {
  const h = authority();
  let resolveOld!: (value: typeof f.preview) => void;
  mocks.prepare.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await act(async () => root.render(<Harness journal={h.journal} />));
  const newer = { ...f.preview, buildHash: "f".repeat(64) };
  mocks.prepare.mockResolvedValue(newer);
  await act(async () => root.render(<Harness journal={h.journal} tick={1} />));
  await act(async () => resolveOld(f.preview));
  assert.equal(latest.capture?.preview.buildHash, newer.buildHash);
});
it("a failed refresh retains the last preview but reports failure", async () => {
  const h = authority();
  await act(async () => root.render(<Harness journal={h.journal} />));
  mocks.prepare.mockRejectedValue(new Error("build unavailable"));
  await act(async () => root.render(<Harness journal={h.journal} tick={1} />));
  assert.equal(latest.capture?.preview.buildHash, f.preview.buildHash);
  assert.match(latest.error!, /build unavailable/);
});
