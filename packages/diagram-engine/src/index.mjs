/**
 * @hyperframes/diagram-engine — owned diagram compilation engine.
 *
 * Today this exposes the asset resolvers and the validation surface that the
 * renderers already share. The side-effect-free `compileDiagram(request) ->
 * DiagramArtifact` boundary described by contract C02 is AFM-027's work; until
 * then the renderers remain CLI entry points under `renderers/`.
 */

export {
  assetRoots,
  brandMarksPath,
  enginePackageRoot,
  examplePath,
  migrationsPath,
  schemaPath,
  viewerTemplatePath,
} from "./resolveAssets.mjs";

/** The five diagram families this engine compiles. */
export const DIAGRAM_TYPES = Object.freeze([
  "architecture",
  "workflow",
  "sequence",
  "dataflow",
  "lifecycle",
]);
