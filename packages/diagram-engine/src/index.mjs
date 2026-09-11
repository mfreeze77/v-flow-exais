/** Owned, side-effect-free typed diagram compilation and explicit asset utilities. */
export { compileDiagram, ENGINE_VERSION } from "./compile.mjs";
export { compareDiagrams, repositoryIdentity } from "./compare.mjs";
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
