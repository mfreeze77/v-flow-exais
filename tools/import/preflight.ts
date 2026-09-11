/**
 * AFM-001 — Preflight the two raw source inputs.
 *
 * Accepts a downloaded folder or a ZIP for each repository, resolves the real
 * source root by sentinel files rather than by folder name, hashes every entry
 * by raw bytes, and compares the result against the pinned baseline inventory.
 *
 * Invariants this module upholds:
 *   - Inputs are never modified, extracted to disk, installed, or executed.
 *   - No Git command, package install, lifecycle hook or network request runs.
 *   - Drift is reported, never silently accepted as a new baseline.
 *   - A ZIP comment revision string is recorded as an UNVERIFIED candidate.
 *     Upstream Git history is not present, so it can never be promoted to a
 *     verified commit here.
 *
 * This is a library: it does not read process.argv, write files it was not
 * asked to write, or terminate the process. See preflight-cli.ts.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, readlinkSync, lstatSync, statSync } from "node:fs";
import { resolve, relative, join, sep } from "node:path";

import { openZip, ZipError } from "./zip.ts";

/** Inspection bounds. A source input outside these is reviewed, not scanned. */
export const MAX_FILES = 100_000;
export const MAX_TOTAL_BYTES = 2 * 1024 ** 3;
export const MAX_FILE_BYTES = 512 * 1024 ** 2;

/**
 * Entries excluded from identity comparison. These are environment artifacts,
 * not source: a fresh download has no .git or node_modules, and their presence
 * must not read as drift.
 */
export const ADMIN_NAMES = new Set([".git", "node_modules", ".DS_Store", "__MACOSX"]);

/**
 * Files that identify a source root. Names are not evidence — a folder called
 * "archify-main" may be anything — so the root is the directory that actually
 * contains these.
 */
export const SENTINELS: Record<RepositoryName, readonly string[]> = {
  archify: ["archify/package.json", "archify/schemas/architecture.schema.json"],
  hyperframes: ["package.json", "packages/producer/package.json", "packages/studio/src/App.tsx"],
};

export type RepositoryName = "archify" | "hyperframes";
export type EntryKind = "file" | "symlink";

export class PreflightError extends Error {}

export interface InventoryEntry {
  path: string;
  kind: EntryKind;
  sha256: string;
  size: number;
}

export interface BaselineEntry extends InventoryEntry {
  repository: RepositoryName;
}

export interface ScanResult {
  inputType: "folder" | "zip";
  resolvedRoot: string;
  entries: InventoryEntry[];
  excludedAdminEntries: string[];
  archiveCommentRevisionCandidate: string | null;
}

export interface ComparisonResult {
  matchesBaseline: boolean;
  filesChecked: number;
  missing: string[];
  extra: string[];
  changed: Array<{
    path: string;
    fields: string[];
    expected: InventoryEntry;
    actual: InventoryEntry;
  }>;
  caseCollisions: string[][];
  treeContentSha256: string;
}

export type RepositoryReport = Omit<ScanResult, "entries"> & ComparisonResult & { input: string };

