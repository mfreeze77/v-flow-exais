// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFileManager } from "./useFileManager";
import { createJournalWriter } from "../project/projectJournalProtocol";
const captured = vi.hoisted(() => ({ editorSave: null as any }));
vi.mock("../project/useProjectReadClient", () => ({ useProjectReadClient: () => null }));
vi.mock("./useFileTree", () => ({
  useFileTree: () => ({
    projectDir: null,
    fileTree: [],
    setFileTree: () => {},
    fileTreeLoaded: true,
    refreshFileTree: async () => {},
    compositions: [],
    assets: [],
    fontAssets: [],
  }),
}));
vi.mock("./useEditorSave", () => ({
  useEditorSave: (options: any) => {
    captured.editorSave = options;
    return {
      saveRafRef: { current: null },
      handleContentChange: () => {},
      flushPendingSave: async () => ({ status: "clean" }),
      discardPendingSave: () => {},
      getPendingCandidate: () => null,
    };
  },
}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
async function mount(managed = true) {
  const commitEdit = vi.fn(async () => [] as string[]);
  const writer = createJournalWriter({ owner: "project-journal", projectId: "p", commitEdit });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  let manager!: ReturnType<typeof useFileManager>;
  const Host = () => {
    manager = useFileManager({
      projectId: "p",
      journalWriter: managed ? writer : undefined,
      showToast: () => {},
      recordEdit: async () => {},
      domEditSaveTimestampRef: { current: 0 },
      setRefreshKey: () => {},
    });
    return null;
  };
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root!.render(createElement(Host)));
  return { manager, writer, fetch, commitEdit };
}
it("the returned writer is exactly the session capability", async () => {
  const h = await mount();
  expect(h.manager.writeProjectFile).toBe(h.writer);
  expect(h.fetch).not.toHaveBeenCalled();
});
it("internal source-save plumbing receives the same writer, not the raw native callback", async () => {
  const h = await mount();
  expect(captured.editorSave.writeProjectFile).toBe(h.writer);
});
it.each([
  ["create-file", (m: ReturnType<typeof useFileManager>) => m.handleCreateFile("x.html")],
  ["create-folder", (m: ReturnType<typeof useFileManager>) => m.handleCreateFolder("x")],
  ["delete", (m: ReturnType<typeof useFileManager>) => m.handleDeleteFile("x.html")],
  ["rename", (m: ReturnType<typeof useFileManager>) => m.handleRenameFile("x.html", "y.html")],
  ["duplicate", (m: ReturnType<typeof useFileManager>) => m.handleDuplicateFile("x.html")],
  [
    "upload",
    (m: ReturnType<typeof useFileManager>) => m.uploadProjectFiles([new File(["x"], "x.png")]),
  ],
] as const)("blocks unadapted %s before any HTTP mutation", async (_name, action) => {
  const h = await mount();
  await expect(action(h.manager)).rejects.toThrow("unsupported-operation");
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.commitEdit).not.toHaveBeenCalled();
});
it("native mode still supplies its own writer to source-save plumbing", async () => {
  const h = await mount(false);
  expect(h.manager.writeProjectFile).not.toBe(h.writer);
  expect(captured.editorSave.writeProjectFile).toBe(h.manager.writeProjectFile);
});
