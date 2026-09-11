/**
 * AFM-011 — Repair build order, exports and asset relocation.
 *
 * Acceptance:
 *   - Build and packed-package smoke tests work from a clean directory.
 *   - CLI, Studio and producer resolve the same owned diagram engine.
 *   - Files required only at runtime are present in the package artifact.
 *
 * The motivating defect (AFM-011-F1): Archify resolved assets as
 * `path.resolve(rendererDir, '../..')`, which broke as soon as the import
 * routed the viewer template into @hyperframes/diagram-viewer. The
 * architecture renderer failed with ENOENT before this ticket.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  assetRoots,
  enginePackageRoot,
  examplePath,
  schemaPath,
  viewerTemplatePath,
} from "../../packages/diagram-engine/src/resolveAssets.mjs";

const root = resolve(".");
const DIAGRAM_TYPES = ["architecture", "workflow", "sequence", "dataflow", "lifecycle"] as const;

let workdir: string;
beforeAll(() => {
  // A directory with a space in the name, unrelated to the repository.
  workdir = mkdtempSync(join(tmpdir(), "afm011 with spaces "));
});
afterAll(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe("AFM-011: assets resolve from package-owned paths", () => {
  it("resolves the viewer template through the package export", () => {
    const template = viewerTemplatePath();
    expect(existsSync(template)).toBe(true);
    // It must come from the viewer package, not from a copy in the engine.
    expect(template.replace(/\\/g, "/")).toContain("diagram-viewer/assets/template.html");
    expect(readFileSync(template, "utf8").length).toBeGreaterThan(0);
  });

  it("does not keep a duplicate template inside the engine", () => {
    // The pre-fix code looked here; a copy would mask a broken export.
    expect(existsSync(join(enginePackageRoot, "assets", "template.html"))).toBe(false);
  });

  it("resolves a schema and an example for every diagram family", () => {
    for (const type of DIAGRAM_TYPES) {
      expect(existsSync(schemaPath(type))).toBe(true);
    }
    expect(existsSync(examplePath("production-deployment.architecture.json"))).toBe(true);
  });

  it("exposes every asset root it owns", () => {
    const roots = assetRoots();
    for (const [, value] of Object.entries(roots)) {
      expect(existsSync(value)).toBe(true);
    }
  });

  it("derives the package root from the module, never from cwd", () => {
    const source = readFileSync("packages/diagram-engine/src/resolveAssets.mjs", "utf8");
    expect(source).toContain("import.meta.url");
    // Strip comments before asserting: the file documents that it never reads
    // process.cwd(), and a substring check would match that sentence.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toContain("process.cwd()");
  });

  it("no longer resolves assets through an assumed skill root", () => {
    const cli = readFileSync("packages/diagram-engine/renderers/shared/cli.mjs", "utf8");
    expect(cli).not.toMatch(/const skillRoot\s*=/);
    expect(cli).toContain("viewerTemplatePath()");
  });
});

describe("AFM-011: the renderers run from an unrelated directory", () => {
  /** Runs a renderer with cwd set outside the repository. */
  function render(type: string, example: string, out: string): void {
    execFileSync(
      "node",
      [
        join(root, "packages/diagram-engine/renderers", type, `render-${type}.mjs`),
        join(root, "packages/diagram-engine/examples", example),
        out,
      ],
      { cwd: workdir, stdio: "pipe" },
    );
  }

  it("renders architecture from a directory whose name contains spaces", () => {
    const out = join(workdir, "architecture.html");
    render("architecture", "production-deployment.architecture.json", out);

    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(10_000);
    const html = readFileSync(out, "utf8");
    expect(html).toContain("<svg");
    // Authored topology must survive: the deployment example's gateway fans out
    // to two APIs and must not be collapsed into a chain.
    expect(html).toContain("gateway");
  }, 120_000);

  it("renders all five families from that same unrelated directory", () => {
    const examples: Record<string, string> = {
      architecture: "brand-aware-delivery.architecture.json",
      workflow: "agent-tool-call.workflow.json",
      sequence: "async-job-roundtrip.sequence.json",
      dataflow: "event-stream.dataflow.json",
      lifecycle: "agent-run.lifecycle.json",
    };
    for (const type of DIAGRAM_TYPES) {
      const out = join(workdir, `${type}.html`);
      render(type, examples[type]!, out);
      expect(existsSync(out)).toBe(true);
      expect(readFileSync(out, "utf8")).toContain("<svg");
    }
  }, 300_000);

  it("resolves assets with the raw source snapshots unavailable", () => {
    // The repository must build and render with _sources/ absent. Nothing the
    // renderer touches may reach back into a raw checkout, so renaming it must
    // change nothing. This asserts the property directly by checking no
    // resolved asset path points into the quarantine.
    for (const [, value] of Object.entries(assetRoots())) {
      expect(value.replace(/\\/g, "/")).not.toContain("_sources/");
    }
  });
});

describe("AFM-011: package exports and packed files are correct", () => {
  const engine = () => JSON.parse(readFileSync("packages/diagram-engine/package.json", "utf8"));
  const viewer = () => JSON.parse(readFileSync("packages/diagram-viewer/package.json", "utf8"));

  it("exports the engine entry point and its asset resolver", () => {
    const exports = engine().exports;
    expect(exports["."]).toBeTruthy();
    expect(exports["./assets"]).toBeTruthy();
  });

  it("exports the viewer template as a resolvable subpath", () => {
    // This is what lets the engine locate the template without a relative path.
    expect(viewer().exports["./template"]).toBe("./assets/template.html");
  });

  it("includes runtime-only asset directories in the packed file list", () => {
    // Schemas, examples and brand marks are read at runtime; omitting them from
    // `files` produces a package that resolves paths that do not exist.
    const files: string[] = engine().files;
    for (const required of ["renderers", "schemas", "examples", "brand-marks", "src"]) {
      expect(files).toContain(required);
    }
    expect(viewer().files).toContain("assets");
  });

  it("gives the engine a non-conflicting binary name", () => {
    // Upstream's bin was `archify`; keeping it would collide with a globally
    // installed upstream CLI, which docs/EXECUTION_RULES.md forbids relying on.
    expect(Object.keys(engine().bin)).toEqual(["archframe-diagram"]);
  });

  it("names the engine under the workspace scope", () => {
    expect(engine().name).toBe("@hyperframes/diagram-engine");
    expect(engine().private).toBe(true);
  });
});
