import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";
import {
  assertProjectAsset,
  MAX_PROJECT_ASSET_BYTES,
  projectAssetProblems,
  projectAssetRegistryProblems,
  sameProjectAsset,
  type ProjectAsset,
} from "@hyperframes/project-model";
import {
  projectAssetBuildFiles,
  readProjectAssetBytes,
  stageProjectAsset,
  verifyProjectAssets,
} from "./projectAssets";
import { pngAssetFixture, wavAssetFixture } from "./projectAssets.fixture";

// Use an explicit binary in the standalone diagnostic; normal package runs use PATH.
const ffprobe = process.env.VFLOW_ASSET_TEST_FFPROBE ?? "ffprobe";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture(bytes = wavAssetFixture(), name = "voice.wav") {
  const dir = mkdtempSync(join(tmpdir(), "vflow-asset-test-"));
  roots.push(dir);
  const root = join(dir, "project");
  mkdirSync(root);
  const input = join(dir, name);
  writeFileSync(input, bytes);
  return { dir, root, input, bytes };
}
function blobPath(root: string, asset: ProjectAsset, file?: string) {
  return join(
    root,
    ".vflow",
    "asset-blobs",
    asset.sha256,
    file ?? `payload.${asset.kind === "audio" ? "wav" : "png"}`,
  );
}
function executable(dir: string, body: string) {
  const path = join(dir, "probe-test");
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o700);
  return path;
}

describe("AFM-023: local bytes and measured metadata", () => {
  it("copies and probes WAV without modifying the source or retaining its absolute path", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    assert.equal(asset.kind, "audio");
    if (asset.kind !== "audio") throw new Error("Expected WAV asset.");
    assert.equal(asset.metadata.durationSeconds, 2);
    assert.equal(asset.metadata.sampleRate, 48000);
    assert.equal(asset.metadata.channels, 1);
    assert.equal(asset.sha256, createHash("sha256").update(f.bytes).digest("hex"));
    assert.equal(asset.rights, "unverified");
    assert.equal(JSON.stringify(asset).includes(f.dir), false);
    assert.deepEqual(readFileSync(f.input), f.bytes);
    assert.deepEqual(readProjectAssetBytes(f.root, asset), f.bytes);
  });
  it("copies and probes PNG as a measured image", async () => {
    const f = fixture(pngAssetFixture(), "logo.png");
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    assert.equal(asset.kind, "image");
    if (asset.kind !== "image") throw new Error("Expected PNG asset.");
    assert.equal(asset.metadata.width, 1);
    assert.equal(asset.metadata.height, 1);
    assert.equal(asset.metadata.codec, "png");
    assert.deepEqual(readProjectAssetBytes(f.root, asset), f.bytes);
  });
  it("survives deletion of the original import location", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    rmSync(f.input);
    assert.deepEqual(readProjectAssetBytes(f.root, asset), f.bytes);
  });
  it("deduplicates identical bytes with different filenames and preserves first provenance", async () => {
    const f = fixture();
    const first = await stageProjectAsset(f.root, f.input, ffprobe);
    const other = join(f.dir, "renamed.without-extension");
    writeFileSync(other, f.bytes);
    const second = await stageProjectAsset(f.root, other, ffprobe);
    assert.equal(sameProjectAsset(first, second), true);
    assert.equal(second.origin.name, "voice.wav");
    assert.deepEqual(readdirSync(join(f.root, ".vflow", "asset-blobs")), [first.sha256]);
  });
  it("does not reuse a filename's old identity when its bytes change", async () => {
    const f = fixture();
    const first = await stageProjectAsset(f.root, f.input, ffprobe);
    writeFileSync(f.input, wavAssetFixture(2, 123));
    const second = await stageProjectAsset(f.root, f.input, ffprobe);
    assert.notEqual(first.id, second.id);
    assert.deepEqual(readProjectAssetBytes(f.root, first), f.bytes);
  });
  it("concurrent publication converges on one complete blob and one provenance record", async () => {
    const f = fixture();
    const other = join(f.dir, "second.wav");
    writeFileSync(other, f.bytes);
    const [first, second] = await Promise.all([
      stageProjectAsset(f.root, f.input, ffprobe),
      stageProjectAsset(f.root, other, ffprobe),
    ]);
    assert.equal(sameProjectAsset(first, second), true);
    assert.deepEqual(readdirSync(join(f.root, ".vflow", "asset-blobs")), [first.sha256]);
    assert.deepEqual(readProjectAssetBytes(f.root, first), f.bytes);
  });
});

