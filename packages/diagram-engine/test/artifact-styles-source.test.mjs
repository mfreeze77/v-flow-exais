import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractArtifactStyles,
  artifactStylesModule,
  readArtifactStylesLiteral,
  compareArtifactStyles,
} from "../scripts/artifact-styles-source.mjs";
const template =
  '<style id="archify-fonts">@font-face {src:url(data:font/woff2;base64,AAAA);}</style>\n    :root,\n    .theme { --x:red; }\n    * { margin: 0; }\n    .c-grid { stroke:black; }\n    /* Stable semantic exploration hooks */';
const original = (input) => {
  const t = input.replace(/\r\n/g, "\n");
  const fonts = t.match(/<style id="archify-fonts">([\s\S]*?)<\/style>/)?.[1];
  return `${fonts}\n${t.slice(t.indexOf("    :root,"), t.indexOf("    * { margin: 0;"))}\n${t.slice(t.indexOf("    .c-grid "), t.indexOf("    /* Stable semantic exploration hooks"))}\nsvg { font-family: 'JetBrains Mono', monospace; }\nsvg *, svg { animation: none !important; transition: none !important; }\n`;
};
test("preserves the existing extraction byte-for-byte on supported input", () =>
  assert.equal(extractArtifactStyles(template), original(template)));
test("preserves CRLF normalization", () =>
  assert.equal(extractArtifactStyles(template.replaceAll("\n", "\r\n")), original(template)));
test("generated module round trips arbitrary escaped text", () => {
  const s = 'quotes: " \\ newline\n and 雪';
  assert.equal(readArtifactStylesLiteral(artifactStylesModule(s)), s);
});
test("formatted declaration parses without evaluating JavaScript", () => {
  assert.equal(
    readArtifactStylesLiteral('// comment\nexport const diagramStyles =\n  "hello";\n'),
    "hello",
  );
});
for (const [a, b] of [
  ["    :root,", "missing"],
  ["    * { margin: 0;", "missing"],
  ["    .c-grid ", "missing"],
  ["    /* Stable semantic exploration hooks", "missing"],
  ["archify-fonts", "other-fonts"],
])
  test(`refuses a missing ${a} boundary`, () =>
    assert.throws(() => extractArtifactStyles(template.replace(a, b)), /boundar/));
test("refuses duplicate font sections", () =>
  assert.throws(
    () => extractArtifactStyles(template + '<style id="archify-fonts">x</style>'),
    /font boundary/,
  ));
test("refuses reversed boundaries instead of slicing arbitrary tail data", () =>
  assert.throws(
    () => extractArtifactStyles(template.replace("    :root,", "x") + "    :root,"),
    /color boundaries/,
  ));
for (const s of [
  'export const diagramStyles = (()=>"bad")();',
  'export const diagramStyles = "x"; globalThis.mutated=true;',
  "export const diagramStyles = null;",
  'export const diagramStyles = "bad\\x00";',
])
  test(`refuses executable/non-JSON declaration ${s}`, () =>
    assert.throws(() => readArtifactStylesLiteral(s)));
test("distinguishes module formatting from exported CSS", () => {
  const css = extractArtifactStyles(template);
  const r = compareArtifactStyles(
    "// changed comment\nexport const diagramStyles =\n" + JSON.stringify(css) + ";\n",
    template,
  );
  assert.equal(r.exportedCssEqual, true);
  assert.equal(r.generatedModuleBytesEqual, false);
});
test("data URL drift stays rendering-review-required and payload is not printed", () => {
  const old = artifactStylesModule(extractArtifactStyles(template.replace("AAAA", "BBBB")));
  const r = compareArtifactStyles(old, template);
  assert.equal(r.status, "rendering-review-required");
  assert.notEqual(r.committed.embeddedUrls[0].sha256, r.generated.embeddedUrls[0].sha256);
  assert(!JSON.stringify(r).includes("AAAA"));
  assert(!JSON.stringify(r).includes("BBBB"));
});
test("real CSS changes cannot be labelled formatting-only", () => {
  const r = compareArtifactStyles(
    artifactStylesModule(extractArtifactStyles(template.replace("--x:red", "--x:blue"))),
    template,
  );
  assert.equal(r.exportedCssEqual, false);
  assert.equal(r.status, "rendering-review-required");
});

test("later print/theme selectors outside the extraction window are legal", () => {
  const input = template + "\n@media print {\n    :root, body {color:black;}\n}";
  assert.equal(extractArtifactStyles(input), original(input));
});

test("repeated CSS selectors keep the original extraction, not an invented uniqueness rule", () => {
  const input = template.replace(
    "    .c-grid { stroke:black; }",
    "    .c-grid { stroke:black; }\n    .c-grid { opacity:1; }",
  );
  assert.equal(extractArtifactStyles(input), original(input));
});
