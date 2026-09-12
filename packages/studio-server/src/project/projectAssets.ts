/**
 * AFM-023 local-asset ownership, separate from authoring publication.
 *
 * Bytes and measured metadata are published as one immutable directory before
 * a project command can reference them. Failed/stale commands may leave an
 * unreferenced blob; they cannot publish a partial manifest. Undo retains blobs
 * for redo and old builds. No garbage collection is performed here.
 *
 * This is an in-process trusted-local API, NOT an HTTP filesystem-path endpoint.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { crc32 } from "node:zlib";
import {
  assertProjectAsset,
  isLocalAssetName,
  MAX_PROJECT_ASSET_BYTES,
  projectAssetRegistryProblems,
  sameProjectAsset,
  type ProjectAsset,
} from "@hyperframes/project-model";

const RECORD_LIMIT = 16 * 1024;
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException)?.code;

/** Reject a symlink at every owned directory boundary, including read paths. */
function ownedDirectory(root: string, parts: string[], create: boolean): string {
  let path = realpathSync(root);
  for (const part of parts) {
    path = join(path, part);
    if (create) {
      try {
        mkdirSync(path, { mode: 0o700 });
        syncDirectory(dirname(path));
      } catch (error) {
        if (codeOf(error) !== "EEXIST") throw error;
      }
    }
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error("asset/unsafe-store: an owned directory is not a real directory.");
  }
  return path;
}

/** Bounded snapshot read; nonblocking open avoids hanging on a FIFO. */
function readBounded(path: string, maximum: number): Buffer {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    if (
      !before.isFile() ||
      !Number.isSafeInteger(before.size) ||
      before.size < 1 ||
      before.size > maximum
    )
      throw new Error("asset/invalid-size: expected a nonempty bounded regular file.");
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (count === 0) throw new Error("asset/changed-during-read: file was truncated.");
      offset += count;
    }
    const extra = Buffer.alloc(1);
    const grew = readSync(fd, extra, 0, 1, bytes.length) !== 0;
    const after = fstatSync(fd);
    if (
      grew ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw new Error("asset/changed-during-read: retry the import from stable bytes.");
    return bytes;
  } finally {
    closeSync(fd);
  }
}

function syncDirectory(path: string): void {
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function durableFile(path: string, bytes: Uint8Array): void {
  const fd = openSync(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Verify PNG chunk lengths/CRCs, not just the signature ffprobe can recognize. */
function validatePng(bytes: Buffer): void {
  let offset = 8;
  let sawData = false;
  let first = true;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("asset/invalid-png: truncated chunk.");
    const kind = bytes.toString("ascii", offset + 4, offset + 8);
    if (first && (kind !== "IHDR" || length !== 13))
      throw new Error("asset/invalid-png: missing image header.");
    first = false;
    const actual = crc32(bytes.subarray(offset + 4, offset + 8 + length));
    if (actual !== bytes.readUInt32BE(offset + 8 + length))
      throw new Error("asset/invalid-png: chunk checksum mismatch.");
    if (kind === "IDAT") sawData = true;
    if (kind === "IEND") {
      if (length !== 0 || end !== bytes.length || !sawData)
        throw new Error("asset/invalid-png: incomplete image data.");
      return;
    }
    offset = end;
  }
  throw new Error("asset/invalid-png: missing end chunk.");
}

function mediaKind(bytes: Buffer): "wav" | "png" {
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WAVE"
  ) {
    if (bytes.readUInt32LE(4) + 8 !== bytes.length)
      throw new Error("asset/invalid-wav: RIFF length does not match the imported bytes.");
    return "wav";
  }
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG)) {
    validatePng(bytes);
    return "png";
  }
  throw new Error("asset/unsupported-media: this slice accepts RIFF/WAVE and PNG bytes only.");
}

/** Probe only the copied snapshot, using a fixed demuxer and a bounded process. */
function probe(path: string, extension: "wav" | "png", ffprobePath: string): Promise<unknown> {
  if (!ffprobePath)
    throw new Error("asset/probe-unavailable: ffprobe is required for asset import.");
  const args = [
    "-v",
    "error",
    "-protocol_whitelist",
    "file,pipe",
    "-f",
    extension === "wav" ? "wav" : "png_pipe",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,sample_rate,channels,duration:format=duration",
    "-of",
    "json",
    "--",
    path,
  ];
  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      args,
      { timeout: 15_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(new Error("asset/probe-failed: the copied media could not be probed."));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("asset/probe-failed: ffprobe returned invalid JSON."));
        }
      },
    );
  });
}

