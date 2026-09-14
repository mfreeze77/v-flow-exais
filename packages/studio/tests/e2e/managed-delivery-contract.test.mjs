import { test } from "node:test";
import assert from "node:assert/strict";
import { assertManagedDeliveryProbe } from "./managed-delivery-contract.mjs";
const manifest = () => ({
  output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
  scenes: [
    { startFrame: 0, durationFrames: 75 },
    { startFrame: 75, durationFrames: 240 },
  ],
});
const probe = () => ({
  streams: [
    { codec_name: "h264", width: 1280, height: 720, nb_read_frames: "315", avg_frame_rate: "30/1" },
  ],
  format: { duration: "10.5" },
});
test("valid measured export matches the project's frame contract", () =>
  assert.equal(assertManagedDeliveryProbe(probe(), manifest()).frames, 315));
for (const [field, value] of [
  ["codec_name", "vp9"],
  ["width", 640],
  ["height", 480],
  ["nb_read_frames", "314"],
  ["nb_read_frames", "N/A"],
  ["avg_frame_rate", "30000/1001"],
  ["avg_frame_rate", "0/0"],
])
  test(`rejects incompatible video ${field}=${value}`, () => {
    const p = probe();
    p.streams[0][field] = value;
    assert.throws(() => assertManagedDeliveryProbe(p, manifest()));
  });
test("rejects a successful process with no decoded video stream", () => {
  const p = probe();
  p.streams = [];
  assert.throws(() => assertManagedDeliveryProbe(p, manifest()));
});
test("rejects missing or non-finite duration", () => {
  const p = probe();
  p.format.duration = "NaN";
  assert.throws(() => assertManagedDeliveryProbe(p, manifest()));
});
test("rejects truncated duration despite a plausible stream label", () => {
  const p = probe();
  p.format.duration = "10";
  assert.throws(() => assertManagedDeliveryProbe(p, manifest()));
});
test("compares equivalent rational rates by value, not string spelling", () => {
  const p = probe();
  p.streams[0].avg_frame_rate = "30000/1000";
  assertManagedDeliveryProbe(p, manifest());
});
test("preserves a fractional project rate without rounding it to 30", () => {
  const m = manifest(),
    p = probe();
  m.output.fps = { numerator: 30000, denominator: 1001 };
  p.streams[0].avg_frame_rate = "30000/1001";
  p.format.duration = "10.5105";
  assertManagedDeliveryProbe(p, m);
});
test("rejects a malformed project frame count before interpreting output", () => {
  const m = manifest();
  m.scenes[0].durationFrames = -1;
  assert.throws(() => assertManagedDeliveryProbe(probe(), m));
});
