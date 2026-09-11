import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A shared real-media fixture; no browser, provider, or workspace runtime required. */
export type CorrectionArgs = (
  inputPath: string,
  outputPath: string,
  durationSeconds: number,
  limitDbfs: number,
) => string[];

export interface TimingOptions {
  directory: string;
  ffmpeg: string;
  sampleRate: number;
  channels: number;
}

function run(ffmpeg: string, args: string[]): Buffer {
  // Built by push rather than as a spread inside an argv literal. The ffprobe
  // argv contract discovers callers by argv *shape*, deliberately over-including
  // so a dependency-injected runner cannot hide from it. A literal ending in a
  // spread reads to that matcher as a positional input needing a "--"
  // terminator — which is an ffprobe idiom and wrong for ffmpeg, whose inputs
  // arrive via -i and whose trailing positional is the output. Keeping the
  // literal's last element a string constant states the shape accurately
  // instead of weakening the contract or adding a meaningless terminator.
  const argv = ["-nostdin", "-hide_banner", "-v", "error"];
  argv.push(...args);
  return execFileSync(ffmpeg, argv, {
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function fixture(options: TimingOptions) {
  const { directory, sampleRate, channels } = options;
  const frames = sampleRate;
  const positions = [
    Math.round(sampleRate * 0.02),
    Math.round(sampleRate * 0.1),
    frames - Math.round(sampleRate * 0.002),
  ];
  const input = Buffer.alloc(frames * channels * 4);
  for (const [index, position] of positions.entries()) {
    for (let channel = 0; channel < channels; channel++) {
      input.writeFloatLE(index === 0 ? 1.2 : 0.25, (position * channels + channel) * 4);
    }
  }
  const path = join(directory, "input.f32");
  writeFileSync(path, input);
  return { path, input, frames, positions };
}

function rawInput(path: string, sampleRate: number, channels: number): string[] {
  return ["-f", "f32le", "-ar", String(sampleRate), "-ac", String(channels), "-i", path];
}

/** Measure the production filter losslessly, so AAC priming cannot conceal a filter delay. */
export function checkPcmLimiterTiming(builder: CorrectionArgs, options: TimingOptions) {
  const { ffmpeg, directory, sampleRate, channels } = options;
  const source = fixture(options);
  const output = join(directory, "filtered.f32");
  const args = builder(source.path, output, 1, 20 * Math.log10(0.5));
  const filter = args[args.indexOf("-af") + 1];
  // An explicit throw rather than assert.ok: the latter does not narrow
  // `string | undefined` for TypeScript, and `filter` is passed to ffmpeg below.
  if (!filter || !filter.startsWith("alimiter=")) {
    throw new Error("Expected the actual production limiter filter");
  }
  run(ffmpeg, [
    ...rawInput(source.path, sampleRate, channels),
    "-af",
    filter,
    "-t",
    "1.000000",
    "-c:a",
    "pcm_f32le",
    "-f",
    "f32le",
    "-y",
    output,
  ]);
  const decoded = readFileSync(output);
  assert.equal(decoded.length, source.input.length, "Limiter changed the PCM frame count");
  const actualPositions: number[][] = [];
  for (let channel = 0; channel < channels; channel++) {
    const positions: number[] = [];
    for (let frame = 0; frame < source.frames; frame++) {
      if (Math.abs(decoded.readFloatLE((frame * channels + channel) * 4)) > 0.01)
        positions.push(frame);
    }
    actualPositions.push(positions);
    assert.deepEqual(
      positions,
      source.positions,
      "Look-ahead shifted markers or discarded the tail",
    );
    for (const frame of source.positions.slice(1)) {
      assert.ok(
        Math.abs(decoded.readFloatLE((frame * channels + channel) * 4) - 0.25) < 1e-6,
        "A quiet timing marker changed amplitude",
      );
    }
  }
  return {
    sampleRate,
    channels,
    frames: source.frames,
    expectedPositions: source.positions,
    actualPositions,
  };
}

function localPeak(bytes: Buffer, channels: number, channel: number, start: number, end: number) {
  let magnitude = 0;
  let frame = -1;
  const frames = bytes.length / (channels * 4);
  for (let index = Math.max(0, start); index < Math.min(frames, end); index++) {
    const value = Math.abs(bytes.readFloatLE((index * channels + channel) * 4));
    if (value > magnitude) {
      magnitude = value;
      frame = index;
    }
  }
  return { frame, magnitude };
}

/** Compare an actual correction AAC encode with an unfiltered AAC encode of the same source. */
export function checkAacLimiterTiming(builder: CorrectionArgs, options: TimingOptions) {
  const { ffmpeg, directory, sampleRate, channels } = options;
  const source = fixture(options);
  const wav = join(directory, "input.wav");
  const control = join(directory, "control.m4a");
  const corrected = join(directory, "corrected.m4a");
  run(ffmpeg, [...rawInput(source.path, sampleRate, channels), "-c:a", "pcm_f32le", "-y", wav]);
  run(ffmpeg, ["-i", wav, "-t", "1.000000", "-c:a", "aac", "-b:a", "192k", "-y", control]);
  run(ffmpeg, builder(wav, corrected, 1, 20 * Math.log10(0.5)));
  const decode = (path: string) =>
    run(ffmpeg, ["-i", path, "-map", "0:a:0", "-c:a", "pcm_f32le", "-f", "f32le", "-"]);
  const expected = decode(control);
  const actual = decode(corrected);
  assert.equal(actual.length, expected.length, "Correction changed the decoded AAC sample count");
  const markers = [];
  for (let channel = 0; channel < channels; channel++) {
    for (const position of source.positions.slice(1)) {
      const start = position - Math.ceil(sampleRate * 0.01);
      const end = position + Math.ceil(sampleRate * 0.01);
      const before = localPeak(expected, channels, channel, start, end);
      const after = localPeak(actual, channels, channel, start, end);
      assert.ok(before.magnitude > 0.05, "AAC control must retain its timing marker");
      assert.ok(after.magnitude >= before.magnitude * 0.5, "Correction lost a quiet AAC marker");
      assert.ok(
        Math.abs(after.frame - before.frame) <= 2,
        "Correction added audio delay relative to AAC control",
      );
      markers.push({
        channel,
        expected: before,
        actual: after,
        shiftSamples: after.frame - before.frame,
      });
    }
  }
  return { sampleRate, channels, decodedFrames: actual.length / (channels * 4), markers };
}
