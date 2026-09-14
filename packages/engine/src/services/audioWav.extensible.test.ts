import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, it } from "vitest";
import { getFfmpegBinary } from "../utils/ffmpegBinaries.js";
import { applyVolumeEnvelopeToWav } from "./audioVolumeEnvelope.js";
import { AudioFxRenderError, readWav, writeWav } from "./audioFxRender.js";
import { wavFormatFixture } from "./wavFormat.fixture.js";

const directories: string[] = [];
function file() {
  const dir = mkdtempSync(join(tmpdir(), "hf-extensible-contract-"));
  directories.push(dir);
  return join(dir, "input.wav");
}
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
for (const channels of [1, 2, 3, 6]) {
  it(`bakes an extensible float envelope without losing headroom or channel order (${channels} channels)`, () => {
    const path = file();
    const values = Array.from({ length: channels }, (_, i) => (i % 2 ? -1.6 : 1.4));
    const f = wavFormatFixture({ channels, frames: 9, sampleRate: 8, values });
    writeFileSync(path, f.bytes);
    assert.equal(
      applyVolumeEnvelopeToWav(
        path,
        [
          { time: 0, volume: 1 },
          { time: 1, volume: 0.5 },
        ],
        0,
        1,
      ),
      true,
    );
    const actual = readFileSync(path);
    assert.deepEqual(actual.subarray(0, f.dataOffset), f.bytes.subarray(0, f.dataOffset));
    for (let channel = 0; channel < channels; channel++) {
      for (const frame of [0, 4, 8]) {
        const value = actual.readFloatLE(f.dataOffset + (frame * channels + channel) * 4);
        assert(Math.abs(value - values[channel]! * (1 - frame / 16)) < 0.000001);
      }
    }
    assert.deepEqual(readdirSync(dirname(path)), ["input.wav"]);
  });
}
for (const extensible of [false, true]) {
  for (const dataFirst of [false, true]) {
    for (const float of [false, true]) {
      it(`FX reader decodes ${extensible ? "extensible" : "classic"} ${float ? "float" : "PCM"}, dataFirst=${dataFirst}, odd chunk padding`, () => {
        const path = file();
        const f = wavFormatFixture({
          extensible,
          float,
          dataFirst,
          oddJunk: true,
          values: float ? [1.4, -1.6] : [14000, -16000],
        });
        writeFileSync(path, f.bytes);
        const actual = readWav(path);
        assert.equal(actual.float, float);
        assert.equal(actual.channels, 2);
        assert.equal(actual.samples.length, 8);
        assert.equal(actual.sampleRate, 48000);
        const scale = float ? 1 : 32768;
        assert(Math.abs(actual.samples[0]! - (float ? 1.4 : 14000) / scale) < 0.000001);
        assert(Math.abs(actual.samples[1]! - (float ? -1.6 : -16000) / scale) < 0.000001);
      });
    }
  }
}
it("an FX read/write round trip preserves float headroom before the group fader", () => {
  const input = file();
  const output = join(dirname(input), "roundtrip.wav");
  const f = wavFormatFixture({ frames: 20, values: [1.4, -1.4] });
  writeFileSync(input, f.bytes);
  const loaded = readWav(input);
  writeWav(output, loaded.samples, loaded.sampleRate, loaded.channels, loaded.float);
  const restored = readWav(output);
  assert.equal(restored.float, true);
  assert.deepEqual(restored.samples, loaded.samples);
  assert(restored.samples[0]! > 1);
  assert(restored.samples[1]! < -1);
});
for (const invalid of ["guid", "extension-size", "fmt-size", "valid-bits"] as const) {
  it(`both readers reject malformed ${invalid} and the baker leaves bytes untouched`, () => {
    const path = file();
    const f = wavFormatFixture();
    if (invalid === "guid") f.bytes[f.fmtOffset + 39] = 0;
    if (invalid === "extension-size") f.bytes.writeUInt16LE(21, f.fmtOffset + 16);
    if (invalid === "fmt-size") f.bytes.writeUInt32LE(18, f.fmtOffset - 4);
    if (invalid === "valid-bits") f.bytes.writeUInt16LE(24, f.fmtOffset + 18);
    writeFileSync(path, f.bytes);
    assert.throws(() => readWav(path), AudioFxRenderError);
    assert.equal(applyVolumeEnvelopeToWav(path, [{ time: 0, volume: 0 }], 0, 0), false);
    assert.deepEqual(readFileSync(path), f.bytes);
    assert.deepEqual(readdirSync(dirname(path)), ["input.wav"]);
  });
}
it("the FX reader does not invent a default format when fmt is absent", () => {
  const path = file();
  const f = wavFormatFixture();
  f.bytes.write("JUNK", f.fmtOffset - 8, "ascii");
  writeFileSync(path, f.bytes);
  assert.throws(() => readWav(path), AudioFxRenderError);
});
it("the FX reader rejects a RIFF container that is not WAVE", () => {
  const path = file();
  const f = wavFormatFixture({ extensible: false });
  f.bytes.write("AVI ", 8, "ascii");
  writeFileSync(path, f.bytes);
  assert.throws(() => readWav(path), AudioFxRenderError);
});
const hasFfmpeg = spawnSync(getFfmpegBinary(), ["-version"], { encoding: "utf8" }).status === 0;
it.skipIf(!hasFfmpeg)("both readers accept real multichannel FFmpeg float WAV output", () => {
  const path = file();
  const made = spawnSync(
    getFfmpegBinary(),
    [
      "-nostdin",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "aevalsrc=1.4*sin(2*PI*440*t)|1.4*sin(2*PI*440*t)|1.4*sin(2*PI*440*t):d=0.25:s=48000",
      "-c:a",
      "pcm_f32le",
      path,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(made.status, 0, made.stderr);
  const original = readFileSync(path);
  const decoded = readWav(path);
  assert.equal(decoded.channels, 3);
  assert.equal(decoded.float, true);
  assert.equal(decoded.samples.length, 12000 * 3);
  assert(decoded.samples.some((value) => value > 1));
  assert.equal(applyVolumeEnvelopeToWav(path, [{ time: 0, volume: 0.5 }], 0, 0.5), true);
  const attenuated = readWav(path);
  assert.equal(readFileSync(path).length, original.length);
  for (let i = 0; i < decoded.samples.length; i++) {
    assert.equal(attenuated.samples[i], Math.fround(decoded.samples[i]! * 0.5));
  }
});
