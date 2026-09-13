import { createRequire } from "node:module";

import { defineConfig } from "vitest/config";

/**
 * `hono` is a dependency of studio-server, not of the repository root, so an
 * acceptance test at tests/ cannot resolve it by walking up. Resolving it the
 * way studio-server does keeps the server's own copy authoritative and avoids
 * adding a root dependency — and a lockfile change — for a test-only import.
 */
const fromStudioServer = createRequire(
  new URL("./packages/studio-server/package.json", import.meta.url),
);

/**
 * Ticket acceptance suite (tests/acceptance/AFM-###.test.ts).
 *
 * Kept separate from the per-package unit suites: these tests exercise whole
 * workflows against the real source snapshots and real rendered output, so they
 * are slower, run sequentially, and must not be silently folded into a fast
 * unit run that gates commits.
 */
export default defineConfig({
  // Acceptance runs the Bun workspace's source exports. Packed Node exports
  // are exercised separately by the package-isolation test.
  resolve: {
    conditions: ["bun", "module", "node", "development|production"],
    // Exact match only. A string alias is a PREFIX rule in Vite, so aliasing
    // "hono" also rewrites "hono/body-limit" — which studio-server's own routes
    // import, and which resolved correctly all along from their location. Four
    // acceptance files stopped loading before this was narrowed.
    alias: [
      { find: /^hono$/, replacement: fromStudioServer.resolve("hono") },
      { find: /^linkedom$/, replacement: fromStudioServer.resolve("linkedom") },
    ],
  },
  ssr: {
    resolve: {
      conditions: ["bun", "module", "node", "development|production"],
      externalConditions: ["bun", "node"],
    },
  },
  test: {
    include: ["tests/acceptance/**/*.test.ts"],
    // Scans of the 7,786-entry snapshots and real renders both exceed the
    // default timeout by a wide margin.
    testTimeout: 300_000,
    hookTimeout: 120_000,
    // Several suites read the same large snapshots; running them in parallel
    // multiplies peak memory for no wall-clock gain.
    fileParallelism: false,
    reporters: ["verbose"],
  },
});