function measuredAsset(
  bytes: Buffer,
  name: string,
  extension: "wav" | "png",
  result: unknown,
): ProjectAsset {
  const data = result as {
    streams?: Record<string, unknown>[];
    format?: { duration?: unknown };
  } | null;
  if (!data || !Array.isArray(data.streams))
    throw new Error("asset/probe-failed: stream metadata is absent.");
  const stream = data.streams.find(
    (item) => item && item.codec_type === (extension === "wav" ? "audio" : "video"),
  );
  if (!stream) throw new Error("asset/probe-failed: the expected media stream is absent.");
  const hash = digest(bytes);
  const common = {
    id: `asset-${hash}`,
    sha256: hash,
    path: `assets/${hash}.${extension}`,
    byteLength: bytes.length,
    origin: { kind: "local-file" as const, name },
    rights: "unverified" as const,
  };
  const asset: unknown =
    extension === "wav"
      ? {
          ...common,
          kind: "audio",
          mediaType: "audio/wav",
          metadata: {
            measured: true,
            codec: stream.codec_name,
            durationSeconds: Number(stream.duration ?? data.format?.duration),
            sampleRate: Number(stream.sample_rate),
            channels: Number(stream.channels),
          },
        }
      : {
          ...common,
          kind: "image",
          mediaType: "image/png",
          metadata: {
            measured: true,
            codec: stream.codec_name,
            width: Number(stream.width),
            height: Number(stream.height),
          },
        };
  assertProjectAsset(asset);
  return asset;
}

function storedAsset(root: string, hash: string): { asset: ProjectAsset; bytes: Buffer } {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("asset/invalid: invalid digest.");
  const dir = ownedDirectory(root, [".vflow", "asset-blobs", hash], false);
  const record: unknown = JSON.parse(
    readBounded(join(dir, "record.json"), RECORD_LIMIT).toString("utf8"),
  );
  assertProjectAsset(record);
  if (record.sha256 !== hash)
    throw new Error("asset/integrity: stored identity does not match its directory.");
  const extension = record.kind === "audio" ? "wav" : "png";
  const bytes = readBounded(join(dir, `payload.${extension}`), MAX_PROJECT_ASSET_BYTES);
  if (
    bytes.length !== record.byteLength ||
    digest(bytes) !== record.sha256 ||
    mediaKind(bytes) !== extension
  )
    throw new Error("asset/integrity: stored media no longer matches its content identity.");
  return { asset: record, bytes };
}

/**
 * The caller resolves ffprobe with the repository's existing findFfBinary helper.
 * Returns the first registered display name for duplicate bytes under a new name.
 */
export async function stageProjectAsset(
  root: string,
  inputPath: string,
  ffprobePath: string,
): Promise<ProjectAsset> {
  const name = basename(inputPath).normalize("NFC");
  if (!isLocalAssetName(name))
    throw new Error("asset/invalid-name: unsupported local display name.");
  const bytes = readBounded(inputPath, MAX_PROJECT_ASSET_BYTES);
  const extension = mediaKind(bytes);
  const hash = digest(bytes);
  const store = ownedDirectory(root, [".vflow", "asset-blobs"], true);
  const destination = join(store, hash);
  // lstat, not existsSync: a dangling symlink is corruption, not an absent blob.
  try {
    lstatSync(destination);
    return storedAsset(root, hash).asset;
  } catch (error) {
    if (codeOf(error) !== "ENOENT") throw error;
    // A present but damaged directory must not be replaced or silently repaired.
    try {
      lstatSync(destination);
      throw new Error("asset/integrity: incomplete stored asset.");
    } catch (again) {
      if (codeOf(again) !== "ENOENT") throw again;
    }
  }
  const staging = mkdtempSync(join(store, "pending-"));
  try {
    const payload = join(staging, `payload.${extension}`);
    durableFile(payload, bytes);
    const asset = measuredAsset(
      bytes,
      name,
      extension,
      await probe(payload, extension, ffprobePath),
    );
    durableFile(join(staging, "record.json"), Buffer.from(`${JSON.stringify(asset, null, 2)}\n`));
    syncDirectory(staging);
    try {
      renameSync(staging, destination);
    } catch (error) {
      // A concurrent publisher of identical bytes wins; never overwrite it.
      if (!["EEXIST", "ENOTEMPTY"].includes(codeOf(error) ?? "")) throw error;
      return storedAsset(root, hash).asset;
    }
    syncDirectory(store);
    return asset;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/** Verify both metadata and bytes; a manifest cannot forge a staged measurement. */
export function readProjectAssetBytes(root: string, asset: ProjectAsset): Buffer {
  assertProjectAsset(asset);
  const stored = storedAsset(root, asset.sha256);
  if (!sameProjectAsset(stored.asset, asset))
    throw new Error("asset/integrity: manifest metadata differs from the staged asset record.");
  return stored.bytes;
}

/** No reads or directory creation for legacy projects without a registry. */
export function verifyProjectAssets(root: string, assets: ProjectAsset[] = []): void {
  const problems = projectAssetRegistryProblems(assets);
  if (problems.length) throw new Error(`asset/invalid: ${problems.join(" ")}`);
  for (const asset of assets) readProjectAssetBytes(root, asset);
}

/** Copies verified bytes into an isolated build, never a link back to mutable source. */
export function projectAssetBuildFiles(
  root: string,
  assets: ProjectAsset[] = [],
): Record<string, Buffer> {
  const problems = projectAssetRegistryProblems(assets);
  if (problems.length) throw new Error(`asset/invalid: ${problems.join(" ")}`);
  return Object.fromEntries(
    assets.map((asset) => [asset.path, readProjectAssetBytes(root, asset)]),
  );
}
