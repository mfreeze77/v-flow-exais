/** The existing extraction contract, made import-safe and explicit.
 * Does not choose or change the font policy. No generation happens on import.
 */
import { createHash } from "node:crypto";

export function extractArtifactStyles(template) {
  const text = template.replace(/\r\n/g, "\n");
  const fonts = [...text.matchAll(/<style id="archify-fonts">([\s\S]*?)<\/style>/g)];
  const take = (start, end, label) => {
    const from = text.indexOf(start),
      to = text.indexOf(end);
    if (from < 0 || to <= from)
      throw new Error(`Owned viewer ${label} boundaries changed; review the extraction.`);
    return text.slice(from, to);
  };
  if (fonts.length !== 1 || !fonts[0][1])
    throw new Error("Owned viewer font boundary changed; review the extraction.");
  const colors = take("    :root,", "    * { margin: 0;", "color");
  const semantic = take("    .c-grid ", "    /* Stable semantic exploration hooks", "semantic");
  return `${fonts[0][1]}\n${colors}\n${semantic}\nsvg { font-family: 'JetBrains Mono', monospace; }\nsvg *, svg { animation: none !important; transition: none !important; }\n`;
}
export function artifactStylesModule(css) {
  return (
    "// Generated from the owned viewer by scripts/generate-artifact-styles.mjs. Includes the bundled OFL font license.\nexport const diagramStyles = " +
    JSON.stringify(css) +
    ";\n"
  );
}
/** Parse the generator's sole JSON-string declaration; never execute the module under review. */
export function readArtifactStylesLiteral(source) {
  const body = source.replace(/^\/\/[^\n]*(?:\r?\n|$)/, "").trim();
  const match = /^export const diagramStyles\s*=\s*("(?:[^"\\]|\\[\s\S])*")\s*;\s*$/.exec(body);
  if (!match)
    throw new Error("Artifact styles module is not the supported single string declaration.");
  const value = JSON.parse(match[1]);
  if (typeof value !== "string") throw new Error("Artifact styles must be a string.");
  return value;
}
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
function summary(css) {
  // Token counts are descriptive only, not a CSS semantic-equivalence verdict.
  const urls = [...css.matchAll(/url\(\s*["']?(data:[^\s"')]+)["']?\s*\)/g)];
  return {
    characters: css.length,
    bytes: Buffer.byteLength(css),
    sha256: sha256(css),
    fontFaceTokenCount: [...css.matchAll(/@font-face\b/g)].length,
    embeddedUrls: urls.map((m) => ({
      characters: m[1].length,
      sha256: sha256(m[1]),
      mediaType: m[1].slice(5).split(/[;,]/, 1)[0],
    })),
  };
}
export function compareArtifactStyles(committedSource, template) {
  const committed = readArtifactStylesLiteral(committedSource),
    generated = extractArtifactStyles(template);
  let prefix = 0,
    suffix = 0;
  while (
    prefix < Math.min(committed.length, generated.length) &&
    committed[prefix] === generated[prefix]
  )
    prefix++;
  while (
    suffix < Math.min(committed.length, generated.length) - prefix &&
    committed.at(-suffix - 1) === generated.at(-suffix - 1)
  )
    suffix++;
  return {
    schemaVersion: 1,
    status: committed === generated ? "same-exported-css" : "rendering-review-required",
    exportedCssEqual: committed === generated,
    generatedModuleBytesEqual: committedSource === artifactStylesModule(generated),
    commonPrefixCharacters: prefix,
    commonSuffixCharacters: suffix,
    committed: summary(committed),
    generated: summary(generated),
    limitations: [
      "No CSS semantic equivalence or visual/font acceptance is inferred from token counts.",
      "No files or rendering assets were regenerated.",
      "Embedded payloads are identified by hashes and lengths; their bytes are not included in this report.",
    ],
  };
}
