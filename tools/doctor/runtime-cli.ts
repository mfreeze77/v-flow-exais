#!/usr/bin/env bun
/**
 * Runtime diagnostics CLI (AFM-010).
 *
 * Exit 0 when the product can build and render, 1 when a render dependency is
 * missing, 2 when it cannot even build. Distinct codes so a render pipeline can
 * fail early with a specific reason rather than a generic non-zero.
 */

import { formatReport, runtimeReport } from "./runtime.ts";

const report = runtimeReport();
console.log(formatReport(report));

if (!report.canBuild) {
  console.error("\nFAIL: required runtime missing or unsupported.");
  process.exitCode = 2;
} else if (!report.canRender) {
  console.error("\nFAIL: build dependencies present, but a render dependency is missing.");
  process.exitCode = 1;
} else {
  console.log("\nPASS");
}
