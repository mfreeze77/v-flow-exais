/**
 * AFM-003 — Initialize and populate the new owned monorepo.
 *
 * Copies every ledger entry out of the source archives into this repository,
 * verifying each written file's hash against the ledger before it counts as
 * done. Writes into a staging directory first and finalizes only verified
 * files, so an interrupted run never leaves a half-written tree in place.
 *
 * Safety properties:
 *   - Reads bytes from the ZIPs, never from the extracted folders. Modes and
 *     symlinks survive; a Windows checkout cannot flatten them.
 *   - Refuses to overwrite an existing file whose content differs from what the
 *     ledger expects, unless that path is explicitly reconciled.
 *   - Resumable: a receipt records verified writes, and a resumed run skips
 *     them only when the ledger it was built from is unchanged.
 *   - Never initializes or rewrites Git history, fabricates upstream ancestry,
 *     adds a remote, or pushes.
 */

import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { openZip, type ZipEntry } from "./zip.ts";
import { safeName, type RepositoryName } from "./preflight.ts";
import type { ImportMap } from "./plan.ts";

export interface ApplyOptions {
  map: ImportMap;
  archives: Record<RepositoryName, Buffer>;
  /** Repository root that receives the files. */
  destination: string;
  /** Staging directory; defaults to `.import-staging` under the destination. */
  staging?: string;
  /** Receipt path for resume support. */
  receiptPath?: string;
  /**
   * Target paths the operator has explicitly decided may be overwritten even
   * though they already exist with different content. Everything else fails
   * non-destructively.
   */
  reconcile?: string[];
  /**
   * Target paths where the destination's existing file deliberately wins over
   * the upstream one — repo policy this product owns, such as .gitignore.
   *
   * The upstream content is not discarded: it is preserved under
   * docs/upstream/<repository>/ and the decision is recorded in the receipt, so
   * a superseded entry is auditable rather than a silent skip.
   */
  supersede?: string[];
  /** Report progress without writing anything. */
  dryRun?: boolean;
}

export interface SupersededEntry {
  targetPath: string;
  reason: string;
  upstreamPreservedAt: string;
}

export interface ApplyConflict {
  targetPath: string;
  reason: "exists-with-different-content" | "outside-destination" | "hash-verification-failed";
  detail: string;
}

export interface ImportReceipt {
  generatedBy: string;
  /** Digest of the ledger this receipt was produced from. */
  ledgerDigest: string;
  destination: string;
  startedAt: string;
  completedAt: string | null;
  counts: {
    planned: number;
    written: number;
    skippedIdentical: number;
    superseded: number;
    conflicts: number;
  };
  /** Target paths verified written, so a resumed run can skip them. */
  written: string[];
  skippedIdentical: string[];
  superseded: SupersededEntry[];
  conflicts: ApplyConflict[];
  /** Recorded explicitly: this import never touches Git. */
  gitHistory: "not_initialized_by_import";
  upstreamAncestry: "not_fabricated";
  remote: "none_configured";
}

export function ledgerDigest(map: ImportMap): string {
  const text = map.entries
    .map((e) => `${e.repository}\0${e.sourcePath}\0${e.targetPath}\0${e.sha256}\n`)
    .join("");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Indexes an archive by the same relative paths the ledger uses. */
function indexArchive(
  buf: Buffer,
  repository: RepositoryName,
): Map<string, { entry: ZipEntry; read: () => Buffer }> {
  const archive = openZip(buf);
  const files = archive.entries.filter((e) => !e.isDirectory);
  const names = files.map((e) => safeName(e.name));
  const nameSet = new Set(names);

  const sentinels =
    repository === "archify"
      ? ["archify/package.json", "archify/schemas/architecture.schema.json"]
      : ["package.json", "packages/producer/package.json", "packages/studio/src/App.tsx"];

  let prefix = "";
  if (!sentinels.every((s) => nameSet.has(s))) {
    const roots = new Set(names.filter((n) => n.includes("/")).map((n) => n.split("/", 1)[0]!));
    const matches = [...roots]
      .map((r) => `${r}/`)
      .filter((p) => sentinels.every((s) => nameSet.has(p + s)));
    prefix = matches[0] ?? "";
  }

  const index = new Map<string, { entry: ZipEntry; read: () => Buffer }>();
  for (const [i, file] of files.entries()) {
    index.set(names[i]!.slice(prefix.length), { entry: file, read: () => archive.read(file) });
  }
  return index;
}

function isInside(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
}

export function loadReceipt(path: string): ImportReceipt | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ImportReceipt;
  } catch {
    return null;
  }
}

