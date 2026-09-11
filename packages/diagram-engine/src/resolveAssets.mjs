/**
 * AFM-011 — package-owned asset resolution for the diagram engine.
 *
 * Archify resolved its assets as `path.resolve(rendererDir, '../..')`, which
 * assumed the renderers still sat two levels below a skill root that also held
 * `assets/`, `schemas/` and `examples/`. That assumption broke the moment the
 * import split the viewer template into `@hyperframes/diagram-viewer`: the
 * architecture renderer failed with ENOENT on
 * `packages/diagram-engine/assets/template.html`.
 *
 * Everything here resolves from this module's own location (`import.meta.url`)
 * or through package resolution. Nothing resolves from `process.cwd()`, so the
 * engine works when invoked from any directory, including one with spaces, and
 * regardless of whether the original raw checkouts still exist.
 */

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Root of this package (`packages/diagram-engine`), derived, never guessed. */
export const enginePackageRoot = resolve(here, "..");

const require = createRequire(import.meta.url);

/** Joins a path inside this package. */
function ownedPath(...segments) {
  return join(enginePackageRoot, ...segments);
}

export function schemaPath(diagramType) {
  return ownedPath("schemas", `${diagramType}.schema.json`);
}

export function examplePath(fileName) {
  return ownedPath("examples", fileName);
}

export function brandMarksPath(...segments) {
  return ownedPath("brand-marks", ...segments);
}

export function migrationsPath(...segments) {
  return ownedPath("migrations", ...segments);
}

/**
 * Locates the standalone viewer template.
 *
 * The template belongs to the viewer, not the engine — contract C02 keeps the
 * engine's output an artifact (SVG, styles, semantic objects) and leaves the
 * HTML shell to the viewer. The engine only needs this for the legacy
 * standalone-HTML CLI path, which AFM-027 replaces with a direct artifact API.
 *
 * Resolution order, all cwd-independent:
 *   1. Package export `@hyperframes/diagram-viewer/template`.
 *   2. Workspace sibling directory, for a source checkout where the package
 *      has not been linked into node_modules.
 */
export function viewerTemplatePath() {
  try {
    return require.resolve("@hyperframes/diagram-viewer/template");
  } catch {
    // Fall through to the workspace layout.
  }

  const sibling = resolve(enginePackageRoot, "..", "diagram-viewer", "assets", "template.html");
  if (existsSync(sibling)) return sibling;

  throw new Error(
    "Cannot resolve the diagram viewer template. Expected the package export " +
      "'@hyperframes/diagram-viewer/template' to resolve, or " +
      `${sibling} to exist. Asset resolution here is independent of the working directory, so ` +
      "this is a workspace wiring problem rather than a directory problem.",
  );
}

/** Every asset root this package owns, for smoke checks and packed-file tests. */
export function assetRoots() {
  return {
    schemas: ownedPath("schemas"),
    examples: ownedPath("examples"),
    brandMarks: ownedPath("brand-marks"),
    migrations: ownedPath("migrations"),
    viewerTemplate: viewerTemplatePath(),
  };
}
