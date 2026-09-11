/**
 * @hyperframes/diagram-viewer — standalone viewer shell.
 *
 * Owns the HTML template that wraps a compiled diagram artifact. Contract C02
 * keeps this separate from the engine: the engine emits SVG, styles and
 * semantic objects, and the viewer decides how a standalone page presents
 * them. The final video path consumes the artifact directly and never scrapes
 * this page back apart.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Root of this package, derived from this module rather than from cwd. */
export const viewerPackageRoot = resolve(here, "..");

/** Absolute path to the standalone viewer template. */
export function templatePath() {
  return join(viewerPackageRoot, "assets", "template.html");
}
