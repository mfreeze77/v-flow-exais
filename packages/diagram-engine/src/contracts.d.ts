export type DiagramKind = 'architecture' | 'workflow' | 'sequence' | 'dataflow' | 'lifecycle';
export type DiagramSource = { diagram_type: DiagramKind; schema_version: number; meta: { title: string; [key: string]: unknown }; [key: string]: unknown };
export type DiagramDiagnostic = { code: string; severity: 'error' | 'warning'; message: string; pointer?: string; subject?: Record<string, unknown> };
export type Bounds = { x: number; y: number; width: number; height: number };
export type SemanticObject = { id: string; kind: 'object'; label: string; bounds: Bounds; sourcePointer: string };
export type SemanticRelationship = { id: string | null; kind: 'relationship'; from: string; to: string; label: string | null; path: string; points: [number, number][]; labelAt: [number, number] | null; sourcePointer: string };
export type DiagramArtifact = {
  schemaVersion: 1; engineVersion: string; artifactHash: string; kind: DiagramKind; sourceHash: string;
  theme: 'dark' | 'light'; preset: string; svg: string; styles: string; viewBox: [number, number, number, number];
  objects: SemanticObject[]; groups: Record<string, unknown>[]; relationships: SemanticRelationship[];
  guidedViews: Record<string, unknown>[]; diagnostics: DiagramDiagnostic[]; evidence: unknown; report: unknown;
};
export type CompileDiagramRequest = {
  kind: DiagramKind; source: DiagramSource; theme?: 'dark' | 'light'; preset?: 'classic' | 'signal-flow' | 'blueprint' | 'editorial';
  options?: { qualityProfile?: 'standard' | 'showcase'; standaloneAnimation?: boolean };
  resolveAsset?: (reference: { url: string; sha256: string }) => Promise<{ bytes: Uint8Array; mimeType: string; title?: string }>;
  resolveEvidence?: (request: { kind: DiagramKind; source: DiagramSource; sourceHash: string }) => Promise<unknown>;
};
export type CompileDiagramResult = { ok: true; artifact: DiagramArtifact; diagnostics: DiagramDiagnostic[] } | { ok: false; diagnostics: DiagramDiagnostic[]; report?: unknown };
export function compileDiagram(request: CompileDiagramRequest): Promise<CompileDiagramResult>;
export const ENGINE_VERSION: string;
export const DIAGRAM_TYPES: readonly DiagramKind[];
export const enginePackageRoot: string;
export function examplePath(name: string): string;
export function schemaPath(kind: string): string;
export function viewerTemplatePath(): string;
export function assetRoots(): Record<string, string>;
export function brandMarksPath(...segments: string[]): string;
export function migrationsPath(...segments: string[]): string;
