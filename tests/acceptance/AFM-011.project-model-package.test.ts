/**
 * AFM-011 — the packed project-model must *perform its operation*, not merely import.
 *
 * Exposing a `node` condition pointing at `dist/storage.js` made the package
 * importable under Node while every worker-backed commit failed: the worker was
 * located with `new URL("./worker.mjs", import.meta.url)`, which resolves beside
 * the *bundled* entry, and tsup emits no worker there. The Bun source path kept
 * working and concealed it, so the root build was green and a real operation
 * through the new Node entry was broken.
 *
 * These tests pack and install the package into an isolated consumer, then run
 * a real worker-backed commit under Node. An import-only assertion would have
 * passed throughout the broken period.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { projectFixture } from "../../packages/project-model/src/test-fixture.ts";

const root = resolve(".");
let work: string;
let consumer: string;
let packed = false;

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "afm011-pkg-"));
  consumer = join(work, "app");

  try {
    execFileSync("bun", ["run", "--filter", "@hyperframes/project-model", "build"], {
      cwd: root,
      stdio: "pipe",
    });
    execFileSync("bun", ["pm", "pack", "--destination", work], {
      cwd: join(root, "packages/project-model"),
      stdio: "pipe",
    });
    const tarball = execFileSync("sh", ["-c", `ls ${work}/*.tgz | head -1`], {
      encoding: "utf8",
    }).trim();

    execFileSync("mkdir", ["-p", consumer]);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({ name: "consumer", type: "module", private: true }),
    );
    execFileSync("npm", ["install", "--silent", tarball], { cwd: consumer, stdio: "pipe" });
    packed = true;
  } catch (error) {
    // Leave `packed` false so the tests report a clear reason rather than a
    // confusing downstream failure.
    console.error("pack/install failed:", (error as Error).message);
  }
}, 600_000);

afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

const installed = (...segments: string[]) =>
  join(consumer, "node_modules/@hyperframes/project-model", ...segments);

describe("AFM-011: the packed project-model ships what it resolves at runtime", () => {
  it("packs and installs", () => {
    expect(packed).toBe(true);
  });

  it("ships the commit worker the built entry resolves", () => {
    // dist/storage.js resolves the worker relative to itself. Whichever layout
    // the resolver chooses, the file it picks has to be in the tarball.
    expect(existsSync(installed("src/storage/worker.mjs"))).toBe(true);
  });

  it("ships the schemas the worker reads at runtime", () => {
    // The worker validates against ../schemas/project.schema.json. Omitting it
    // produced a package that imported, spawned its worker, and then failed
    // inside it - one layer deeper than the previous bug.
    expect(existsSync(installed("schemas"))).toBe(true);
  });

  it("exposes a Node condition that actually exists", () => {
    const manifest = JSON.parse(readFileSync(installed("package.json"), "utf8"));
    for (const [subpath, entry] of Object.entries(manifest.exports as Record<string, unknown>)) {
      if (typeof entry !== "object" || entry === null) continue;
      const nodeEntry = (entry as Record<string, string>).node;
      if (!nodeEntry) continue;
      expect(
        existsSync(installed(nodeEntry.replace(/^\.\//, ""))),
        `${subpath} declares node: ${nodeEntry}, which is not in the package`,
      ).toBe(true);
    }
  });
});

describe("AFM-011: the installed package performs a worker-backed commit", () => {
  /** Runs a script inside the isolated consumer under real Node. */
  function runInConsumer(script: string): string {
    writeFileSync(join(consumer, "probe.mjs"), script);
    return execFileSync("node", ["probe.mjs"], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    }).trim();
  }

  it("initializes a project through the Node storage entry", () => {
    writeFileSync(join(consumer, "fixture.json"), JSON.stringify(projectFixture()));
    const out = runInConsumer(`
      import { mkdtempSync, readFileSync } from "node:fs";
      import { tmpdir } from "node:os";
      import { join } from "node:path";
      const { initializeProject } = await import("@hyperframes/project-model/storage");
      const snapshot = JSON.parse(readFileSync("fixture.json", "utf8"));
      const root = mkdtempSync(join(tmpdir(), "afm011-run-"));
      const result = await initializeProject(root, snapshot);
      console.log(JSON.stringify({ revision: result.pointer.revision, root }));
    `);
    const parsed = JSON.parse(out);
    expect(parsed.revision).toBe(0);
  }, 300_000);

  it("reopens the committed project and reads it back", () => {
    const out = runInConsumer(`
      import { mkdtempSync, readFileSync } from "node:fs";
      import { tmpdir } from "node:os";
      import { join } from "node:path";
      const storage = await import("@hyperframes/project-model/storage");
      const revisions = await import("@hyperframes/project-model/revisions");
      const snapshot = JSON.parse(readFileSync("fixture.json", "utf8"));
      const root = mkdtempSync(join(tmpdir(), "afm011-reopen-"));
      await storage.initializeProject(root, snapshot);
      const reopened = revisions.readCommittedProject(root);
      console.log(JSON.stringify({
        id: reopened.snapshot?.manifest?.id ?? null,
        revision: reopened.pointer?.revision ?? null,
      }));
    `);
    const parsed = JSON.parse(out);
    expect(parsed.id).toBe("project-test");
    expect(parsed.revision).toBe(0);
  }, 300_000);
});
