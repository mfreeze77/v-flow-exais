import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Window } from "happy-dom";

const root = resolve(".");
let workdir: string;
let consumer: string;
let installedEngine: string;
let installedViewer: string;

function isolatedNode(args: string[]) {
  return execFileSync("node", [
    "--experimental-permission",
    // The output-path guard stats parent directories while checking aliases.
    // Permit temporary fixtures, while /workspace (including _sources) remains
    // inaccessible and no workspace symlinks exist in the installed packages.
    `--allow-fs-read=${tmpdir()}`,
    `--allow-fs-write=${consumer}`,
    ...args,
  ], { cwd: consumer, encoding: "utf8", timeout: 120_000, stdio: "pipe" });
}

function render(kind: string, example: string, output: string) {
  isolatedNode([
    join(installedEngine, "renderers", kind, `render-${kind}.mjs`),
    example,
    output,
  ]);
  return readFileSync(output, "utf8");
}

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), "afm011 packed artifacts "));
  consumer = join(workdir, "isolated consumer");
  mkdirSync(consumer);
  const dependencies: Record<string, string> = {};
  for (const name of ["diagram-viewer", "diagram-engine"]) {
    const archive = join(workdir, `${name}.tgz`);
    execFileSync("bun", ["pm", "pack", "--ignore-scripts", "--filename", archive], {
      cwd: join(root, "packages", name), stdio: "pipe", timeout: 120_000,
    });
    expect(existsSync(archive)).toBe(true);
    dependencies[`@hyperframes/${name}`] = `file:${archive}`;
  }
  // These owned packages are intentionally private, so every transitive owned
  // dependency must resolve to its local archive instead of an upstream registry.
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "afm011-package-consumer", private: true, dependencies, overrides: dependencies,
  }));
  execFileSync("bun", ["install", "--ignore-scripts", "--backend=copyfile", "--linker=hoisted"], {
    cwd: consumer, stdio: "pipe", timeout: 180_000,
  });
  installedEngine = realpathSync(join(consumer, "node_modules/@hyperframes/diagram-engine"));
  installedViewer = realpathSync(join(consumer, "node_modules/@hyperframes/diagram-viewer"));
  expect(installedEngine.startsWith(`${consumer}/`)).toBe(true);
  expect(installedViewer.startsWith(`${consumer}/`)).toBe(true);
  const engineManifest = JSON.parse(readFileSync(join(installedEngine, "package.json"), "utf8"));
  const viewerManifest = JSON.parse(readFileSync(join(installedViewer, "package.json"), "utf8"));
  expect(engineManifest.dependencies["@hyperframes/diagram-viewer"]).toBe(viewerManifest.version);
}, 360_000);

afterAll(() => {
  if (workdir) rmSync(workdir, { recursive: true, force: true });
});

describe("AFM-011: actual installed archives without source-checkout access", () => {
  it("denies reads of the owned checkout and frozen raw inputs", () => {
    for (const path of [join(root, "package.json"), join(root, "_sources/archify-main/archify/package.json")]) {
      expect(() => isolatedNode(["-e", `require('node:fs').readFileSync(${JSON.stringify(path)})`])).toThrow(/ERR_ACCESS_DENIED/);
    }
  });

  it("renders all five families using only installed package contents", () => {
    const examples = {
      architecture: "brand-aware-delivery.architecture.json",
      workflow: "agent-tool-call.workflow.json",
      sequence: "async-job-roundtrip.sequence.json",
      dataflow: "event-stream.dataflow.json",
      lifecycle: "agent-run.lifecycle.json",
    };
    for (const [kind, example] of Object.entries(examples)) {
      const html = render(kind, join(installedEngine, "examples", example), join(consumer, `${kind}.html`));
      expect(html).toContain("<svg");
    }
  }, 300_000);

  it("preserves explicit relationship identities, endpoints and arrow direction", () => {
    const source = JSON.parse(readFileSync(join(installedEngine, "examples/production-deployment.architecture.json"), "utf8"));
    source.connections.forEach((edge: { id?: string }, index: number) => { edge.id = `deployment-edge-${index + 1}`; });
    const input = join(consumer, "deployment with identities.json");
    writeFileSync(input, JSON.stringify(source));
    const html = render("architecture", input, join(consumer, "deployment.html"));
    const window = new Window();
    window.document.body.innerHTML = html;
    const paths = [...window.document.querySelectorAll("svg path[data-edge-id]")];
    expect(paths.map((edge) => ({
      id: edge.getAttribute("data-edge-id"), from: edge.getAttribute("data-edge-from"), to: edge.getAttribute("data-edge-to"),
    }))).toEqual(source.connections.map(({ id, from, to }: { id: string; from: string; to: string }) => ({ id, from, to })));
    for (const edge of paths) {
      expect(edge.getAttribute("d")).toMatch(/^M/);
      const marker = edge.getAttribute("marker-end")?.match(/^url\(#(.+)\)$/)?.[1];
      expect(marker).toBeTruthy();
      expect(window.document.getElementById(marker!)).not.toBeNull();
    }
    window.close();
  }, 120_000);

  it("fails when the packed viewer template is missing instead of reaching into the checkout", () => {
    const template = join(installedViewer, "assets/template.html");
    renameSync(template, `${template}.held`);
    try {
      expect(() => render("architecture", join(installedEngine, "examples/web-app.architecture.json"), join(consumer, "missing-template.html")))
        .toThrow(/Cannot resolve the diagram viewer template/);
      expect(existsSync(join(consumer, "missing-template.html"))).toBe(false);
    } finally {
      renameSync(`${template}.held`, template);
    }
  });
});
