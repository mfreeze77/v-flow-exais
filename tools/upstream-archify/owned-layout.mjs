/** Development/test path ownership for retained Archify contracts.
 * Never imports _sources, stages a second repository, or changes runtime resolution.
 * Fixture roots supplied by release/staging tests retain their own synthetic layout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ownedWorkspaceRoot = fileURLToPath(new URL("../../", import.meta.url));
const engineRoot = path.resolve(ownedWorkspaceRoot, "packages/diagram-engine");
let mapping;

function relativeName(parts) {
  if (!parts.length) return "";
  for (const part of parts) {
    if (typeof part !== "string" || part.includes("\\") || path.isAbsolute(part))
      throw new Error("owned-archify/invalid-path: use a relative archive path");
  }
  const value = path.posix.normalize(parts.join("/"));
  if (value === ".." || value.startsWith("../")) throw new Error("owned-archify/outside-root");
  return value === "." ? "" : value.replace(/\/$/, "");
}

/** Explicit import destinations. Missing data is never replaced by an old checkout. */
export function createOwnedArchifyResolver(root, entries) {
  const workspace = path.resolve(root);
  if (!Array.isArray(entries)) throw new Error("owned-archify/missing-import-map");
  const files = new Map();
  const allowed = ["packages/", "tools/", "docs/", "examples/", "licenses/", "provenance/"];
  for (const item of entries) {
    if (item.repository !== "archify") continue;
    const source = relativeName([item.sourcePath]);
    let target = relativeName([item.targetPath ?? item.initial_target]);
    // AFM-009-F1 moved the inherited nested npm lock after the initial import.
    // This is retained metadata, not the active workspace dependency authority.
    if (source === "archify/package-lock.json") target = "docs/upstream/archify/package-lock.json";
    if (!source || !allowed.some((prefix) => target.startsWith(prefix)))
      throw new Error(`owned-archify/invalid-import-entry: ${source}`);
    if (files.has(source)) throw new Error(`owned-archify/duplicate-source: ${source}`);
    files.set(source, target);
  }
  if (!files.size) throw new Error("owned-archify/empty-import-map");
  const directories = new Map([
    ["", ""],
    ["archify", "packages/diagram-engine"],
    ["archify/assets", "packages/diagram-viewer/assets"],
    ["scripts", "tools/upstream-archify"],
    ["docs", "docs/upstream/archify/docs"],
    ["examples", "examples/upstream-archify"],
    [".github", "docs/upstream/archify/automation/.github"],
  ]);
  return (...parts) => {
    const name = relativeName(parts);
    // Already-rebased references in partially migrated tests remain worktree paths.
    const ownedPrefixes = [
      "packages/",
      "tools/upstream-archify/",
      "docs/upstream/",
      "examples/upstream-archify/",
      "licenses/",
      "provenance/",
    ];
    let target = ownedPrefixes.some((prefix) => name.startsWith(prefix))
      ? name
      : (files.get(name) ?? directories.get(name));
    if (target === undefined) {
      // A directory is safe only when every imported child agrees on its destination.
      const candidates = new Set();
      for (const [source, destination] of files) {
        if (!source.startsWith(`${name}/`)) continue;
        const suffix = source.slice(name.length + 1);
        if (!destination.endsWith(`/${suffix}`))
          throw new Error(`owned-archify/split-directory: ${name}`);
        candidates.add(destination.slice(0, -suffix.length - 1));
      }
      if (candidates.size === 1) target = [...candidates][0];
      else if (candidates.size > 1) throw new Error(`owned-archify/split-directory: ${name}`);
    }
    if (target === undefined) {
      // New developer fixtures under a declared owned directory need not have
      // existed in the original import. The longest explicit prefix owns them.
      const owner = [...directories]
        .filter(([prefix]) => prefix && name.startsWith(`${prefix}/`))
        .sort((a, b) => b[0].length - a[0].length)[0];
      if (owner) target = `${owner[1]}/${name.slice(owner[0].length + 1)}`;
    }
    if (target === undefined) throw new Error(`owned-archify/unmapped-path: ${name}`);
    return path.resolve(workspace, target);
  };
}

function resolveOwned(...parts) {
  if (!mapping) {
    const input = JSON.parse(
      fs.readFileSync(path.join(ownedWorkspaceRoot, "provenance/import-map.json"), "utf8"),
    );
    mapping = createOwnedArchifyResolver(ownedWorkspaceRoot, input.entries);
  }
  return mapping(...parts);
}

export function ownedArchifyPath(root, ...parts) {
  // --root/temp fixtures intentionally exercise the upstream contract in isolation.
  if (path.resolve(root) !== path.resolve(ownedWorkspaceRoot)) return path.resolve(root, ...parts);
  return resolveOwned(...parts);
}

export function ownedSkillPath(root, ...parts) {
  if (path.resolve(root) !== engineRoot) return path.resolve(root, ...parts);
  for (const part of parts) {
    if (typeof part !== "string" || part.includes("\\") || path.isAbsolute(part))
      throw new Error("owned-archify/invalid-path: use a relative archive path");
  }
  const relative = path.posix.normalize(parts.join("/"));
  if (
    relative.startsWith("../diagram-viewer/") ||
    relative.startsWith("../../docs/upstream/") ||
    relative.startsWith("../../tools/upstream-archify/")
  )
    return path.resolve(root, relative);
  return resolveOwned("archify", ...parts);
}
