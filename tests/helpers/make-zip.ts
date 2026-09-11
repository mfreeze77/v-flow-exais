/**
 * Minimal ZIP writer for preflight fixtures.
 *
 * Writes stored (uncompressed) entries so tests can construct archives with
 * exact bytes, unix modes and an end-of-central-directory comment — the three
 * things AFM-001 inspects — without shipping binary fixtures into the repo.
 */

import { crc32 } from "node:zlib";

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

const S_IFREG = 0x8000;
const S_IFLNK = 0xa000;

export interface ZipFixtureEntry {
  name: string;
  /** File content, or the link target string for a symlink. */
  content: string | Buffer;
  /** Emit as a symlink entry rather than a regular file. */
  symlink?: boolean;
  /** Set the encrypted flag bit without actually encrypting, to test refusal. */
  encrypted?: boolean;
}

export function makeZip(entries: ZipFixtureEntry[], comment = ""): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, "utf8");
    const crc = crc32(data);
    const flags = entry.encrypted ? 1 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(0, 10); // stored
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    // Unix mode lives in the high 16 bits of the external attributes; that is
    // the only place a symlink is distinguishable from a regular file.
    const mode = (entry.symlink ? S_IFLNK : S_IFREG) | 0o644;
    // `<< 16` is a signed 32-bit op in JS, so S_IFREG/S_IFLNK shift into a
    // negative number. Coerce back to unsigned before writing.
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const commentBuf = Buffer.from(comment, "utf8");
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(commentBuf.length, 20);

  return Buffer.concat([...locals, centralBuf, eocd, commentBuf]);
}