export interface PreflightReport {
  status: "PASS" | "DRIFT_REQUIRES_REVIEW" | "ERROR";
  scope: string;
  inputsMutated: false;
  upstreamCommitVerification: "not_performed";
  repositories: Partial<Record<RepositoryName, RepositoryReport>>;
  /**
   * Inputs accepted from inside the output repository under the declared
   * quarantine exemption. Empty for a conventional sibling-folder layout.
   * Recorded so an in-place build is always visible in the provenance trail.
   */
  quarantinedInputs: string[];
  errors: string[];
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function entry(path: string, kind: EntryKind, digest: string, size: number): InventoryEntry {
  return { path, kind, sha256: digest, size };
}

/**
 * Rejects archive names that would escape the extraction root or confuse path
 * handling. Preflight never extracts, but an input carrying such a name is
 * unsafe to import later and is refused now rather than at import time.
 */
export function safeName(name: string): string {
  if (!name || name.includes("\\") || name.includes("\0")) {
    throw new PreflightError(`Unsafe archive entry name: ${JSON.stringify(name)}`);
  }
  const parts = name.split("/");
  if (name.startsWith("/") || parts.includes("..") || (parts[0] && parts[0].includes(":"))) {
    throw new PreflightError(`Escaping/absolute archive entry: ${JSON.stringify(name)}`);
  }
  return parts.filter((p, i) => p !== "" || i === parts.length - 1).join("/");
}

function hasAdminComponent(relPath: string): boolean {
  return relPath.split("/").some((part) => ADMIN_NAMES.has(part));
}

// ── ZIP inputs ───────────────────────────────────────────────────────────────

export function scanZip(buf: Buffer, repository: RepositoryName): ScanResult {
  const archive = openZip(buf);
  const files = archive.entries.filter((e) => !e.isDirectory);

  const totalDeclared = files.reduce((sum, e) => sum + e.uncompressedSize, 0);
  if (files.length > MAX_FILES || totalDeclared > MAX_TOTAL_BYTES) {
    throw new PreflightError("Archive exceeds inspection limits");
  }

  const names = files.map((e) => safeName(e.name));
  if (new Set(names).size !== names.length) {
    throw new PreflightError("Duplicate normalized archive entries");
  }

  const prefix = resolveArchivePrefix(names, repository);
  const entries: InventoryEntry[] = [];
  const excluded: string[] = [];
  let total = 0;

  for (const [index, file] of files.entries()) {
    const name = names[index]!;
    if (prefix && !name.startsWith(prefix)) {
      throw new PreflightError(`Entry outside identified source root: ${name}`);
    }
    const rel = name.slice(prefix.length);
    if (hasAdminComponent(rel)) {
      excluded.push(rel);
      continue;
    }
    if (file.uncompressedSize > MAX_FILE_BYTES) {
      throw new PreflightError(`Entry exceeds file limit: ${rel}`);
    }
    if ((file.flags & 1) !== 0) {
      throw new PreflightError(`Encrypted entry unsupported: ${rel}`);
    }

    const data = archive.read(file);
    total += data.length;
    if (total > MAX_TOTAL_BYTES) {
      throw new PreflightError("Actual decoded bytes exceed total limit");
    }
    // A symlink entry's content IS its target path; hash those bytes, matching
    // how the folder scanner treats a link.
    entries.push(entry(rel, file.isSymlink ? "symlink" : "file", sha256(data), data.length));
  }

  return {
    inputType: "zip",
    resolvedRoot: prefix.replace(/\/$/, ""),
    entries,
    excludedAdminEntries: excluded,
    archiveCommentRevisionCandidate: archive.comment,
  };
}

/**
 * A GitHub download wraps the tree in a single directory; a hand-made archive
 * may not. Accept either, but require exactly one unambiguous match so a ZIP
 * containing two candidate roots is reviewed rather than guessed at.
 */
function resolveArchivePrefix(names: string[], repository: RepositoryName): string {
  const sentinels = SENTINELS[repository];
  const nameSet = new Set(names);
  if (sentinels.every((s) => nameSet.has(s))) return "";

  const roots = new Set(names.filter((n) => n.includes("/")).map((n) => n.split("/", 1)[0]!));
  const matches = [...roots]
    .map((r) => `${r}/`)
    .filter((p) => sentinels.every((s) => nameSet.has(p + s)));

  if (matches.length !== 1) {
    throw new PreflightError(`Cannot identify exactly one ${repository} source root`);
  }
  return matches[0]!;
}

// ── Folder inputs ────────────────────────────────────────────────────────────

function isSentinelRoot(root: string, repository: RepositoryName): boolean {
  return SENTINELS[repository].every((s) => {
    try {
      const stats = lstatSync(join(root, s));
      return stats.isFile();
    } catch {
      return false;
    }
  });
}

export function discoverFolder(path: string, repository: RepositoryName): string {
  if (isSentinelRoot(path, repository)) return path;

  const candidates: string[] = [];
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    try {
      const stats = lstatSync(child);
      if (!stats.isDirectory() || stats.isSymbolicLink()) continue;
    } catch {
      continue;
    }
    if (isSentinelRoot(child, repository)) candidates.push(child);
  }

  if (candidates.length !== 1) {
    throw new PreflightError(`Cannot identify exactly one ${repository} folder under ${path}`);
  }
  return candidates[0]!;
}

