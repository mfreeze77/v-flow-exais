// Development-time extraction from the owned viewer. Compilation imports fixed
// CSS bytes; it never reads or parses a viewer page to obtain geometry or styles.
import fs from "node:fs";
import { extractArtifactStyles, artifactStylesModule } from "./artifact-styles-source.mjs";
const template = fs.readFileSync(
  new URL("../../diagram-viewer/assets/template.html", import.meta.url),
  "utf8",
);
const output = artifactStylesModule(extractArtifactStyles(template));
const target = new URL("../src/styles.mjs", import.meta.url);
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8") !== output)
    throw new Error("Artifact styles differ from the owned viewer. Regenerate and review.");
} else fs.writeFileSync(target, output);
