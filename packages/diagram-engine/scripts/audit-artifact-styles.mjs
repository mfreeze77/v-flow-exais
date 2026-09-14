import { readFileSync, writeFileSync } from "node:fs";
import { compareArtifactStyles } from "./artifact-styles-source.mjs";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--output" || !args[1])
  throw new Error("Usage: node scripts/audit-artifact-styles.mjs --output NEW-REPORT.json");
const report = compareArtifactStyles(
  readFileSync(new URL("../src/styles.mjs", import.meta.url), "utf8"),
  readFileSync(new URL("../../diagram-viewer/assets/template.html", import.meta.url), "utf8"),
);
writeFileSync(args[1], JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: report.status, output: args[1] }));
// This is evidence, not an acknowledgement of the visual change.
if (!report.exportedCssEqual) process.exitCode = 1;
