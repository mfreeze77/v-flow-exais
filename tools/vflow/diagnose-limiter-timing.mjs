/**
 * Run the shared real-media timing fixtures with the production argument builder
 * isolated from workspace imports. This is NOT a full producer suite or render.
 * Requires Node with TypeScript stripping (the tested Node 22 image supports it).
 * Installs nothing. Refuses an existing output directory. Failures exit nonzero.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkAacLimiterTiming,
  checkPcmLimiterTiming,
} from "../../packages/producer/src/services/render/audioLimiterTiming.fixture.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const options = {
  source: join(root, "packages/producer/src/services/render/audioPadTrim.ts"),
  output: "",
  ffmpeg: "ffmpeg",
};
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 2) {
  const key = argv[index]?.slice(2);
  const value = argv[index + 1];
  if (!argv[index]?.startsWith("--") || !Object.hasOwn(options, key) || !value) {
    throw new Error(
      "Usage: node --experimental-strip-types tools/vflow/diagnose-limiter-timing.mjs --output NEW_DIR [--source FILE] [--ffmpeg BINARY]",
    );
  }
  options[key] = value;
}
if (!options.output) throw new Error("--output NEW_DIR is required");
const output = resolve(options.output);
mkdirSync(dirname(output), { recursive: true });
mkdirSync(output); // No reuse or overwrite of earlier evidence.
const sourcePath = resolve(options.source);
const source = readFileSync(sourcePath, "utf8");

// These two dependency-free functions are the actual production builder and
// duration formatter, not copied FFmpeg arguments. Fail closed if they move.
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}\n", start) + 3;
  if (start < 0 || end <= start) throw new Error(`Cannot locate production function ${name}`);
  return source.slice(start, end);
}
const isolated = `export ${extract("buildAacTruePeakCorrectionArgs")}\n${extract("formatSeconds")}`;
const js = stripTypeScriptTypes(isolated);
const { buildAacTruePeakCorrectionArgs } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const bytes = Buffer.from(source);
const report = {
  scope:
    "Real-media timing checks of the isolated production argument builder; not the complete producer or its Vitest suite.",
  sourcePath,
  sourceBlob: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),
  sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  environment: {
    node: process.version,
    ffmpeg: execFileSync(options.ffmpeg, ["-version"], {
      encoding: "utf8",
      timeout: 10_000,
    }).split("\n")[0],
  },
  cases: [],
};
for (const kind of ["pcm", "aac"]) {
  for (const sampleRate of [44100, 48000]) {
    for (const channels of kind === "pcm" ? [1, 2] : [2]) {
      const directory = join(output, `${kind}-${sampleRate}-${channels}`);
      mkdirSync(directory);
      const entry = { kind, sampleRate, channels, passed: false };
      try {
        const check = kind === "pcm" ? checkPcmLimiterTiming : checkAacLimiterTiming;
        entry.measurements = check(buildAacTruePeakCorrectionArgs, {
          directory,
          ffmpeg: options.ffmpeg,
          sampleRate,
          channels,
        });
        entry.passed = true;
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error);
      }
      report.cases.push(entry);
      console.log(JSON.stringify(entry));
    }
  }
}
report.passed = report.cases.filter((entry) => entry.passed).length;
report.failed = report.cases.length - report.passed;
writeFileSync(join(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
process.exitCode = report.failed ? 1 : 0;
