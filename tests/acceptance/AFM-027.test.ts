import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Window } from "happy-dom";
import {
  compileDiagram,
  examplePath,
  DIAGRAM_TYPES,
} from "../../packages/diagram-engine/src/index.mjs";

const names = [
  "web-app.architecture.json",
  "agent-tool-call.workflow.json",
  "cache-miss-request.sequence.json",
  "product-analytics.dataflow.json",
  "agent-run.lifecycle.json",
];
const fixture = (name: string) => JSON.parse(readFileSync(examplePath(name), "utf8"));
const edgeKeys = ["connections", "edges", "messages", "flows", "transitions"];

describe("AFM-027 / AFM-029 callable owned geometry", () => {
  it("imports with forbidden argv, filesystem adapters, network and process handlers", () => {
    const script = `import fs from 'node:fs'; import net from 'node:net'; import http from 'node:http'; import https from 'node:https'; import {syncBuiltinESMExports} from 'node:module';
      const deny = () => { throw new Error('forbidden side effect'); };
      for (const key of ['readFileSync','writeFileSync','existsSync','mkdirSync','readdirSync','statSync']) fs[key] = deny;
      for (const key of ['readFile','writeFile','readdir','mkdir','stat']) fs.promises[key] = deny;
      net.connect = net.createConnection = net.createServer = http.request = http.get = https.request = https.get = deny;
      Object.defineProperty(process, 'argv', { get: deny }); process.on = deny; process.exit = deny; syncBuiltinESMExports();
      const engine = await import(${JSON.stringify(pathToFileURL(resolve("packages/diagram-engine/src/index.mjs")).href)});
      if(typeof engine.compileDiagram !== 'function') throw new Error('missing API'); process.stdout.write('import-only passed');`;
    expect(execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" })).toBe(
      "import-only passed",
    );
  });

  it.each(DIAGRAM_TYPES)(
    "compiles %s concurrently without mutation, leaking options or invoking IO",
    async (kind) => {
      const input = fixture(names[DIAGRAM_TYPES.indexOf(kind)]);
      const before = JSON.stringify(input);
      const isolated = await compileDiagram({ kind, source: input, theme: "dark" });
      const [a, b] = await Promise.all([
        compileDiagram({ kind, source: input, theme: "dark" }),
        compileDiagram({
          kind,
          source: { ...input, meta: { ...input.meta, title: "Independent title" } },
          theme: "light",
          options: { qualityProfile: "standard" },
        }),
      ]);
      expect(a).toEqual(isolated);
      expect(a.ok, JSON.stringify(a.diagnostics)).toBe(true);
      expect(b.ok, JSON.stringify(b.diagnostics)).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(a.artifact.sourceHash).not.toBe(b.artifact.sourceHash);
      expect(a.artifact.theme).toBe("dark");
      expect(b.artifact.theme).toBe("light");
      expect(a.artifact.relationships.map((edge) => [edge.from, edge.to, edge.label])).toEqual(
        input[edgeKeys[DIAGRAM_TYPES.indexOf(kind)]].map((edge: any) => [
          edge.from,
          edge.to,
          edge.label ?? null,
        ]),
      );
      expect(
        a.artifact.objects.every((node) => Object.values(node.bounds).every(Number.isFinite)),
      ).toBe(true);
      expect(
        a.artifact.relationships.every((edge) => edge.points.length >= 2 && edge.path.length > 0),
      ).toBe(true);
      expect(JSON.stringify(input)).toBe(before);
    },
  );

  it.each(DIAGRAM_TYPES)("returns the same %s SVG to the compatibility CLI", async (kind) => {
    const inputName = names[DIAGRAM_TYPES.indexOf(kind)];
    const result = await compileDiagram({
      kind,
      source: fixture(inputName),
      options: { standaloneAnimation: true },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dir = mkdtempSync(join(tmpdir(), "afm027-"));
    try {
      const out = join(dir, "diagram.html");
      execFileSync("node", [
        `packages/diagram-engine/renderers/${kind}/render-${kind}.mjs`,
        examplePath(inputName),
        out,
      ]);
      const window = new Window();
      window.document.body.innerHTML = readFileSync(out, "utf8");
      const cli = window.document.querySelector(
        'svg[aria-labelledby="archify-diagram-title archify-diagram-description"]',
      )?.outerHTML;
      window.document.body.innerHTML = result.artifact.svg;
      expect(cli).toBe(window.document.querySelector("svg")?.outerHTML);
      window.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves deployment branches and explicit parallel relationship identities", async () => {
    const source = fixture("production-deployment.architecture.json");
    source.connections.forEach((edge: any, index: number) => {
      edge.id = `authored-edge-${index}`;
    });
    const result = await compileDiagram({ kind: "architecture", source });
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.relationships.map(({ id, from, to }) => ({ id, from, to }))).toEqual(
      source.connections.map(({ id, from, to }: any) => ({ id, from, to })),
    );
    expect(
      result.artifact.relationships
        .filter((edge) => edge.from === "gateway")
        .map((edge) => edge.to)
        .sort(),
    ).toEqual(["api_a", "api_b"]);
    expect(
      result.artifact.relationships.some((edge) => edge.from === "api_a" && edge.to === "api_b"),
    ).toBe(false);
  });

  it("returns structured failure and leaves the host usable", async () => {
    const input = fixture(names[0]);
    input.connections[0].to = "missing";
    const result = await compileDiagram({ kind: "architecture", source: input });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toContain("missing");
    expect((await compileDiagram({ kind: "architecture", source: fixture(names[0]) })).ok).toBe(
      true,
    );
  });
});
