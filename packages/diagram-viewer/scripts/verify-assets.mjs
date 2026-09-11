#!/usr/bin/env node
/**
 * Build step for @hyperframes/diagram-viewer.
 *
 * The viewer ships an HTML template and static assets; there is nothing to
 * compile. Rather than a no-op, the build verifies the template is present and
 * non-empty, because the engine resolves it through this package's export and a
 * missing or empty template otherwise fails only at render time — which is
 * exactly how finding AFM-011-F1 stayed hidden until a render was attempted.
 */

import { readFileSync } from "node:fs";

import { templatePath } from "../src/index.mjs";

const path = templatePath();

let contents;
try {
  contents = readFileSync(path, "utf8");
} catch (error) {
  console.error(`diagram-viewer template is not readable at ${path}`);
  console.error(String(error));
  process.exit(1);
}

if (contents.trim().length === 0) {
  console.error(`diagram-viewer template is empty at ${path}`);
  process.exit(1);
}

console.log(JSON.stringify({ event: "diagram_viewer_template_verified", bytes: contents.length }));
