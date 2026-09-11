// Development-time extraction from the owned viewer. Compilation imports fixed
// CSS bytes; it never reads or parses a viewer page to obtain geometry or styles.
import fs from "node:fs";
const template = fs
  .readFileSync(new URL("../../diagram-viewer/assets/template.html", import.meta.url), "utf8")
  .replace(/\r\n/g, "\n");
const fonts = template.match(/<style id="archify-fonts">([\s\S]*?)<\/style>/)?.[1];
const colors = template.slice(
  template.indexOf("    :root,"),
  template.indexOf("    * { margin: 0;"),
);
const semantic = template.slice(
  template.indexOf("    .c-grid "),
  template.indexOf("    /* Stable semantic exploration hooks"),
);
if (!fonts || !colors || !semantic)
  throw new Error("Owned viewer CSS boundaries changed; review the extraction.");
const css = `${fonts}\n${colors}\n${semantic}\nsvg { font-family: 'JetBrains Mono', monospace; }\nsvg *, svg { animation: none !important; transition: none !important; }\n`;
const output =
  "// Generated from the owned viewer by scripts/generate-artifact-styles.mjs. Includes the bundled OFL font license.\nexport const diagramStyles = " +
  JSON.stringify(css) +
  ";\n";
const target = new URL("../src/styles.mjs", import.meta.url);
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8") !== output)
    throw new Error("Artifact styles differ from the owned viewer. Regenerate and review.");
} else fs.writeFileSync(target, output);
