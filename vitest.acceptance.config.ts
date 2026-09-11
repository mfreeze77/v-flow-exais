import { defineConfig } from "vitest/config";

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
  resolve: { conditions: ["bun", "module", "node", "development|production"] },
  ssr: { resolve: { conditions: ["bun", "module", "node", "development|production"], externalConditions: ["bun", "node"] } },
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
