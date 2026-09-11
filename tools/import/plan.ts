/**
 * AFM-002 — Complete source disposition and import ledger.
 *
 * Accounts for every entry in both source archives before anything is copied or
 * retired. Produces provenance/import-map.json: the owned, executable ledger
 * that the E01 import tickets act on.
 *
 * Modes are read from the ZIP central directory, not from the extracted folder.
 * A Windows or bind-mounted checkout does not carry unix permission bits, so
 * the archive is the only authoritative source for the executable bit — and
 * losing it would silently break the 28 scripts that rely on it.
 */

import { createHash } from "node:crypto";

import { openZip, type ZipEntry } from "./zip.ts";
import { ADMIN_NAMES, PreflightError, safeName, type RepositoryName } from "./preflight.ts";

/**
 * Every disposition the ledger recognises. An entry that matches none of these
 * is unclassified, which is a hard failure: silence is how a source file gets
 * dropped.
 */
export const DISPOSITIONS = [
  /** Becomes owned product source under packages/. */
  "retain-relocate-refactor-as-owned",
  /** Kept verbatim as upstream reference documentation. */
  "retain-reference-docs",
  /** Kept for history; not product source and not built. */
  "retain-historical-reference",
  /** Media needing a rights decision before release. */
  "rights-review-media",
  /** Font binaries needing a rights decision; never vendored blindly. */
  "rights-review-font-no-binary-in-ticket-pack",
  /** Agent/editor configuration reviewed before adoption. */
  "review-agent-configuration",
  /** Upstream CI/release automation quarantined, never inherited live. */
  "quarantine-automation",
  /** Build output. Rebuildable, never an authority for semantics. */
  "quarantine-generated-not-authority",
  /** License text preserved under licenses/. */
  "preserve-license",
  /** Symlink recorded as a link; never followed during import. */
  "review-symlink-do-not-follow",
] as const;

export type Disposition = (typeof DISPOSITIONS)[number];

/**
 * Dispositions whose entries must never be treated as authoritative product
 * source, regardless of where they land. A nested distribution archive
 * (archify/archify.zip) is the motivating case: it contains a second full copy
 * of the tree and would otherwise read as another source root.
 */
export const NON_AUTHORITATIVE: ReadonlySet<Disposition> = new Set([
  "quarantine-generated-not-authority",
  "quarantine-automation",
  "retain-historical-reference",
]);

/** Roots an import is permitted to write into. */
export const AUTHORIZED_TARGET_ROOTS = [
  "packages/",
  "docs/",
  "skills/",
  "registry/",
  "scripts/",
  "examples/",
  "tools/",
  "themes/",
  "assets/",
  "licenses/",
  "provenance/",
  ".agents/",
  ".github/",
] as const;

export interface ImportMapEntry {
  repository: RepositoryName;
  /** Path inside the source archive, relative to its resolved root. */
  sourcePath: string;
  /** Path inside this repository. */
  targetPath: string;
  kind: "file" | "symlink";
  size: number;
  sha256: string;
  /** Unix mode from the archive, e.g. "0o755". "0o0" when none was recorded. */
  mode: string;
  executable: boolean;
  disposition: Disposition;
  /** Tickets that act on this entry. */
  implementationOwners: string[];
  /** True when this entry may never be treated as authoritative source. */
  nonAuthoritative: boolean;
}

export interface ImportMap {
  generatedBy: string;
  scope: string;
  sourceBaseline: Record<string, { treeContentSha256: string; fileEntries: number }>;
  counts: {
    total: number;
    byRepository: Record<string, number>;
    byDisposition: Record<string, number>;
    executable: number;
    symlinks: number;
    nonAuthoritative: number;
  };
  entries: ImportMapEntry[];
}

export interface LedgerProblem {
  code:
    | "unclassified-entry"
    | "duplicate-target"
    | "unaccounted-source"
    | "unaccounted-inventory"
    | "hash-mismatch"
    | "mode-mismatch"
    | "kind-mismatch"
    | "unauthorized-target-root"
    | "symlink-escapes-root"
    | "generated-treated-as-source";
  path: string;
  detail: string;
}

/** Inventory record as published by the planning package. */
export interface InventoryRecord {
  repository: RepositoryName;
  path: string;
  kind: "file" | "symlink";
  size: number;
  sha256: string;
  mode: string;
  disposition: string;
  initial_target: string;
  implementation_owners: string[];
}

