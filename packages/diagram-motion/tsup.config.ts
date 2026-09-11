import { defineConfig } from "tsup";

/** Node-consumable build; see packages/project-model/tsup.config.ts. */
export default defineConfig({
  entry: { index: "src/index.ts" },
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
