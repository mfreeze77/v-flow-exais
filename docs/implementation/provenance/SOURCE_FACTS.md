# Selected verified source observations

These are excerpts from the uploaded snapshots, not new APIs or proof of a built integration. Full path hashes are in SOURCE_INVENTORY.json. Open-source attribution is retained in licenses/. No font data is included.

## `archify-main/archify/renderers/shared/cli.mjs` lines 19–69

```text
19: export function loadDiagram({ rendererDir, diagramType, defaultExample, argv = process.argv }) {
20:   const skillRoot = path.resolve(rendererDir, '../..');
21:   const inputPath = path.resolve(argv[2] || path.join(skillRoot, 'examples', defaultExample));
22:   const diagram = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
23:   validateSchema(diagramType, diagram);
24:   validateGuidedViews(diagramType, diagram);
25:   validateRelationshipIds(diagramType, diagram);
26:   validateEngineeringProfile(diagramType, diagram);
27:   const sourceEvidence = verifyRepositoryEvidence(diagramType, diagram, process.env.ARCHIFY_REPO_ROOT);
28:   const template = fs.readFileSync(path.join(skillRoot, 'assets/template.html'), 'utf8');
29:   const outputRequest = {
30:     requestedOutput: argv[3],
31:     authoredOutput: diagram.meta?.output,
32:     defaultOutput: `${diagramType}.html`,
33:     inputPaths: [inputPath],
34:     cwd: process.cwd(),
35:   };
36:   const { outputPath: outPath } = resolveOutputPath(outputRequest);
37:   outputPathGuards.set(outPath, outputRequest);
38:   return { diagram, template, outPath, sourceEvidence };
39: }
40: 
41: // Brand URL capture is the only asynchronous authoring step. Typed renderers
42: // opt into it through this wrapper without changing loadDiagram's long-lived
43: // synchronous safety contract.
44: export async function loadDiagramWithBrandMarks(options) {
45:   const loaded = loadDiagram(options);
46:   await prepareDiagramBrandMarks(options.diagramType, loaded.diagram);
47:   return loaded;
48: }
49: 
50: const START_TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);
51: 
52: // Common CLI tail: fill the template and write the standalone HTML file.
53: export function writeDiagram({ outPath, template, diagramType, meta, svg, cards, sourceEvidence = null }) {
54:   if (!START_TYPES.has(diagramType)) throw new Error(`writeDiagram: unknown diagram type ${JSON.stringify(diagramType)}`);
55:   const outputGuard = outputPathGuards.get(outPath);
56:   if (outputGuard) resolveOutputPath(outputGuard);
57:   fs.mkdirSync(path.dirname(outPath), { recursive: true });
58:   fs.writeFileSync(outPath, applyTemplate(template, {
59:     title: meta.title,
60:     subtitle: meta.subtitle,
61:     svg,
62:     cards: renderCards(cards),
63:     locale: meta.locale,
64:     visualPreset: meta.visual_preset || 'classic',
65:     guidedViews: meta.views || [],
66:     sourceEvidence,
67:   }));
68:   outputPathGuards.delete(outPath);
69:   console.log(outPath);
```

## `archify-main/archify/renderers/shared/cli.mjs` lines 92–116

```text
92: export function validateRelationshipIds(diagramType, diagram) {
93:   const collection = RELATIONSHIP_COLLECTIONS[diagramType];
94:   const relationships = collection && Array.isArray(diagram[collection]) ? diagram[collection] : [];
95:   const seen = new Set();
96:   const problems = [];
97: 
98:   relationships.forEach((relationship, index) => {
99:     if (relationship.id === undefined || relationship.id === null || relationship.id === '') return;
100:     if (seen.has(relationship.id)) {
101:       problems.push(`/${collection}/${index}/id duplicates relationship id ${JSON.stringify(relationship.id)}`);
102:     }
103:     seen.add(relationship.id);
104:   });
105: 
106:   if (problems.length) {
107:     throwDiagnosticProblems('Relationship identity validation failed', problems, {
108:       code: 'relationship/duplicate-id',
109:       subject: { diagramType, collection },
110:     });
111:   }
112: }
113: 
114: // JSON Schema keeps the view object bounded; this pass checks facts that span
115: // collections. Keeping it here makes the same contract apply to all five
116: // renderers, including the zero-install standalone-validator path.
```

## `archify-main/archify/renderers/architecture/render-architecture.mjs` lines 49–66

```text
49:   tagMinimum: 6,
50: };
51: 
52: const __dirname = path.dirname(fileURLToPath(import.meta.url));
53: const layoutJsonMode = process.argv.includes('--layout-json');
54: const cliArgs = process.argv.filter((arg) => arg !== '--layout-json');
55: const { diagram: arch, template, outPath, sourceEvidence } = await loadDiagramWithBrandMarks({
56:   rendererDir: __dirname,
57:   diagramType: 'architecture',
58:   defaultExample: 'web-app.architecture.json',
59:   argv: cliArgs,
60: });
61: 
62: const grid = gridLayout(arch);
63: 
64: const layout = {
65:   defaultW: 120,
66:   defaultH: 60,
```