interface ArchiveEntry {
  path: string;
  kind: "file" | "symlink";
  size: number;
  sha256: string;
  mode: string;
}

function modeOf(entry: ZipEntry): string {
  const unix = entry.externalAttributes >>> 16;
  // Only the permission bits matter here; the file-type bits are already
  // captured by `kind`.
  return `0o${(unix & 0o7777).toString(8)}`;
}

export function isExecutableMode(mode: string): boolean {
  const value = Number.parseInt(mode.replace(/^0o/, ""), 8);
  return Number.isFinite(value) && (value & 0o111) !== 0;
}

/**
 * Reads an archive into path/hash/mode records. Unlike the preflight scan this
 * retains the unix mode, which the ledger must record.
 */
export function scanArchiveWithModes(buf: Buffer, repository: RepositoryName): ArchiveEntry[] {
  const archive = openZip(buf);
  const files = archive.entries.filter((e) => !e.isDirectory);
  const names = files.map((e) => safeName(e.name));

  // Mirror preflight's root resolution so both tools agree on relative paths.
  const sentinelRoots = new Set(names.filter((n) => n.includes("/")).map((n) => n.split("/", 1)[0]!));
  const nameSet = new Set(names);
  const sentinels =
    repository === "archify"
      ? ["archify/package.json", "archify/schemas/architecture.schema.json"]
      : ["package.json", "packages/producer/package.json", "packages/studio/src/App.tsx"];

  let prefix = "";
  if (!sentinels.every((s) => nameSet.has(s))) {
    const matches = [...sentinelRoots]
      .map((r) => `${r}/`)
      .filter((p) => sentinels.every((s) => nameSet.has(p + s)));
    if (matches.length !== 1) {
      throw new PreflightError(`Cannot identify exactly one ${repository} source root`);
    }
    prefix = matches[0]!;
  }

  const entries: ArchiveEntry[] = [];
  for (const [index, file] of files.entries()) {
    const rel = names[index]!.slice(prefix.length);
    if (rel.split("/").some((part) => ADMIN_NAMES.has(part))) continue;
    const data = archive.read(file);
    entries.push({
      path: rel,
      kind: file.isSymlink ? "symlink" : "file",
      size: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
      mode: modeOf(file),
    });
  }
  return entries;
}

function isDisposition(value: string): value is Disposition {
  return (DISPOSITIONS as readonly string[]).includes(value);
}

export interface BuildOptions {
  archives: Record<RepositoryName, Buffer>;
  inventory: InventoryRecord[];
  baseline: Record<string, { tree_content_sha256: string; file_entries: number }>;
}

/**
 * Builds the ledger from the archives, using the planning inventory for
 * disposition and target assignment. Archive bytes win on hash/kind/mode; the
 * inventory is authoritative only for where an entry goes and who owns it.
 */
