// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useManagedJournalAuthority } from "./useManagedJournalAuthority";
import { setActiveManagedProjectId } from "./projectOwnership";
import { projectApi } from "./api";
vi.mock("./api", () => ({ projectApi: vi.fn() }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let value: ReturnType<typeof useManagedJournalAuthority>;
function Host({ id }: { id: string | null }) {
  value = useManagedJournalAuthority(id);
  return null;
}
function state(id: string) {
  return {
    canUndo: false,
    canRedo: false,
    snapshot: {
      manifest: {
        id,
        revision: 0,
        documents: [{ id: "title", path: "title.html", kind: "native", authoritative: true }],
      },
      sources: { title: "<h1>Title</h1>" },
    },
  };
}
beforeEach(() => {
  setActiveManagedProjectId(null);
  vi.clearAllMocks();
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = "";
  setActiveManagedProjectId(null);
});
it("does not fetch or validate native project names during render or mount", async () => {
  await act(async () => root!.render(createElement(Host, { id: "Name # with spaces/hostile" })));
  expect(value).toBeUndefined();
  expect(projectApi).not.toHaveBeenCalled();
});
it("loads managed state under Strict Mode without a mutation or render loop", async () => {
  setActiveManagedProjectId("p");
  vi.mocked(projectApi).mockResolvedValue(state("p"));
  await act(async () =>
    root!.render(createElement(StrictMode, null, createElement(Host, { id: "p" }))),
  );
  expect(value?.getSnapshot().loaded).toBe(true);
  expect(vi.mocked(projectApi).mock.calls.length).toBeGreaterThan(0);
  expect(vi.mocked(projectApi).mock.calls.length).toBeLessThan(4);
  expect(vi.mocked(projectApi).mock.calls.every((args) => args[1] === undefined)).toBe(true);
});
it("does not fall back to native authority while project identity is resolving", async () => {
  setActiveManagedProjectId("p");
  await act(async () => root!.render(createElement(Host, { id: null })));
  expect(value?.owner).toBe("project-journal");
  expect(value?.getSnapshot().loaded).toBe(false);
  expect(projectApi).not.toHaveBeenCalled();
});
it("deactivates the prior controller when projects switch", async () => {
  setActiveManagedProjectId("p");
  vi.mocked(projectApi).mockResolvedValue(state("p"));
  await act(async () => root!.render(createElement(Host, { id: "p" })));
  const prior = value!;
  setActiveManagedProjectId("q");
  vi.mocked(projectApi).mockResolvedValue(state("q"));
  await act(async () => root!.render(createElement(Host, { id: "q" })));
  expect(value?.projectId).toBe("q");
  await expect(prior.undo()).rejects.toThrow("inactive");
});
