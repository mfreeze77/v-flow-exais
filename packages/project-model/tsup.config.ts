import { defineConfig } from "tsup";

/**
 * Node-consumable build for @hyperframes/project-model.
 *
 * The package is authored as TypeScript and consumed directly from source by
 * Bun and by Vite's transform pipeline. Node cannot do that: Vite loads
 * studio's config in Node, which reaches this package and fails on both the
 * .ts extension and its extensionless relative imports.
 *
 * So the package exports a `node` condition pointing at these bundled outputs,
 * matching how every inherited workspace package is set up.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    storage: "src/storage/commit.ts",
    revisions: "src/storage/revisions.ts",
  },
  format: ["esm"],
  outDir: "dist",
  target: "node22",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
});
