import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { conditions: ["bun", "module", "node", "development|production"] },
  ssr: {
    resolve: {
      conditions: ["bun", "module", "node", "development|production"],
      externalConditions: ["bun", "node"],
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
