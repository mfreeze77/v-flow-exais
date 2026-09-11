import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { safeSourceFile } from "./repositoryIntake";

export interface GitTreeFile {
  path: string;
  mode: string;
  type: string;
  oid: string;
  bytes: number | null;
}
export interface GitFileChange {
  path: string;
  status: "added" | "removed" | "modified";
  before?: GitTreeFile;
  head?: GitTreeFile;
  classifications: ("content" | "mode" | "type")[];
}
export function reviewError(code: string, message: string) {
  return Object.assign(new Error(message), { code: `review/${code}` });
}

/** Read Git objects asynchronously. No checkout, textconv, hooks or source execution. */
export function readGit(root: string, args: string[], input?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "git",
      [
        "--no-optional-locks",
        "--no-replace-objects",
        "-c",
        `safe.directory=${root}`,
        "-c",
        "core.hooksPath=/dev/null",
        "-C",
        root,
        ...args,
      ],
      {
        encoding: "buffer",
        timeout: 30_000,
        maxBuffer: 40_000_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1" },
      },
      (error, stdout) =>
        error
          ? reject(
              reviewError(
                "source-unavailable",
                "The requested local Git objects could not be read. Verify the repository and revisions are available locally.",
              ),
            )
          : resolve(stdout),
    );
    child.stdin?.on("error", () => {
      /* The process callback reports a failed read. */
    });
    child.stdin?.end(input);
  });
}

export async function pinGitRevision(root: string, ref: string, expected?: string) {
  if (
    typeof ref !== "string" ||
    !ref.length ||
    ref.length > 256 ||
    [...ref].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  )
    throw reviewError("revision-invalid", "Supply a local Git revision.");
  const sha = (
    await readGit(root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])
  )
    .toString()
    .trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha))
    throw reviewError("revision-invalid", "Git did not resolve a complete commit identity.");
  if (expected !== undefined && expected !== sha)
    throw reviewError(
      "revision-conflict",
      "The selected revision changed. Refresh the commit selection before comparing.",
    );
  return sha;
}

export async function assertGitRoot(root: string) {
  const top = (await readGit(root, ["rev-parse", "--show-toplevel"])).toString().trim();
  if (realpathSync(top) !== realpathSync(root))
    throw reviewError("repository-root", "Select the repository root, not a subdirectory.");
}

export async function readGitTree(root: string, revision: string): Promise<GitTreeFile[]> {
  const raw = await readGit(root, ["ls-tree", "-r", "-l", "-z", "--full-tree", revision]);
  if (!Buffer.from(raw.toString(), "utf8").equals(raw))
    throw reviewError(
      "path-encoding",
      "This repository has paths that cannot be represented as UTF-8.",
    );
  return raw
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d+) (\w+) ([a-f0-9]+) +([\d-]+)\t([\s\S]+)$/.exec(record);
      if (!match) throw reviewError("tree-invalid", "Git returned an unreadable tree entry.");
      return {
        mode: match[1]!,
        type: match[2]!,
        oid: match[3]!,
        bytes: match[4] === "-" ? null : Number(match[4]),
        path: match[5]!,
      };
    });
}

export function compareGitTrees(before: GitTreeFile[], head: GitTreeFile[]): GitFileChange[] {
  const old = new Map(before.map((file) => [file.path, file]));
  const next = new Map(head.map((file) => [file.path, file]));
  return [...new Set([...old.keys(), ...next.keys()])].sort().flatMap<GitFileChange>((path) => {
    const base = old.get(path),
      current = next.get(path);
    if (!base)
      return [
        { path, status: "added" as const, head: current, classifications: ["content" as const] },
      ];
    if (!current)
      return [
        { path, status: "removed" as const, before: base, classifications: ["content" as const] },
      ];
    if (base.oid === current.oid && base.mode === current.mode) return [];
    const classifications: GitFileChange["classifications"] = [];
    if (base.oid !== current.oid) classifications.push("content");
    if (base.mode !== current.mode) classifications.push("mode");
    if (base.type !== current.type) classifications.push("type");
    return [{ path, status: "modified" as const, before: base, head: current, classifications }];
  });
}

const capturablePath = (path: string) =>
  safeSourceFile(path) &&
  ![...path].some(
    (char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "\\" || char === ":",
  ) &&
  path.split("/").every((part) => part && part !== "." && part !== "..");

export async function readSnapshotBlobs(root: string, tree: GitTreeFile[]) {
  const selected: GitTreeFile[] = [];
  const omitted: { path: string; reason: string }[] = [];
  let total = 0;
  for (const file of tree) {
    let reason = "";
    if (!capturablePath(file.path)) reason = "Excluded by source capture policy.";
    else if (file.type !== "blob" || !["100644", "100755"].includes(file.mode))
      reason = "Symlinks and submodules are not followed.";
    else if (
      file.bytes === null ||
      file.bytes > 512_000 ||
      total + file.bytes > 32_000_000 ||
      selected.length >= 10_000
    )
      reason = "Source capture limit.";
    if (reason) {
      omitted.push({ path: file.path, reason });
      continue;
    }
    selected.push(file);
    total += file.bytes!;
  }
  const files = new Map<string, Buffer>();
  if (!selected.length) return { files, omitted };
  const raw = await readGit(
    root,
    ["cat-file", "--batch"],
    selected.map((file) => file.oid).join("\n") + "\n",
  );
  let cursor = 0;
  for (const file of selected) {
    const end = raw.indexOf(10, cursor);
    const header = raw.subarray(cursor, end).toString();
    if (end < cursor || header !== `${file.oid} blob ${file.bytes}`)
      throw reviewError("blob-invalid", "Captured blob identity differs from the pinned tree.");
    cursor = end + 1;
    const bytes = raw.subarray(cursor, cursor + file.bytes!);
    if (bytes.length !== file.bytes || raw[cursor + file.bytes!] !== 10)
      throw reviewError("blob-invalid", "A pinned source blob was incomplete.");
    files.set(file.path, bytes);
    cursor += file.bytes! + 1;
  }
  if (cursor !== raw.length)
    throw reviewError("blob-invalid", "Unexpected bytes followed the pinned snapshot.");
  return { files, omitted };
}
