import { createHash } from 'node:crypto';
import { compileArchitecture } from '../renderers/architecture/compile-architecture.mjs';
import { compileWorkflow } from '../renderers/workflow/workflow-compiler.mjs';
import { compileSequence } from '../renderers/sequence/compile-sequence.mjs';
import { compileDataflow } from '../renderers/dataflow/compile-dataflow.mjs';
import { compileLifecycle } from '../renderers/lifecycle/compile-lifecycle.mjs';
import { validateSchema } from '../renderers/shared/validator.mjs';
import { validateGuidedViews, validateRelationshipIds } from '../renderers/shared/semantics.mjs';
import { validateEngineeringProfile } from '../renderers/shared/engineering-profiles.mjs';
import { prepareDiagramBrandMarks } from '../renderers/shared/brand-marks.mjs';
import { withCompilationContext } from '../renderers/shared/compilation-context.mjs';
import { diagramStyles } from './styles.mjs';

export const ENGINE_VERSION = '2.17.0-dev.1+afm027.1';
const compilers = { architecture: compileArchitecture, sequence: compileSequence, dataflow: compileDataflow, lifecycle: compileLifecycle };
const objectKeys = { architecture: 'components', workflow: 'nodes', sequence: 'participants', dataflow: 'nodes', lifecycle: 'states' };
const edgeKeys = { architecture: 'connections', workflow: 'edges', sequence: 'messages', dataflow: 'flows', lifecycle: 'transitions' };
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const fail = (code, message, pointer = '/') => ({ code, severity: 'error', message, pointer });

/** No implicit IO: optional resolvers are the only authority to resolve external data. */
export async function compileDiagram(request) {
  const context = { qualityProfile: request?.options?.qualityProfile, diagnostics: [] };
  return withCompilationContext(context, async () => {
    try {
      const { kind, source, theme = 'dark', preset, options = {}, resolveAsset, resolveEvidence } = request || {};
      if (!Object.hasOwn(objectKeys, kind)) return { ok: false, diagnostics: [fail('diagram/kind', 'Choose one of the five supported diagram kinds.')] };
      if (!['dark', 'light'].includes(theme)) return { ok: false, diagnostics: [fail('diagram/theme', 'Theme must be dark or light.')] };
      if (options.qualityProfile && !['standard', 'showcase'].includes(options.qualityProfile)) return { ok: false, diagnostics: [fail('diagram/quality', 'Unsupported quality profile.')] };
      if (preset && !['classic', 'signal-flow', 'blueprint', 'editorial'].includes(preset)) return { ok: false, diagnostics: [fail('diagram/preset', 'Unsupported visual preset.')] };
      const diagram = structuredClone(source);
      validateSchema(kind, diagram);
      validateGuidedViews(kind, diagram);
      validateRelationshipIds(kind, diagram);
      validateEngineeringProfile(kind, diagram);
      // Presentation may disable the viewer's autonomous trace. Authored JSON is untouched.
      if (!options.standaloneAnimation) delete diagram.meta.animation;
      if (preset) diagram.meta.visual_preset = preset;
      await prepareDiagramBrandMarks(kind, diagram, {
        offline: true,
        resolveAsset: resolveAsset ? async (reference) => {
          const asset = await resolveAsset(structuredClone(reference));
          if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType)) throw new Error('Resolved brand assets must be local PNG, JPEG or WebP bytes.');
          if (!(asset.bytes instanceof Uint8Array) || asset.bytes.length > 2_000_000) throw new Error('Resolved brand asset exceeds its byte limit.');
          const bytes = Buffer.from(asset.bytes);
          return { id: reference.sha256, title: asset.title || 'Pinned brand', kind: 'remote', status: 'captured', sha256: createHash('sha256').update(bytes).digest('hex'), dataUrl: `data:${asset.mimeType};base64,${bytes.toString('base64')}` };
        } : undefined,
      });
      let compiled;
      if (kind === 'workflow') {
        const result = compileWorkflow({ workflow: diagram, qualityProfile: options.qualityProfile ?? diagram.meta.quality_profile });
        if (!result.ok) return { ok: false, diagnostics: result.diagnostics || context.diagnostics, report: result.receipt };
        compiled = { svg: result.svg, viewBox: result.receipt.viewBox, objects: result.receipt.nodes, relationships: result.receipt.edges, groups: [], report: result.receipt };
      } else compiled = compilers[kind](diagram);
      const sourceHash = hash(source);
      const diagnostics = context.diagnostics;
      const sourceObjects = new Map(source[objectKeys[kind]].map((node) => [node.id, node]));
      const objects = compiled.objects.map((node) => ({
        id: node.id, kind: 'object', label: sourceObjects.get(node.id)?.label || node.label || node.id,
        bounds: { x: node.x, y: node.y, width: node.width, height: node.height },
        sourcePointer: `/${objectKeys[kind]}/${source[objectKeys[kind]].findIndex((entry) => entry.id === node.id)}`,
      }));
      const relationships = compiled.relationships.map((edge, index) => {
        const authored = source[edgeKeys[kind]][index];
        if (authored.id == null) diagnostics.push({ code: 'identity/migration-required', severity: 'warning', pointer: `/${edgeKeys[kind]}/${index}/id`, message: 'Assign and persist a stable relationship ID during project import before animation.' });
        return { id: authored.id ?? null, kind: 'relationship', from: authored.from, to: authored.to, label: authored.label ?? null,
          path: edge.d || '', points: edge.points, labelAt: edge.labelAt ?? null, sourcePointer: `/${edgeKeys[kind]}/${index}` };
      });
      const evidence = resolveEvidence ? await resolveEvidence({ kind, source: structuredClone(source), sourceHash }) : null;
      const artifact = {
        schemaVersion: 1, engineVersion: ENGINE_VERSION, kind, sourceHash, theme, preset: preset || source.meta.visual_preset || 'classic',
        svg: compiled.svg, styles: diagramStyles, viewBox: [0, 0, ...compiled.viewBox],
        objects, groups: compiled.groups, relationships, guidedViews: structuredClone(source.meta.views || []),
        diagnostics, evidence, report: compiled.report ?? null,
      };
      return { ok: true, artifact: { ...artifact, artifactHash: hash(artifact) }, diagnostics };
    } catch (error) {
      const diagnostics = error?.archifyDiagnostics?.length ? error.archifyDiagnostics.map((entry) => ({ ...entry, pointer: entry.subject?.instancePath || entry.subject?.path || '/' }))
        : [fail('diagram/compile', error?.message || 'Diagram compilation failed.')];
      return { ok: false, diagnostics };
    }
  });
}