export function buildImportMap(options: BuildOptions): { map: ImportMap; problems: LedgerProblem[] } {
  const problems: LedgerProblem[] = [];
  const entries: ImportMapEntry[] = [];

  for (const repository of ["archify", "hyperframes"] as const) {
    const archive = scanArchiveWithModes(options.archives[repository], repository);
    const inventory = new Map(
      options.inventory.filter((r) => r.repository === repository).map((r) => [r.path, r]),
    );

    for (const entry of archive) {
      const record = inventory.get(entry.path);
      if (!record) {
        problems.push({
          code: "unclassified-entry",
          path: `${repository}:${entry.path}`,
          detail: "Archive entry has no disposition in the source inventory",
        });
        continue;
      }
      inventory.delete(entry.path);

      if (record.sha256 !== entry.sha256) {
        problems.push({
          code: "hash-mismatch",
          path: `${repository}:${entry.path}`,
          detail: `inventory ${record.sha256} != archive ${entry.sha256}`,
        });
      }
      if (record.kind !== entry.kind) {
        problems.push({
          code: "kind-mismatch",
          path: `${repository}:${entry.path}`,
          detail: `inventory ${record.kind} != archive ${entry.kind}`,
        });
      }
      if (record.mode !== entry.mode) {
        problems.push({
          code: "mode-mismatch",
          path: `${repository}:${entry.path}`,
          detail: `inventory ${record.mode} != archive ${entry.mode}`,
        });
      }
      if (!isDisposition(record.disposition)) {
        problems.push({
          code: "unclassified-entry",
          path: `${repository}:${entry.path}`,
          detail: `Unknown disposition ${JSON.stringify(record.disposition)}`,
        });
        continue;
      }

      entries.push({
        repository,
        sourcePath: entry.path,
        targetPath: record.initial_target,
        kind: entry.kind,
        size: entry.size,
        sha256: entry.sha256,
        mode: entry.mode,
        executable: isExecutableMode(entry.mode),
        disposition: record.disposition,
        implementationOwners: record.implementation_owners,
        nonAuthoritative: NON_AUTHORITATIVE.has(record.disposition),
      });
    }

    // Anything left in the inventory was expected but absent from the archive.
    for (const leftover of inventory.values()) {
      problems.push({
        code: "unaccounted-inventory",
        path: `${repository}:${leftover.path}`,
        detail: "Inventory record has no matching archive entry",
      });
    }
  }

  problems.push(...validateTargets(entries));

  const byRepository: Record<string, number> = {};
  const byDisposition: Record<string, number> = {};
  for (const e of entries) {
    byRepository[e.repository] = (byRepository[e.repository] ?? 0) + 1;
    byDisposition[e.disposition] = (byDisposition[e.disposition] ?? 0) + 1;
  }

  const sourceBaseline: ImportMap["sourceBaseline"] = {};
  for (const [name, value] of Object.entries(options.baseline)) {
    sourceBaseline[name] = {
      treeContentSha256: value.tree_content_sha256,
      fileEntries: value.file_entries,
    };
  }

  entries.sort((a, b) =>
    a.repository === b.repository
      ? a.sourcePath < b.sourcePath
        ? -1
        : a.sourcePath > b.sourcePath
          ? 1
          : 0
      : a.repository < b.repository
        ? -1
        : 1,
  );

  return {
    map: {
      generatedBy: "tools/import/plan.ts",
      scope:
        "Disposition and destination ledger for every source archive entry. " +
        "Records intent; performs no copy, delete or write of application source.",
      sourceBaseline,
      counts: {
        total: entries.length,
        byRepository,
        byDisposition,
        executable: entries.filter((e) => e.executable).length,
        symlinks: entries.filter((e) => e.kind === "symlink").length,
        nonAuthoritative: entries.filter((e) => e.nonAuthoritative).length,
      },
      entries,
    },
    problems,
  };
}

/**
 * Destination-side validation. A duplicate target is the failure that silently
 * overwrites one source file with another, so it is checked explicitly rather
 * than being discovered after a copy.
 */
export function validateTargets(entries: ImportMapEntry[]): LedgerProblem[] {
  const problems: LedgerProblem[] = [];
  const seen = new Map<string, ImportMapEntry>();

  for (const entry of entries) {
    const previous = seen.get(entry.targetPath);
    if (previous) {
      problems.push({
        code: "duplicate-target",
        path: entry.targetPath,
        detail: `${previous.repository}:${previous.sourcePath} and ${entry.repository}:${entry.sourcePath} both target it`,
      });
    } else {
      seen.set(entry.targetPath, entry);
    }

    const target = entry.targetPath;
    if (target.startsWith("/") || target.includes("..") || target.includes("\\")) {
      problems.push({
        code: "unauthorized-target-root",
        path: target,
        detail: "Target escapes the repository root",
      });
      continue;
    }

    // A root-level dotfile or a plain root file (README.md, package.json) is
    // legitimate; anything else must land under an authorized root.
    const isRootFile = !target.includes("/");
    if (!isRootFile && !AUTHORIZED_TARGET_ROOTS.some((root) => target.startsWith(root))) {
      problems.push({
        code: "unauthorized-target-root",
        path: target,
        detail: `Target is outside the authorized roots (${AUTHORIZED_TARGET_ROOTS.join(", ")})`,
      });
    }

    // A symlink may point outside the repo only if it is never followed. The
    // ledger records it as a link; import must recreate it, not dereference it.
    if (entry.kind === "symlink" && entry.disposition !== "review-symlink-do-not-follow") {
      problems.push({
        code: "symlink-escapes-root",
        path: `${entry.repository}:${entry.sourcePath}`,
        detail: `Symlink carries disposition ${entry.disposition}; expected review-symlink-do-not-follow`,
      });
    }

    // Generated output must not land where product source lives.
    if (entry.nonAuthoritative && target.startsWith("packages/") && !target.includes("upstream")) {
      problems.push({
        code: "generated-treated-as-source",
        path: target,
        detail: `Entry with disposition ${entry.disposition} targets a product package directory`,
      });
    }
  }

  return problems;
}
