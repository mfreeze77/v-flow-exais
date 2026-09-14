import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { it } from "vitest";
import { getFfmpegBinary } from "./ffmpegBinaries.js";

const fixture = resolve(__dirname, "fixtures/hdr-pq-metadata.png");
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pixels = Buffer.from("40008000c000ffff000080002000400080008000c000ffff", "hex");

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

it("stores actual engine-owned PNG bytes, not a Git LFS pointer", () => {
  const bytes = readFileSync(fixture);
  assert.deepEqual(bytes.subarray(0, 8), signature);
  assert.equal(bytes.length, 110);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "a378739e60368f245e7f046cabe38e9cd9399ab883a9b2973be57af88fb3c665",
  );
});

it("contains complete CRC-valid RGB16/PQ metadata and losslessly decodable pixel data", () => {
  const bytes = readFileSync(fixture);
  let offset = 8;
  const chunks = new Map<string, Buffer>();
  while (offset < bytes.length) {
    assert(offset + 12 <= bytes.length, "Truncated PNG chunk header");
    const size = bytes.readUInt32BE(offset);
    const end = offset + 12 + size;
    assert(end <= bytes.length, "Truncated PNG chunk payload");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    assert(!chunks.has(type), `Duplicate fixture chunk: ${type}`);
    assert.equal(crc32(bytes.subarray(offset + 4, end - 4)), bytes.readUInt32BE(end - 4));
    chunks.set(type, bytes.subarray(offset + 8, end - 4));
    offset = end;
  }
  assert.equal(offset, bytes.length);
  assert.deepEqual([...chunks.keys()], ["IHDR", "cICP", "IDAT", "IEND"]);
  assert.deepEqual(chunks.get("IHDR"), Buffer.from("00000002000000021002000000", "hex"));
  assert.deepEqual(chunks.get("cICP"), Buffer.from([9, 16, 0, 1]));
  assert.equal(chunks.get("IEND")?.length, 0);
  const idat = chunks.get("IDAT");
  assert(idat);
  assert.deepEqual(
    inflateSync(idat),
    Buffer.concat([
      Buffer.from([0]),
      pixels.subarray(0, 12),
      Buffer.from([0]),
      pixels.subarray(12),
    ]),
  );
});

const hasFfmpeg = spawnSync(getFfmpegBinary(), ["-version"], { encoding: "utf8" }).status === 0;
it.skipIf(!hasFfmpeg)("the real decoder reconstructs all four RGB16 pixels", () => {
  const decoded = spawnSync(
    getFfmpegBinary(),
    [
      "-nostdin",
      "-v",
      "error",
      "-xerror",
      "-i",
      fixture,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb48be",
      "pipe:1",
    ],
    { timeout: 30000, maxBuffer: 1024 * 1024 },
  );
  assert.equal(decoded.status, 0, decoded.stderr?.toString());
  assert.deepEqual(decoded.stdout, pixels);
});
