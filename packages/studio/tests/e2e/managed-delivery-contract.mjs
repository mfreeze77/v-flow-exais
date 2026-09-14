import assert from "node:assert/strict";

/** Validate measured output, not merely an existing filename or successful process exit. */
export function assertManagedDeliveryProbe(probe, manifest) {
  assert(probe && Array.isArray(probe.streams), "ffprobe returned no stream records");
  assert(
    manifest && Array.isArray(manifest.scenes) && manifest.scenes.length > 0,
    "Missing project scenes",
  );
  const { width, height, fps } = manifest.output ?? {};
  for (const n of [width, height, fps?.numerator, fps?.denominator])
    assert(Number.isSafeInteger(n) && n > 0, "Invalid output contract");
  let frames = 0;
  for (const scene of manifest.scenes) {
    assert(Number.isSafeInteger(scene.startFrame) && scene.startFrame >= 0, "Invalid start frame");
    assert(
      Number.isSafeInteger(scene.durationFrames) && scene.durationFrames > 0,
      "Invalid duration frames",
    );
    assert(Number.isSafeInteger(scene.startFrame + scene.durationFrames), "Frame count overflow");
    frames = Math.max(frames, scene.startFrame + scene.durationFrames);
  }
  assert.equal(probe.streams.length, 1, "Expected the selected first video stream");
  const video = probe.streams[0];
  assert.equal(video.codec_name, "h264", "Export is not H.264");
  assert.equal(video.width, width, "Export width differs from project");
  assert.equal(video.height, height, "Export height differs from project");
  assert(/^\d+$/.test(String(video.nb_read_frames)), "Decoded frame count unavailable");
  assert.equal(Number(video.nb_read_frames), frames, "Exported frame count differs from project");
  const parts = /^(\d+)\/(\d+)$/.exec(video.avg_frame_rate ?? "");
  assert(parts && BigInt(parts[2]) > 0n, "Measured rational frame rate unavailable");
  assert.equal(
    BigInt(parts[1]) * BigInt(fps.denominator),
    BigInt(parts[2]) * BigInt(fps.numerator),
    "Frame rate differs from project",
  );
  const duration = Number(probe.format?.duration),
    expectedDuration = (frames * fps.denominator) / fps.numerator;
  assert(Number.isFinite(duration) && duration > 0, "Measured duration unavailable");
  assert(
    Math.abs(duration - expectedDuration) <= (2 * fps.denominator) / fps.numerator + 0.001,
    "Export duration exceeds two-frame mux tolerance",
  );
  return { width, height, frames, duration, fps: { ...fps }, codec: video.codec_name };
}
