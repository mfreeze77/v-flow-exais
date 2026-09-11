import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyProjectCommand } from "../commands";
import { projectFixture, renameCommand } from "../test-fixture";
import { canonicalJson, readCommittedProject, sha256 } from "./revisions";
import {
  commitWhileLocked,
  executeProjectCommand,
  initializeProject,
  type CommitFaultPoint,
} from "./commit";

const directories: string[] = [];
function directory() {
  const path = mkdtempSync(join(tmpdir(), "vflow revisions "));
  directories.push(path);
  return path;
}
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("AFM-019/020: real cross-process atomic filesystem revisions", () => {
  it("undoes and redoes source and presentation together after reopening without reusing revision numbers", async () => {
    const root = directory();
    await initializeProject(root, projectFixture());
    const command = renameCommand();
    command.operations.push({
      type: "set-scene-presentation",
      sceneId: "scene-one",
      presentation: {
        title: "Changed title",
        focusObjectIds: ["gateway"],
        relationshipIds: ["edge-a"],
      },
    });
    await executeProjectCommand(root, command);
    const changed = readCommittedProject(root).snapshot;
    const historyCommand = (type: "undo" | "redo", revision: number) => ({
      commandId: `${type}-${revision}`,
      projectId: "project-test",
      origin: "ui" as const,
      expectedRevision: revision,
      operations: [{ type }],
    });
    await executeProjectCommand(root, historyCommand("undo", 1));
    const restored = readCommittedProject(root);
    expect(restored.snapshot).toEqual({
      ...projectFixture(),
      manifest: { ...projectFixture().manifest, revision: 2 },
    });
    expect(restored.index.history?.redo).toHaveLength(1);
    await executeProjectCommand(root, historyCommand("redo", 2));
    expect(readCommittedProject(root).snapshot).toEqual({
      ...changed,
      manifest: { ...changed.manifest, revision: 3 },
    });
    await expect(executeProjectCommand(root, historyCommand("undo", 2))).rejects.toThrow(
      /current revision is 3/,
    );
    expect(readCommittedProject(root).snapshot.manifest.revision).toBe(3);
  });
  it("saves, reopens and replays a command once while rejecting a reused ID", async () => {
    const root = directory();
    await initializeProject(root, projectFixture());
    const first = await executeProjectCommand(root, renameCommand());
    expect(first.replayed).toBe(false);
    expect(readCommittedProject(root).snapshot.manifest.revision).toBe(1);
    expect(await executeProjectCommand(root, renameCommand())).toEqual({
      ...first,
      replayed: true,
    });
    const conflict = renameCommand();
    conflict.operations = [{ type: "set-project-title", title: "Different payload" }];
    await expect(executeProjectCommand(root, conflict)).rejects.toThrow(/idempotency-conflict/);
    expect(readCommittedProject(root).snapshot.manifest.revision).toBe(1);
  });

  it("accepts exactly one concurrent expected-revision write", async () => {
    const root = directory();
    await initializeProject(root, projectFixture());
    const results = await Promise.allSettled([
      executeProjectCommand(root, renameCommand("writer-a")),
      executeProjectCommand(root, renameCommand("writer-b")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(readCommittedProject(root).snapshot.manifest.revision).toBe(1);
  });

  it.each(["after-document", "after-staging", "before-pointer"] as CommitFaultPoint[])(
    "keeps the last complete revision after failure %s",
    async (point) => {
      const root = directory();
      await initializeProject(root, projectFixture());
      const command = renameCommand();
      const request = {
        snapshot: applyProjectCommand(projectFixture(), command),
        expectedRevision: 0,
        commandId: command.commandId,
        fingerprint: sha256(canonicalJson(command)),
      };
      expect(() =>
        commitWhileLocked(root, request, (phase) => {
          expect(readCommittedProject(root).snapshot).toEqual(projectFixture());
          if (phase === point) throw new Error("ENOSPC: injected storage failure");
        }),
      ).toThrow(/ENOSPC/);
      expect(readCommittedProject(root).snapshot).toEqual(projectFixture());
      await executeProjectCommand(root, command);
      expect(readCommittedProject(root).snapshot.manifest.revision).toBe(1);
    },
  );

  it("recognizes a committed command when its response was interrupted", async () => {
    const root = directory();
    await initializeProject(root, projectFixture());
    const command = renameCommand();
    expect(() =>
      commitWhileLocked(
        root,
        {
          snapshot: applyProjectCommand(projectFixture(), command),
          expectedRevision: 0,
          commandId: command.commandId,
          fingerprint: sha256(canonicalJson(command)),
        },
        (phase) => {
          if (phase === "after-pointer") throw new Error("response interrupted");
        },
      ),
    ).toThrow(/interrupted/);
    expect((await executeProjectCommand(root, command)).replayed).toBe(true);
    expect(readCommittedProject(root).snapshot.manifest.revision).toBe(1);
  });

  it("detects external source modification before returning a committed read", async () => {
    const root = directory();
    await initializeProject(root, projectFixture());
    const committed = readCommittedProject(root);
    const path = join(
      root,
      ".vflow/revisions",
      committed.pointer.directory,
      committed.index.sources["diagram-one"]!.path,
    );
    writeFileSync(path, readFileSync(path, "utf8").replace("Gateway", "Altered"));
    expect(() => readCommittedProject(root)).toThrow(/outside its committed revision/);
  });

  it("rejects revision-storage symlink escape without changing the target", async () => {
    const root = directory();
    const outside = directory();
    const sentinel = join(outside, "sentinel");
    writeFileSync(sentinel, "unchanged");
    symlinkSync(outside, join(root, ".vflow"));
    await expect(initializeProject(root, projectFixture())).rejects.toThrow(/Symlinks/);
    expect(readFileSync(sentinel, "utf8")).toBe("unchanged");
  });
});
