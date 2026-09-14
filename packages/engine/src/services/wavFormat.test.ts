import assert from "node:assert/strict";
import { it } from "vitest";
import { readSupportedWavFormat } from "./wavFormat.js";
import { wavFormatFixture } from "./wavFormat.fixture.js";

for (const extensible of [false, true]) {
  for (const float of [false, true]) {
    for (const channels of [1, 2, 6]) {
      it(`reads ${extensible ? "extensible" : "classic"} ${float ? "float32" : "PCM16"}, ${channels} channels`, () => {
        const f = wavFormatFixture({ extensible, float, channels });
        assert.deepEqual(readSupportedWavFormat(f.bytes, f.fmtOffset, f.fmtSize), {
          format: float ? 3 : 1,
          bits: float ? 32 : 16,
          channels,
          sampleRate: 48000,
          float,
        });
      });
    }
  }
}

const invalid = [
  ["short extension length", (b: Buffer, at: number) => b.writeUInt16LE(21, at + 16)],
  ["overlong extension length", (b: Buffer, at: number) => b.writeUInt16LE(65535, at + 16)],
  ["reduced valid bits", (b: Buffer, at: number) => b.writeUInt16LE(16, at + 18)],
  ["zero valid bits", (b: Buffer, at: number) => b.writeUInt16LE(0, at + 18)],
  ["unknown subtype", (b: Buffer, at: number) => b.writeUInt32LE(17, at + 24)],
  ["GUID tail differs", (b: Buffer, at: number) => b.writeUInt8(0, at + 39)],
  ["GUID high format bits differ", (b: Buffer, at: number) => b.writeUInt32LE(65539, at + 24)],
  ["zero channels", (b: Buffer, at: number) => b.writeUInt16LE(0, at + 2)],
  ["zero sample rate", (b: Buffer, at: number) => b.writeUInt32LE(0, at + 4)],
  ["float64 not supported", (b: Buffer, at: number) => b.writeUInt16LE(64, at + 14)],
] as const;
for (const [name, corrupt] of invalid) {
  it(`rejects ${name}`, () => {
    const f = wavFormatFixture();
    corrupt(f.bytes, f.fmtOffset);
    assert.equal(readSupportedWavFormat(f.bytes, f.fmtOffset, f.fmtSize), null);
  });
}

for (const size of [0, 15, 16, 18, 39, 41, Number.NaN]) {
  it(`does not borrow extension bytes beyond declared fmt size ${size}`, () => {
    const f = wavFormatFixture();
    // Only fmt bytes are supplied for the overlong-size case.
    const chunk = f.bytes.subarray(f.fmtOffset, f.fmtOffset + f.fmtSize);
    assert.equal(readSupportedWavFormat(chunk, 0, size), null);
  });
}
for (const body of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
  it(`rejects invalid chunk offset ${body} without throwing`, () => {
    const f = wavFormatFixture();
    assert.equal(readSupportedWavFormat(f.bytes, body, f.fmtSize), null);
  });
}
it("accepts a complete 18-byte classic float fmt extension", () => {
  const f = wavFormatFixture({ extensible: false });
  const fmt = Buffer.concat([f.bytes.subarray(f.fmtOffset, f.fmtOffset + 16), Buffer.alloc(2)]);
  assert.equal(readSupportedWavFormat(fmt, 0, 18)?.format, 3);
});
it("does not interpret 32-bit integer PCM as float", () => {
  const f = wavFormatFixture({ extensible: false, float: false });
  f.bytes.writeUInt16LE(32, f.fmtOffset + 14);
  assert.equal(readSupportedWavFormat(f.bytes, f.fmtOffset, f.fmtSize), null);
});
it("does not interpret a classic compressed tag as PCM", () => {
  const f = wavFormatFixture({ extensible: false, float: false });
  f.bytes.writeUInt16LE(17, f.fmtOffset);
  assert.equal(readSupportedWavFormat(f.bytes, f.fmtOffset, f.fmtSize), null);
});