export function scanFolder(path: string, repository: RepositoryName): ScanResult {
  const root = discoverFolder(resolve(path), repository);
  const entries: InventoryEntry[] = [];
  const excluded: string[] = [];
  let total = 0;

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const rel = relative(root, full).split(sep).join("/");
      const stats = lstatSync(full);

      if (ADMIN_NAMES.has(name)) {
        excluded.push(stats.isDirectory() && !stats.isSymbolicLink() ? `${rel}/` : rel);
        continue;
      }

      if (stats.isSymbolicLink()) {
        // Never follow the link: record the target string itself, so a link is
        // identity-compared as a link rather than as a copy of its target.
        const target = Buffer.from(readlinkSync(full), "utf8");
        entries.push(entry(rel, "symlink", sha256(target), target.length));
        continue;
      }

      if (stats.isDirectory()) {
        walk(full);
        continue;
      }

      if (!stats.isFile()) {
        throw new PreflightError(`Special non-file entry unsupported: ${rel}`);
      }
      if (statSync(full).size > MAX_FILE_BYTES) {
        throw new PreflightError(`File too large: ${rel}`);
      }

      const data = readFileSync(full);
      total += data.length;
      if (total > MAX_TOTAL_BYTES) {
        throw new PreflightError("Folder exceeds total inspection limit");
      }
      entries.push(entry(rel, "file", sha256(data), data.length));

      if (entries.length > MAX_FILES) {
        throw new PreflightError("Folder exceeds file-count limit");
      }
    }
  };

  walk(root);

  return {
    inputType: "folder",
    resolvedRoot: root,
    entries,
    excludedAdminEntries: excluded,
    archiveCommentRevisionCandidate: null,
  };
}

// ── Comparison ───────────────────────────────────────────────────────────────

/**
 * Tree digest, matching the pinned baseline's documented algorithm:
 *   sha256(concat sorted path + NUL + kind + NUL + raw_file_sha256 + LF)
 * Size is deliberately excluded — content and type define identity.
 */
export function treeContentSha256(entries: InventoryEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const text = sorted.map((e) => `${e.path}\0${e.kind}\0${e.sha256}\n`).join("");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function compareInventory(
  actual: InventoryEntry[],
  expected: InventoryEntry[],
): ComparisonResult {
  const actualByPath = new Map(actual.map((e) => [e.path, e]));
  if (actualByPath.size !== actual.length) {
    throw new PreflightError("Duplicate actual paths");
  }
  const expectedByPath = new Map(expected.map((e) => [e.path, e]));

  const changed: ComparisonResult["changed"] = [];
  for (const path of [...actualByPath.keys()].sort()) {
    const a = actualByPath.get(path)!;
    const e = expectedByPath.get(path);
    if (!e) continue;
    const fields = (["kind", "sha256", "size"] as const).filter((f) => a[f] !== e[f]);
    if (fields.length > 0) changed.push({ path, fields: [...fields], expected: e, actual: a });
  }

  const missing = [...expectedByPath.keys()].filter((p) => !actualByPath.has(p)).sort();
  const extra = [...actualByPath.keys()].filter((p) => !expectedByPath.has(p)).sort();

  // Reviewed even where the filesystem permits them: two paths differing only
  // by case survive a case-sensitive checkout and collide on Windows/macOS.
  const folds = new Map<string, string[]>();
  for (const path of actualByPath.keys()) {
    const key = path.toLowerCase();
    const bucket = folds.get(key);
    if (bucket) bucket.push(path);
    else folds.set(key, [path]);
  }
  const caseCollisions = [...folds.values()].filter((v) => v.length > 1);

  return {
    matchesBaseline:
      missing.length === 0 &&
      extra.length === 0 &&
      changed.length === 0 &&
      caseCollisions.length === 0,
    filesChecked: actual.length,
    missing,
    extra,
    changed,
    caseCollisions,
    treeContentSha256: treeContentSha256(actual),
  };
}

// ── Orchestration ────────────────────────────────────────────────────────────

function isInside(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && rel !== "");
}

export interface PreflightOptions {
  archify: string;
  hyperframes: string;
  /** Baseline entries, normally provenance/SOURCE_INVENTORY.json's `entries`. */
  baseline: BaselineEntry[];
  /**
   * The output repository root. A source input resolving inside it — or a
   * destination nested inside a source — is refused: the product must never be
   * built into, or out of, an input tree.
   */
  destination?: string;
  /**
   * Declared quarantine directory for inputs that deliberately live inside the
   * output repository (an in-place build). AFM-001 otherwise rejects a source
   * root nested inside the destination; see
   * docs/designs/in-place-source-quarantine.md for why this narrow exemption
   * preserves that rule's intent rather than weakening it.
   *
   * The exemption is recorded in the report. It is never inferred: an input
   * inside the destination and outside this path is still refused.
   */
  quarantine?: string;
  /** Optional report path, refused if it would land inside a source input. */
  out?: string;
}