/**
 * Copies the ledger into the destination.
 *
 * Each file is written to staging, read back, hashed and compared to the
 * ledger; only then is it moved into place. A hash mismatch is a conflict, not
 * a warning — a silently corrupted import is worse than a failed one.
 */
export function applyImport(options: ApplyOptions): ImportReceipt {
  const destination = resolve(options.destination);
  const staging = resolve(options.staging ?? join(destination, ".import-staging"));
  const receiptPath = resolve(
    options.receiptPath ?? join(destination, "provenance/import-receipt.json"),
  );
  const digest = ledgerDigest(options.map);
  const reconcile = new Set(options.reconcile ?? []);
  const supersede = new Set(options.supersede ?? []);

  // Resume only against a receipt built from this exact ledger. A changed
  // ledger invalidates prior work rather than silently mixing two plans.
  const previous = loadReceipt(receiptPath);
  const resumable = previous?.ledgerDigest === digest ? previous : null;
  const alreadyWritten = new Set(resumable?.written ?? []);

  const receipt: ImportReceipt = {
    generatedBy: "tools/import/apply.ts",
    ledgerDigest: digest,
    destination,
    startedAt: resumable?.startedAt ?? new Date().toISOString(),
    completedAt: null,
    counts: {
      planned: options.map.entries.length,
      written: 0,
      skippedIdentical: 0,
      superseded: 0,
      conflicts: 0,
    },
    written: [...alreadyWritten],
    skippedIdentical: [],
    superseded: [],
    conflicts: [],
    gitHistory: "not_initialized_by_import",
    upstreamAncestry: "not_fabricated",
    remote: "none_configured",
  };

  const archives = {
    archify: indexArchive(options.archives.archify, "archify"),
    hyperframes: indexArchive(options.archives.hyperframes, "hyperframes"),
  };

  if (!options.dryRun) mkdirSync(staging, { recursive: true });

  for (const entry of options.map.entries) {
    if (alreadyWritten.has(entry.targetPath)) continue;

    const target = resolve(destination, entry.targetPath);
    if (!isInside(target, destination)) {
      receipt.conflicts.push({
        targetPath: entry.targetPath,
        reason: "outside-destination",
        detail: `Resolves to ${target}`,
      });
      continue;
    }

    const source = archives[entry.repository].get(entry.sourcePath);
    if (!source) {
      receipt.conflicts.push({
        targetPath: entry.targetPath,
        reason: "hash-verification-failed",
        detail: `Source ${entry.repository}:${entry.sourcePath} not present in archive`,
      });
      continue;
    }

    const data = source.read();
    if (sha256(data) !== entry.sha256) {
      receipt.conflicts.push({
        targetPath: entry.targetPath,
        reason: "hash-verification-failed",
        detail: `Archive bytes do not match ledger hash for ${entry.sourcePath}`,
      });
      continue;
    }

    // An existing identical file is already correct; an existing different one
    // is refused unless explicitly reconciled.
    if (existsSync(target)) {
      const existingStats = lstatSync(target);
      const existing = existingStats.isSymbolicLink()
        ? Buffer.from(readlinkSync(target), "utf8")
        : existingStats.isFile()
          ? readFileSync(target)
          : null;

      if (existing && sha256(existing) === entry.sha256) {
        receipt.skippedIdentical.push(entry.targetPath);
        continue;
      }

      // Repo policy this product owns wins, but the upstream text is kept for
      // reference rather than dropped on the floor.
      if (supersede.has(entry.targetPath)) {
        const preservedAt = `docs/upstream/${entry.repository}/${entry.sourcePath}`;
        if (!options.dryRun) {
          const preservedPath = resolve(destination, preservedAt);
          mkdirSync(dirname(preservedPath), { recursive: true });
          writeFileSync(preservedPath, data);
        }
        receipt.superseded.push({
          targetPath: entry.targetPath,
          reason: "destination file is owned repository policy",
          upstreamPreservedAt: preservedAt,
        });
        continue;
      }

      if (!reconcile.has(entry.targetPath)) {
        receipt.conflicts.push({
          targetPath: entry.targetPath,
          reason: "exists-with-different-content",
          detail: "Present in the destination with different content; not overwritten",
        });
        continue;
      }
    }

    if (options.dryRun) {
      receipt.written.push(entry.targetPath);
      continue;
    }

    const stagedPath = join(staging, entry.targetPath);
    mkdirSync(dirname(stagedPath), { recursive: true });

    if (entry.kind === "symlink") {
      // Recreate the link; never materialize its target.
      if (existsSync(stagedPath)) unlinkSync(stagedPath);
      symlinkSync(data.toString("utf8"), stagedPath);
    } else {
      writeFileSync(stagedPath, data);
      if (entry.executable) chmodSync(stagedPath, 0o755);
    }

    // Read back from staging and verify before finalizing.
    const readBack =
      entry.kind === "symlink"
        ? Buffer.from(readlinkSync(stagedPath), "utf8")
        : readFileSync(stagedPath);
    if (sha256(readBack) !== entry.sha256) {
      receipt.conflicts.push({
        targetPath: entry.targetPath,
        reason: "hash-verification-failed",
        detail: "Staged file did not read back with the expected hash",
      });
      rmSync(stagedPath, { force: true });
      continue;
    }

    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(target)) rmSync(target, { force: true, recursive: true });
    renameSync(stagedPath, target);
    receipt.written.push(entry.targetPath);
  }

  receipt.counts = {
    planned: options.map.entries.length,
    written: receipt.written.length,
    skippedIdentical: receipt.skippedIdentical.length,
    superseded: receipt.superseded.length,
    conflicts: receipt.conflicts.length,
  };
  receipt.completedAt = receipt.conflicts.length === 0 ? new Date().toISOString() : null;

  if (!options.dryRun) {
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    pruneEmptyDirs(staging);
  }

  return receipt;
}

/** Removes staging directories left empty after finalization. */
export function pruneEmptyDirs(root: string): void {
  if (!existsSync(root)) return;
  const walk = (dir: string): boolean => {
    let empty = true;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (walk(full)) rmSync(full, { recursive: true, force: true });
        else empty = false;
      } else {
        empty = false;
      }
    }
    return empty;
  };
  if (walk(root)) rmSync(root, { recursive: true, force: true });
}

/**
 * Finds nested repositories inside the destination. A vendored `.git` would
 * make part of the tree a submodule-like island that the outer repo cannot
 * track; the import must not create one.
 */
export function findNestedRepositories(root: string, skip: string[] = []): string[] {
  const found: string[] = [];
  const skipSet = new Set(skip.map((s) => resolve(root, s)));
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (skipSet.has(full)) continue;
      let stats;
      try {
        stats = lstatSync(full);
      } catch {
        continue;
      }
      if (!stats.isDirectory() || stats.isSymbolicLink()) continue;
      if (name === ".git" && full !== join(root, ".git")) {
        found.push(relative(root, full).split(sep).join("/"));
        continue;
      }
      if (name === "node_modules" || name === ".git") continue;
      walk(full);
    }
  };
  walk(root);
  return found;
}