describe("AFM-023: invalid inputs fail rather than becoming registered media", () => {
  it("rejects an empty source", async () => {
    const f = fixture(Buffer.alloc(0));
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /asset\/invalid-size/);
  });
  it("rejects oversized sources before reading their bytes", async () => {
    const f = fixture();
    truncateSync(f.input, MAX_PROJECT_ASSET_BYTES + 1);
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /asset\/invalid-size/);
  });
  it("rejects a directory used as an import file", async () => {
    const f = fixture();
    await assert.rejects(stageProjectAsset(f.root, f.dir, ffprobe), /invalid-size|EISDIR/);
  });
  it("rejects a symlink used as an import file", async () => {
    const f = fixture();
    const link = join(f.dir, "linked.wav");
    symlinkSync(f.input, link);
    await assert.rejects(stageProjectAsset(f.root, link, ffprobe));
  });
  it("does not trust a filename extension as media validation", async () => {
    const f = fixture(Buffer.from("not wav media"));
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /unsupported-media/);
  });
  it("rejects a corrupt PNG checksum even if ffprobe would recognize the header", async () => {
    const bytes = pngAssetFixture();
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    const f = fixture(bytes, "bad.png");
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /invalid-png/);
  });
  it("rejects a truncated PNG chunk", async () => {
    const f = fixture(pngAssetFixture().subarray(0, 40), "bad.png");
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /invalid-png/);
  });
  it("rejects a WAV whose declared RIFF length does not match the bytes", async () => {
    const bytes = wavAssetFixture();
    bytes.writeUInt32LE(bytes.length + 8000, 4);
    const f = fixture(bytes);
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /invalid-wav/);
  });
  it("requires a successful probe instead of accepting an unavailable executable", async () => {
    const f = fixture();
    await assert.rejects(
      stageProjectAsset(f.root, f.input, join(f.dir, "absent-probe")),
      /probe-failed/,
    );
    assert.deepEqual(readdirSync(join(f.root, ".vflow", "asset-blobs")), []);
  });
  it("rejects a nonzero probe and removes unpublished staging only", async () => {
    const f = fixture();
    const binary = executable(f.dir, "exit 7");
    await assert.rejects(stageProjectAsset(f.root, f.input, binary), /probe-failed/);
    assert.deepEqual(readdirSync(join(f.root, ".vflow", "asset-blobs")), []);
  });
  it("rejects invalid JSON from a probe", async () => {
    const f = fixture();
    const binary = executable(f.dir, "printf 'not-json'");
    await assert.rejects(stageProjectAsset(f.root, f.input, binary), /probe-failed/);
  });
  it("rejects a successful probe with no matching stream", async () => {
    const f = fixture();
    const binary = executable(f.dir, "printf '%s' '{\"streams\":[]}'");
    await assert.rejects(stageProjectAsset(f.root, f.input, binary), /expected media stream/);
  });
  it("rejects control characters in local display names", async () => {
    const f = fixture(wavAssetFixture(), "bad\tname.wav");
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /invalid-name/);
  });
});

describe("AFM-023: storage integrity and build independence", () => {
  it("rejects a .vflow symlink without writing into the target", async () => {
    const f = fixture();
    const outside = join(f.dir, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(f.root, ".vflow"));
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /unsafe-store/);
    assert.deepEqual(readdirSync(outside), []);
  });
  it("rejects a symlink in the blob store path", async () => {
    const f = fixture();
    mkdirSync(join(f.root, ".vflow"));
    const outside = join(f.dir, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(f.root, ".vflow", "asset-blobs"));
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /unsafe-store/);
  });
  it("detects modified bytes even if their length did not change", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    const changed = Buffer.from(f.bytes);
    changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    writeFileSync(blobPath(f.root, asset), changed);
    assert.throws(() => readProjectAssetBytes(f.root, asset), /asset\/integrity/);
  });
  it("detects missing bytes and does not silently overwrite a damaged record on reimport", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    rmSync(blobPath(f.root, asset));
    assert.throws(() => verifyProjectAssets(f.root, [asset]));
    await assert.rejects(stageProjectAsset(f.root, f.input, ffprobe), /incomplete stored asset/);
    assert.equal(existsSync(blobPath(f.root, asset)), false);
  });
  it("rejects a payload symlink instead of hashing unrelated bytes", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    const payload = blobPath(f.root, asset);
    rmSync(payload);
    symlinkSync(f.input, payload);
    assert.throws(() => readProjectAssetBytes(f.root, asset));
  });
  it("rejects manifest metadata which was not measured for the staged asset", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    if (asset.kind !== "audio") throw new Error("Expected audio.");
    const forged = { ...asset, metadata: { ...asset.metadata, durationSeconds: 99 } };
    assert.throws(() => readProjectAssetBytes(f.root, forged), /metadata differs/);
  });
  it("returns independent verified build bytes, not a path or link to the original", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    const build = projectAssetBuildFiles(f.root, [asset]);
    rmSync(f.input);
    writeFileSync(blobPath(f.root, asset), Buffer.from("tampered"));
    assert.deepEqual(build[asset.path], f.bytes);
    assert.throws(() => projectAssetBuildFiles(f.root, [asset]), /integrity/);
  });
  it("does no filesystem work for legacy projects without assets", () => {
    const missing = join(tmpdir(), "absent-vflow-assets", "project");
    verifyProjectAssets(missing);
    assert.deepEqual(projectAssetBuildFiles(missing), {});
    assert.equal(existsSync(missing), false);
  });
});

describe("AFM-023: portable registry contract", () => {
  it("rejects path traversal and forged content identities", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    assert.throws(() => assertProjectAsset({ ...asset, path: "../../secret.wav" }), /invalid/);
    assert.throws(() => assertProjectAsset({ ...asset, id: "different" }), /invalid/);
  });
  it("rejects unknown fields, estimated metadata and unsupported rights claims", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    assert.ok(projectAssetProblems({ ...asset, absolutePath: f.input }).length);
    assert.ok(projectAssetProblems({ ...asset, rights: "licensed" }).length);
    assert.ok(
      projectAssetProblems({ ...asset, metadata: { ...asset.metadata, measured: false } }).length,
    );
  });
  it("rejects duplicate registry identities and authoring path collisions", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    assert.ok(
      projectAssetRegistryProblems([asset, asset]).some((message) => message.includes("duplicate")),
    );
    assert.ok(
      projectAssetRegistryProblems([asset], [asset.path]).some((message) =>
        message.includes("collides"),
      ),
    );
  });
  it("rejects invalid and nonfinite numeric metadata", async () => {
    const f = fixture();
    const asset = await stageProjectAsset(f.root, f.input, ffprobe);
    for (const durationSeconds of [0, -1, NaN, Infinity]) {
      assert.ok(
        projectAssetProblems({ ...asset, metadata: { ...asset.metadata, durationSeconds } }).length,
      );
    }
  });
});