export function preflight(options: PreflightOptions): PreflightReport {
  const repositories: PreflightReport["repositories"] = {};
  const quarantined: string[] = [];
  const errors: string[] = [];
  let status: PreflightReport["status"];

  try {
    for (const repository of ["archify", "hyperframes"] as const) {
      const input = resolve(options[repository]);
      const stats = (() => {
        try {
          return statSync(input);
        } catch {
          throw new PreflightError(`Input does not exist: ${input}`);
        }
      })();

      if (options.destination) {
        const destination = resolve(options.destination);
        if (isInside(input, destination)) {
          // Permitted only from inside the explicitly declared quarantine.
          if (!options.quarantine || !isInside(input, resolve(options.quarantine))) {
            throw new PreflightError(
              `Source input must not live inside the output repository: ${input}`,
            );
          }
          quarantined.push(input);
        }
        if (stats.isDirectory() && isInside(destination, input)) {
          // Never exempt: building the product inside an input tree would put
          // the output at risk of being treated as source on the next import.
          throw new PreflightError(
            `Output repository must not live inside a source input: ${destination}`,
          );
        }
      }

      if (options.out) {
        const out = resolve(options.out);
        if (out === input || (stats.isDirectory() && isInside(out, input))) {
          throw new PreflightError(
            "Report output must not overwrite or be written inside source inputs",
          );
        }
      }

      const scan = stats.isDirectory()
        ? scanFolder(input, repository)
        : scanZip(readFileSync(input), repository);

      const { entries, ...rest } = scan;
      const expected = options.baseline.filter((e) => e.repository === repository);
      repositories[repository] = { input, ...rest, ...compareInventory(entries, expected) };
    }

    status = Object.values(repositories).every((r) => r.matchesBaseline)
      ? "PASS"
      : "DRIFT_REQUIRES_REVIEW";
  } catch (error) {
    if (
      error instanceof PreflightError ||
      error instanceof ZipError ||
      error instanceof RangeError ||
      (error as NodeJS.ErrnoException)?.code !== undefined
    ) {
      errors.push((error as Error).message);
      status = "ERROR";
    } else {
      throw error;
    }
  }

  return {
    status,
    scope: "Read-only source identity check; not an application build or safety certification",
    inputsMutated: false,
    upstreamCommitVerification: "not_performed",
    repositories,
    quarantinedInputs: quarantined,
    errors,
  };
}

export interface UpstreamLockRepository {
  input: string;
  inputType: "folder" | "zip";
  resolvedRoot: string;
  filesChecked: number;
  treeContentSha256: string;
  matchesBaseline: boolean;
  /**
   * A revision-like string lifted from the archive comment. Upstream Git
   * history is not present in these inputs, so this stays a candidate.
   */
  archiveCommentRevisionCandidate: string | null;
  /** Only an independent check against upstream may ever set this. */
  independentlyVerifiedCommit: null;
  gitHistoryIncluded: false;
}

export interface UpstreamLock {
  generatedBy: string;
  status: PreflightReport["status"];
  upstreamCommitVerification: "not_performed";
  note: string;
  repositories: Record<string, UpstreamLockRepository>;
}

/**
 * Distils a preflight report into the durable provenance record that import
 * tickets pin against. Records what was actually observed; never asserts an
 * upstream commit.
 */
export function buildUpstreamLock(report: PreflightReport): UpstreamLock {
  const repositories: Record<string, UpstreamLockRepository> = {};
  for (const [name, r] of Object.entries(report.repositories)) {
    if (!r) continue;
    repositories[name] = {
      input: r.input,
      inputType: r.inputType,
      resolvedRoot: r.resolvedRoot,
      filesChecked: r.filesChecked,
      treeContentSha256: r.treeContentSha256,
      matchesBaseline: r.matchesBaseline,
      archiveCommentRevisionCandidate: r.archiveCommentRevisionCandidate,
      independentlyVerifiedCommit: null,
      gitHistoryIncluded: false,
    };
  }
  return {
    generatedBy: "tools/import/preflight.ts",
    status: report.status,
    upstreamCommitVerification: "not_performed",
    note:
      "Archive comment revision strings are unverified candidates. These inputs carry no " +
      "upstream Git history, so no commit may be marked verified from this record alone.",
    repositories,
  };
}
