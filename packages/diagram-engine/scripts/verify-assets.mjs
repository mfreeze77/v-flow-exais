#!/usr/bin/env node
/**
 * Build step for @hyperframes/diagram-engine.
 *
 * There is nothing to compile: the renderers are plain .mjs, kept that way per
 * contract C11 until a separately tested refactor earns the change. So rather
 * than a no-op, the build verifies the thing that actually breaks — asset
 * resolution. Finding AFM-011-F1 was exactly this: every renderer failed with
 * ENOENT because the viewer template had moved to another package, and nothing
 * caught it until a render was attempted by hand.
 */

import { existsSync } from "node:fs";

import { assetRoots, DIAGRAM_TYPES } from "../src/index.mjs";
import { schemaPath } from "../src/resolveAssets.mjs";

const missing = [];

for (const [name, path] of Object.entries(assetRoots())) {
  if (!existsSync(path)) missing.push(`${name}: ${path}`);
}
for (const type of DIAGRAM_TYPES) {
  const path = schemaPath(type);
  if (!existsSync(path)) missing.push(`schema/${type}: ${path}`);
}

if (missing.length > 0) {
  console.error("diagram-engine asset resolution failed:");
  for (const entry of missing) console.error(`  ${entry}`);
  process.exit(1);
}

console.log(
  JSON.stringify({
    event: "diagram_engine_assets_verified",
    diagramTypes: DIAGRAM_TYPES.length,
    roots: Object.keys(assetRoots()).length,
  }),
);