## `hyperframes-main/packages/studio-server/src/createStudioApi.ts` lines 1–41

```text
1: import { Hono } from "hono";
2: import type { StudioApiAdapter } from "./types.js";
3: import { registerProjectRoutes } from "./routes/projects.js";
4: import { registerStoryboardRoutes } from "./routes/storyboard.js";
5: import { registerFileRoutes } from "./routes/files.js";
6: import { registerPreviewRoutes } from "./routes/preview.js";
7: import { registerLintRoutes } from "./routes/lint.js";
8: import { registerRenderRoutes } from "./routes/render.js";
9: import { registerThumbnailRoutes } from "./routes/thumbnail.js";
10: import { registerWaveformRoutes } from "./routes/waveform.js";
11: import { registerFontRoutes } from "./routes/fonts.js";
12: import { registerRegistryRoutes } from "./routes/registry.js";
13: import { registerSelectionRoutes } from "./routes/selection.js";
14: import { registerMediaRoutes } from "./routes/media.js";
15: import { registerGlobalAssetRoutes } from "./routes/globalAssets.js";
16: 
17: /**
18:  * Create a Hono sub-app with all studio API routes.
19:  *
20:  * Both the vite dev server and CLI embedded server mount this app
21:  * under /api, each providing their own adapter for host-specific behavior.
22:  */
23: export function createStudioApi(adapter: StudioApiAdapter): Hono {
24:   const api = new Hono();
25: 
26:   registerProjectRoutes(api, adapter);
27:   registerStoryboardRoutes(api, adapter);
28:   registerFileRoutes(api, adapter);
29:   registerPreviewRoutes(api, adapter);
30:   registerLintRoutes(api, adapter);
31:   registerRenderRoutes(api, adapter);
32:   registerThumbnailRoutes(api, adapter);
33:   registerSelectionRoutes(api, adapter);
34:   registerMediaRoutes(api, adapter);
35:   registerWaveformRoutes(api, adapter);
36:   registerFontRoutes(api);
37:   registerRegistryRoutes(api, adapter);
38:   registerGlobalAssetRoutes(api);
39: 
40:   return api;
41: }
```

## `hyperframes-main/packages/sdk/src/session.ts` lines 858–904

```text
858: export async function openComposition(
859:   html: string,
860:   opts?: OpenCompositionOptions,
861: ): Promise<Composition> {
862:   // Single parse: parseMutable stamps hf-ids + builds the live linkedom DOM;
863:   // the query API derives element snapshots from it lazily.
864:   const parsed = parseMutable(html);
865: 
866:   // Pre-override declared defaults — applyOverrideSet below folds `var.<id>`
867:   // overrides destructively into the declarations, so this is the last moment
868:   // the authored base values are readable. getVariableValue({ base: true })
869:   // serves them for the rest of the session (undo-to-base restores).
870:   const baseVariableDefaults = readDeclaredDefaults(
871:     declarationElement(parsed.document, parsed.wrapped),
872:   );
873: 
874:   // T3 embedded: replay the stored override-set onto the base in one pass,
875:   // so the session exposes the user's exact edited state — not the template.
876:   if (opts?.overrides) applyOverrideSet(parsed, opts.overrides);
877: 
878:   const session = new CompositionImpl(parsed, opts ?? {}, baseVariableDefaults);
879: 
880:   const isEmbedded = opts?.overrides !== undefined;
881: 
882:   if (!isEmbedded) {
883:     // history:false opts out of the SDK undo stack ONLY. Persist (auto-save) is
884:     // independent — gating it on the history flag too would silently drop every
885:     // disk write for a caller that just wanted to disable undo (data loss).
886:     if (opts?.history !== false) {
887:       const history = createHistory(session, {
888:         coalesceMs: opts?.coalesceMs ?? 300,
889:         trackedOrigins: opts?.trackedOrigins,
890:       });
891:       session.attachHistory(history);
892:     }
893: 
894:     if (opts?.persist) {
895:       const pq = createPersistQueue(session, opts.persist, {
896:         path: opts.persistPath,
897:         onError: (e) => session._fireError(e),
898:       });
899:       session.attachPersistQueue(pq);
900:     }
901:   }
902: 
903:   return session;
904: }
```

The SDK excerpt explicitly distinguishes history disabling from persistence. AFM-072 therefore requires one project-owned write boundary, not just setting history:false. Archive revision candidates and package-specific runtime declarations are recorded separately in the provenance JSON.
