import fs from 'node:fs';
import path from 'node:path';
import { applyTemplate, renderCards, esc } from './utils.mjs';
import { validateSchema } from './validator.mjs';
import { verifyRepositoryEvidence } from './repository-evidence.mjs';
import { installRendererDiagnosticBoundary, throwDiagnosticProblems } from './diagnostics.mjs';
import { validateEngineeringProfile } from './engineering-profiles.mjs';
import { resolveOutputPath } from './output-path.mjs';
import { prepareDiagramBrandMarks } from './brand-marks.mjs';
import { validateGuidedViews, validateRelationshipIds } from './semantics.mjs';
export * from './semantics.mjs';
import { examplePath, viewerTemplatePath } from '../../src/resolveAssets.mjs';

installRendererDiagnosticBoundary();

const outputPathGuards = new Map();

// Common CLI head: node render-<type>.mjs [input.json] [output.html]
// Keep this synchronous because callers also use it to establish the guarded
// output path before testing a last-moment filesystem alias change.
export function loadDiagram({ rendererDir, diagramType, defaultExample, argv = process.argv }) {
  // AFM-011: assets are resolved from package-owned paths, not from a assumed
  // skill root two levels above the renderer. The viewer template now lives in
  // @hyperframes/diagram-viewer, so `path.resolve(rendererDir, '../..')` no
  // longer finds it.
  const inputPath = path.resolve(argv[2] || examplePath(defaultExample));
  const diagram = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  validateSchema(diagramType, diagram);
  validateGuidedViews(diagramType, diagram);
  validateRelationshipIds(diagramType, diagram);
  validateEngineeringProfile(diagramType, diagram);
  const sourceEvidence = verifyRepositoryEvidence(diagramType, diagram, process.env.ARCHIFY_REPO_ROOT);
  const template = fs.readFileSync(viewerTemplatePath(), 'utf8');
  const outputRequest = {
    requestedOutput: argv[3],
    authoredOutput: diagram.meta?.output,
    defaultOutput: `${diagramType}.html`,
    inputPaths: [inputPath],
    cwd: process.cwd(),
  };
  const { outputPath: outPath } = resolveOutputPath(outputRequest);
  outputPathGuards.set(outPath, outputRequest);
  return { diagram, template, outPath, sourceEvidence };
}

// Brand URL capture is the only asynchronous authoring step. Typed renderers
// opt into it through this wrapper without changing loadDiagram's long-lived
// synchronous safety contract.
export async function loadDiagramWithBrandMarks(options) {
  const loaded = loadDiagram(options);
  await prepareDiagramBrandMarks(options.diagramType, loaded.diagram);
  return loaded;
}

const START_TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);

// Common CLI tail: fill the template and write the standalone HTML file.
export function writeDiagram({ outPath, template, diagramType, meta, svg, cards, sourceEvidence = null }) {
  if (!START_TYPES.has(diagramType)) throw new Error(`writeDiagram: unknown diagram type ${JSON.stringify(diagramType)}`);
  const outputGuard = outputPathGuards.get(outPath);
  if (outputGuard) resolveOutputPath(outputGuard);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, applyTemplate(template, {
    title: meta.title,
    subtitle: meta.subtitle,
    svg,
    cards: renderCards(cards),
    locale: meta.locale,
    visualPreset: meta.visual_preset || 'classic',
    guidedViews: meta.views || [],
    sourceEvidence,
  }));
  outputPathGuards.delete(outPath);
  console.log(outPath);
}
