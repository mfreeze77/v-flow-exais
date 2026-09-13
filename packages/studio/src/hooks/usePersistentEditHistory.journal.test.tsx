// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePersistentEditHistory } from "./usePersistentEditHistory";
import { JournalStatusBanner } from "../project/JournalStatusBanner";
import { createJournalWriter } from "../project/projectJournalProtocol";
import type { JournalHistoryDelegate, JournalHistoryState } from "../project/journalHistoryTypes";
import * as storageModule from "../utils/editHistoryStorage";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
afterEach(async () => {
  await act(async () => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
function delegate() {
  let status: JournalHistoryState = Object.freeze({
    owner: "project-journal",
    projectId: "p",
    loaded: true,
    revision: 2,
    canUndo: true,
    canRedo: false,
    busy: false,
    uncertain: false,
    pendingCommandId: null,
    error: null,
    refreshError: null,
    commitSequence: 0,
  });
  const listeners = new Set<() => void>();
  const commitEdit = vi.fn(async () => [] as string[]);
  const authority: JournalHistoryDelegate = {
    owner: "project-journal",
    projectId: "p",
    writer: createJournalWriter({ owner: "project-journal", projectId: "p", commitEdit }),
    getSnapshot: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: vi.fn(async () => {}),
    commitEdit,
    undo: vi.fn(async () => ({ ok: true, label: "project change", requiresFullReload: true })),
    redo: vi.fn(async () => ({ ok: true, label: "project change", requiresFullReload: true })),
    retryPending: vi.fn(async () => ({ ok: true, requiresFullReload: true })),
    recordEdit: vi.fn(async () => {
      throw new Error("unowned-record");
    }),
    activate: () => () => {},
  };
  return {
    authority,
    listeners,
    update(patch: Partial<JournalHistoryState>) {
      status = Object.freeze({ ...status, ...patch });
      for (const listener of listeners) listener();
    },
  };
}
async function mountHook(authority?: JournalHistoryDelegate, projectId = "p", strict = false) {
  const storage = storageModule.createMemoryEditHistoryStorage();
  const get = vi.spyOn(storage, "get");
  const set = vi.spyOn(storage, "set");
  let value!: ReturnType<typeof usePersistentEditHistory>;
  const Host = () => {
    value = usePersistentEditHistory({ projectId, storage, journal: authority });
    return null;
  };
  const div = document.createElement("div");
  document.body.append(div);
  const root = createRoot(div);
  roots.push(root);
  await act(async () => {
    root.render(
      strict ? createElement(StrictMode, null, createElement(Host)) : createElement(Host),
    );
  });
  return {
    get,
    set,
    root,
    get value() {
      return value;
    },
  };
}

describe("native history hook delegates without constructing a second owner", () => {
  it("does not construct or load IndexedDB for a managed delegate", async () => {
    const factory = vi.spyOn(storageModule, "createIndexedDbEditHistoryStorage");
    const d = delegate();
    const h = await mountHook(d.authority);
    expect(factory).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
    expect(h.set).not.toHaveBeenCalled();
    expect(h.value.owner).toBe("project-journal");
    expect(h.value.canUndo).toBe(true);
  });
  it("undo ignores all legacy file callbacks", async () => {
    const d = delegate();
    const h = await mountHook(d.authority);
    const readFile = vi.fn(async () => "unexpected"),
      writeFile = vi.fn(async () => {});
    await act(async () => {
      await h.value.undo({ readFile, writeFile });
    });
    expect(d.authority.undo).toHaveBeenCalledTimes(1);
    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
  it("redo delegates without writing or saving native history", async () => {
    const d = delegate();
    const h = await mountHook(d.authority);
    await act(async () => {
      await h.value.redo({
        readFile: async () => {
          throw new Error("Legacy callback must not run");
        },
        writeFile: async () => {
          throw new Error("Legacy callback must not run");
        },
      });
    });
    expect(d.authority.redo).toHaveBeenCalledTimes(1);
    expect(h.set).not.toHaveBeenCalled();
  });
  it("a standalone record cannot append an independent undo entry", async () => {
    const d = delegate();
    const h = await mountHook(d.authority);
    await expect(h.value.recordEdit({ label: "Wrong", kind: "manual", files: {} })).rejects.toThrow(
      "unowned-record",
    );
    expect(h.set).not.toHaveBeenCalled();
    expect(h.value.state.undo).toHaveLength(0);
  });
  it("renders journal status updates without recreating snapshot objects on every read", async () => {
    const d = delegate();
    const h = await mountHook(d.authority);
    await act(async () => {
      d.update({ canUndo: false, canRedo: true, revision: 3 });
    });
    expect(h.value.canUndo).toBe(false);
    expect(h.value.canRedo).toBe(true);
    expect(h.value.journalState?.revision).toBe(3);
  });
  it("keeps history disabled while a managed action is busy or unknown", async () => {
    const d = delegate();
    const h = await mountHook(d.authority);
    await act(async () => {
      d.update({ busy: true });
    });
    expect(h.value.canUndo).toBe(false);
    await act(async () => {
      d.update({ loaded: false, busy: false, uncertain: true });
    });
    expect(h.value.canUndo).toBe(false);
  });
  it("rejects a delegate belonging to another project", async () => {
    const d = delegate();
    const h = await mountHook(d.authority, "other");
    expect(h.value.loaded).toBe(false);
    await expect(
      h.value.undo({ readFile: async () => "", writeFile: async () => {} }),
    ).rejects.toThrow("project-mismatch");
    expect(d.authority.undo).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });
  it("does not record an edit during Strict Mode mount/cleanup", async () => {
    const d = delegate();
    const h = await mountHook(d.authority, "p", true);
    expect(d.authority.recordEdit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
    await act(async () => h.root.unmount());
    roots.splice(roots.indexOf(h.root), 1);
    expect(d.listeners.size).toBe(0);
  });
  it("retains native history persistence when no delegate is supplied", async () => {
    const h = await mountHook();
    expect(h.value.owner).toBe("native-files");
    expect(h.get).toHaveBeenCalled();
    await act(async () => {
      await h.value.recordEdit({
        label: "Native",
        kind: "manual",
        files: { a: { before: "A", after: "B" } },
      });
    });
    expect(h.set).toHaveBeenCalled();
    expect(h.value.canUndo).toBe(true);
  });
});

describe("journal recovery panel", () => {
  async function panel(d: ReturnType<typeof delegate>) {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    roots.push(root);
    const onCommitted = vi.fn();
    await act(async () =>
      root.render(createElement(JournalStatusBanner, { authority: d.authority, onCommitted })),
    );
    return { onCommitted };
  }
  it("is absent when there is no journal error", async () => {
    await panel(delegate());
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
  it("retries the original action, never an automatic new mutation", async () => {
    const d = delegate();
    d.update({ loaded: false, uncertain: true, error: "ack lost" });
    const h = await panel(d);
    expect(d.authority.retryPending).not.toHaveBeenCalled();
    await act(async () => {
      (document.querySelector("button") as HTMLButtonElement).click();
    });
    expect(d.authority.retryPending).toHaveBeenCalledTimes(1);
    expect(d.authority.refresh).not.toHaveBeenCalled();
    expect(h.onCommitted).toHaveBeenCalledTimes(1);
  });
  it("offers explicit reload instead of retry after a known refusal", async () => {
    const d = delegate();
    d.update({ loaded: false, error: "revision conflict" });
    await panel(d);
    expect(document.body.textContent).toContain("Preserve or reconcile");
    await act(async () => {
      (document.querySelector("button") as HTMLButtonElement).click();
    });
    expect(d.authority.refresh).toHaveBeenCalledTimes(1);
    expect(d.authority.retryPending).not.toHaveBeenCalled();
  });
});
