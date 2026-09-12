import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileProject } from "@hyperframes/diagram-motion";
import type { ProjectSnapshot } from "@hyperframes/project-model";
import { projectAssetBuildFiles } from "./projectAssets";
import {
  assertContainedPath,
  canonicalJson,
  readCommittedProject,
  sha256,
} from "@hyperframes/project-model/revisions";

export interface PinnedBuild {
  hash: string;
  dir: string;
  revision: number;
  projectId: string;
  receipt: any;
}
const require = createRequire(import.meta.url);
const inFlight = new Map<string, Promise<PinnedBuild>>();

export function atomicJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 });
  renameSync(temporary, path);
}

export function verifyBuild(build: PinnedBuild): void {
  const receipt = JSON.parse(readFileSync(join(build.dir, "build-receipt.json"), "utf8"));
  if (receipt.buildHash !== build.hash)
    throw new Error("Build receipt does not match the pinned job input.");
  const { buildHash, ...body } = receipt;
  if (sha256(canonicalJson(body)) !== buildHash)
    throw new Error("Build receipt failed its content hash check.");
  for (const [name, expected] of Object.entries(receipt.files)) {
    const path = join(build.dir, name);
    assertContainedPath(build.dir, path);
    if (sha256(readFileSync(path)) !== expected)
      throw new Error(`Immutable build file was modified: ${name}.`);
  }
}

async function buildSnapshot(root: string, snapshot: ProjectSnapshot): Promise<PinnedBuild> {
  const compilation = await compileProject(snapshot);
  // GSAP is an installed workspace asset. No CDN request enters a render.
  compilation.files["assets/gsap.min.js"] = readFileSync(
    require.resolve("gsap/dist/gsap.min.js"),
    "utf8",
  );
  // Capture verified asset bytes before publishing the build. Each build owns
  // copies, not symlinks to uploads or to the project's retained asset blobs.
  const assetFiles = projectAssetBuildFiles(root, snapshot.manifest.assets);
  for (const path of Object.keys(assetFiles)) {
    if (Object.hasOwn(compilation.files, path))
      throw new Error(`Asset path collides with a compiled file: ${path}.`);
  }
  const buildFiles: Record<string, string | Buffer> = { ...compilation.files, ...assetFiles };
  const files = Object.fromEntries(
    Object.entries(buildFiles).map(([name, bytes]) => [name, sha256(bytes)]),
  );
  const body = { ...compilation.receipt, authoringHash: sha256(canonicalJson(snapshot)), files };
  const hash = sha256(canonicalJson(body));
  const receipt = { ...body, buildHash: hash };
  const dir = join(root, ".vflow/builds", hash);
  assertContainedPath(root, dir);
  if (!existsSync(dir)) {
    const staging = join(root, ".vflow/builds", `pending-${randomUUID()}`);
    for (const [name, bytes] of Object.entries(buildFiles)) {
      const path = join(staging, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
    }
    writeFileSync(join(staging, "build-receipt.json"), JSON.stringify(receipt, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    try {
      renameSync(staging, dir);
    } catch (error) {
      if (!existsSync(dir)) throw error;
    }
  }
  const build = {
    hash,
    dir,
    revision: snapshot.manifest.revision,
    projectId: snapshot.manifest.id,
    receipt,
  };
  verifyBuild(build);
  // A completion for an older revision cannot become the current preview.
  if (readCommittedProject(root).pointer.revision === snapshot.manifest.revision)
    atomicJson(join(root, ".vflow/LAST_BUILD.json"), {
      hash,
      revision: snapshot.manifest.revision,
    });
  return build;
}

export async function buildCommittedProject(root: string): Promise<PinnedBuild> {
  const current = readCommittedProject(root);
  const key = `${root}:${current.pointer.sha256}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = buildSnapshot(root, current.snapshot);
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}
