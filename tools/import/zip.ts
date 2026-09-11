/**
 * Minimal read-only ZIP reader for source preflight.
 *
 * Reads the central directory rather than trusting local headers, exposes the
 * end-of-central-directory comment (GitHub download ZIPs carry a revision-like
 * string there) and surfaces the external attributes needed to tell a symlink
 * entry from a regular file.
 *
 * Deliberately does NOT extract to disk: preflight inspects bytes in memory and
 * must never write into, or alongside, a source input.
 */

import { inflateRawSync } from "node:zlib";

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const S_IFMT = 0xf000;
const S_IFLNK = 0xa000;

export class ZipError extends Error {}

export interface ZipEntry {
  /** Entry name exactly as stored, using forward slashes. */
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  /** Bit 0 set means the entry is encrypted. */
  flags: number;
  externalAttributes: number;
  localHeaderOffset: number;
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface ZipArchive {
  entries: ZipEntry[];
  /** EOCD comment, or null when empty. Unverified metadata — never a commit. */
  comment: string | null;
  /** Reads and decompresses one entry's bytes. */
  read(entry: ZipEntry): Buffer;
}

/** Scans backwards for the EOCD signature, allowing for a trailing comment. */
function findEocd(buf: Buffer): number {
  const maxComment = 0xffff;
  const minRecord = 22;
  const start = Math.max(0, buf.length - maxComment - minRecord);
  for (let i = buf.length - minRecord; i >= start; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new ZipError("Not a ZIP archive: end-of-central-directory record not found");
}

/**
 * ZIP64 stores the real counts/offsets in a separate record when the 32-bit
 * fields are saturated. Both source archives are well under the limits today,
 * but a silently truncated central directory would produce a wrong inventory
 * rather than an error, so handle it explicitly.
 */
function readCentralDirectoryLocation(buf: Buffer, eocd: number): { offset: number; count: number } {
  let count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  if (count !== 0xffff && offset !== 0xffffffff) return { offset, count };

  const locator = eocd - 20;
  if (locator < 0 || buf.readUInt32LE(locator) !== SIG_EOCD64_LOCATOR) {
    throw new ZipError("ZIP64 fields present but the ZIP64 locator is missing");
  }
  const eocd64 = Number(buf.readBigUInt64LE(locator + 8));
  if (eocd64 < 0 || eocd64 + 56 > buf.length || buf.readUInt32LE(eocd64) !== SIG_EOCD64) {
    throw new ZipError("ZIP64 end-of-central-directory record is unreadable");
  }
  count = Number(buf.readBigUInt64LE(eocd64 + 32));
  offset = Number(buf.readBigUInt64LE(eocd64 + 48));
  return { offset, count };
}

/**
 * Replaces saturated 32-bit size/offset fields from the ZIP64 extra field.
 * Values appear in a fixed order, and only for the fields actually saturated.
 */
function applyZip64Extra(
  extra: Buffer,
  fields: { uncompressedSize: number; compressedSize: number; localHeaderOffset: number },
): void {
  let pos = 0;
  while (pos + 4 <= extra.length) {
    const id = extra.readUInt16LE(pos);
    const size = extra.readUInt16LE(pos + 2);
    const body = extra.subarray(pos + 4, pos + 4 + size);
    pos += 4 + size;
    if (id !== 0x0001) continue;

    let at = 0;
    const next = (): number => {
      if (at + 8 > body.length) throw new ZipError("Truncated ZIP64 extra field");
      const value = Number(body.readBigUInt64LE(at));
      at += 8;
      return value;
    };
    if (fields.uncompressedSize === 0xffffffff) fields.uncompressedSize = next();
    if (fields.compressedSize === 0xffffffff) fields.compressedSize = next();
    if (fields.localHeaderOffset === 0xffffffff) fields.localHeaderOffset = next();
    return;
  }
}

export function openZip(buf: Buffer): ZipArchive {
  const eocd = findEocd(buf);
  const commentLength = buf.readUInt16LE(eocd + 20);
  const commentBytes = buf.subarray(eocd + 22, eocd + 22 + commentLength);
  const comment = commentBytes.length > 0 ? commentBytes.toString("utf8") : null;

  const { offset, count } = readCentralDirectoryLocation(buf, eocd);
  const entries: ZipEntry[] = [];
  let pos = offset;

  for (let i = 0; i < count; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== SIG_CENTRAL) {
      throw new ZipError(`Corrupt central directory at entry ${i}`);
    }
    const flags = buf.readUInt16LE(pos + 8);
    const compressionMethod = buf.readUInt16LE(pos + 10);
    const nameLength = buf.readUInt16LE(pos + 28);
    const extraLength = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const externalAttributes = buf.readUInt32LE(pos + 38);

    const sizes = {
      uncompressedSize: buf.readUInt32LE(pos + 24),
      compressedSize: buf.readUInt32LE(pos + 20),
      localHeaderOffset: buf.readUInt32LE(pos + 42),
    };

    const nameStart = pos + 46;
    // Bit 11 flags UTF-8 names. Everything else is legacy CP437; both source
    // archives are ASCII-named, and decoding as UTF-8 keeps non-ASCII names
    // stable rather than silently mangling them into a different byte string.
    const name = buf.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const extra = buf.subarray(nameStart + nameLength, nameStart + nameLength + extraLength);
    applyZip64Extra(extra, sizes);

    const unixMode = externalAttributes >>> 16;
    entries.push({
      name,
      compressedSize: sizes.compressedSize,
      uncompressedSize: sizes.uncompressedSize,
      compressionMethod,
      flags,
      externalAttributes,
      localHeaderOffset: sizes.localHeaderOffset,
      isDirectory: name.endsWith("/"),
      isSymlink: (unixMode & S_IFMT) === S_IFLNK,
    });

    pos = nameStart + nameLength + extraLength + commentLen;
  }

  const read = (entry: ZipEntry): Buffer => {
    if ((entry.flags & 1) !== 0) {
      throw new ZipError(`Encrypted entry unsupported: ${entry.name}`);
    }
    const lh = entry.localHeaderOffset;
    if (lh + 30 > buf.length || buf.readUInt32LE(lh) !== SIG_LOCAL) {
      throw new ZipError(`Corrupt local header for ${entry.name}`);
    }
    // The local header's own name/extra lengths are authoritative for locating
    // the data; they can legitimately differ from the central directory's.
    const dataStart = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
    const raw = buf.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === METHOD_STORED) return Buffer.from(raw);
    if (entry.compressionMethod === METHOD_DEFLATE) return inflateRawSync(raw);
    throw new ZipError(
      `Unsupported compression method ${entry.compressionMethod} for ${entry.name}`,
    );
  };

  return { entries, comment, read };
}
