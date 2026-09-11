import { loadDiagramWithBrandMarks, writeDiagram } from "./cli.mjs";
import { compileDiagram } from "../../src/compile.mjs";
import { throwDiagnosticError } from "./diagnostics.mjs";
import { brandMarkFor } from "./brand-marks.mjs";

export async function runRenderer(kind, defaultExample) {
  const layoutJson = process.argv.includes("--layout-json");
  const loaded = await loadDiagramWithBrandMarks({
    diagramType: kind,
    defaultExample,
    argv: process.argv.filter((arg) => arg !== "--layout-json"),
  });
  const marks = Object.values(loaded.diagram)
    .filter(Array.isArray)
    .flat()
    .map(brandMarkFor)
    .filter(Boolean);
  const result = await compileDiagram({
    kind,
    source: loaded.diagram,
    options: { qualityProfile: process.env.ARCHIFY_QUALITY_PROFILE, standaloneAnimation: true },
    resolveAsset: async (reference) => {
      const mark = marks.find((entry) => entry.sha256 === reference.sha256);
      const match = mark?.dataUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      if (!match) throw new Error("Pinned capture is unavailable as a supported local image.");
      return { mimeType: match[1], bytes: Buffer.from(match[2], "base64"), title: mark.title };
    },
  });
  if (layoutJson && kind === "workflow" && !result.ok) {
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  if (!result.ok)
    throwDiagnosticError(
      result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
      result.diagnostics,
    );
  if (layoutJson) {
    process.stdout.write(`${JSON.stringify(result.artifact.report, null, 2)}\n`);
    return;
  }
  writeDiagram({
    ...loaded,
    diagramType: kind,
    meta: loaded.diagram.meta,
    cards: loaded.diagram.cards,
    svg: result.artifact.svg,
  });
}
