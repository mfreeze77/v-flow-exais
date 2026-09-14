import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  createOwnedArchifyResolver,
  ownedArchifyPath,
  ownedSkillPath,
} from "../../../tools/upstream-archify/owned-layout.mjs";

const root = path.resolve("/fixture/workspace");
const entries = [
  ["archify/package.json", "packages/diagram-engine/package.json"],
  ["archify/package-lock.json", "packages/diagram-engine/package-lock.json"],
  ["archify/assets/template.html", "packages/diagram-viewer/assets/template.html"],
  ["archify/assets/JetBrainsMono-OFL.txt", "packages/diagram-viewer/assets/JetBrainsMono-OFL.txt"],
  ["archify/examples/a.json", "packages/diagram-engine/examples/a.json"],
  ["examples/a.html", "examples/upstream-archify/a.html"],
  ["docs/index.html", "docs/upstream/archify/docs/index.html"],
  ["README.md", "docs/upstream/archify/README.md"],
  ["LICENSE", "licenses/archify-LICENSE"],
  ["scripts/run-tests.mjs", "tools/upstream-archify/run-tests.mjs"],
  [".github/workflows/ci.yml", "docs/upstream/archify/automation/.github/workflows/ci.yml"],
].map(([sourcePath, targetPath]) => ({ repository: "archify", sourcePath, targetPath }));
const resolve = createOwnedArchifyResolver(root, entries);
for (const [name, suffix] of [
  ["archify/package.json", "packages/diagram-engine/package.json"],
  ["archify/package-lock.json", "docs/upstream/archify/package-lock.json"],
  ["archify/assets/template.html", "packages/diagram-viewer/assets/template.html"],
  ["archify/examples/a.json", "packages/diagram-engine/examples/a.json"],
  ["examples/a.html", "examples/upstream-archify/a.html"],
  ["README.md", "docs/upstream/archify/README.md"],
  ["LICENSE", "licenses/archify-LICENSE"],
  ["docs/index.html", "docs/upstream/archify/docs/index.html"],
  ["scripts/run-tests.mjs", "tools/upstream-archify/run-tests.mjs"],
  [".github/workflows/ci.yml", "docs/upstream/archify/automation/.github/workflows/ci.yml"],
])
  test(`resolves retained ${name} without an upstream checkout`, () =>
    assert.equal(resolve(name), path.resolve(root, suffix)));
test("keeps packaged examples distinct from repository goldens", () =>
  assert.notEqual(resolve("archify/examples"), resolve("examples")));
test("normalizes the original skill-relative ../examples intentionally", () =>
  assert.equal(
    resolve("archify", "../examples/a.html"),
    path.resolve(root, "examples/upstream-archify/a.html"),
  ));
test("maps a uniformly relocated directory", () =>
  assert.equal(
    resolve("archify", "examples"),
    path.resolve(root, "packages/diagram-engine/examples"),
  ));
test("maps viewer asset directory separately", () =>
  assert.equal(resolve("archify/assets"), path.resolve(root, "packages/diagram-viewer/assets")));
for (const name of [
  "../secret",
  "archify/../../secret",
  "/tmp/other",
  "C:\\old\\repo",
  "missing.json",
])
  test(`rejects ${name} rather than guessing`, () =>
    assert.throws(() => resolve(name), /owned-archify\//));
test("rejects missing ledger", () =>
  assert.throws(() => createOwnedArchifyResolver(root, null), /missing-import-map/));
test("rejects empty Archify population", () =>
  assert.throws(() => createOwnedArchifyResolver(root, []), /empty-import-map/));
test("rejects duplicate mapping", () =>
  assert.throws(
    () => createOwnedArchifyResolver(root, [...entries, entries[0]]),
    /duplicate-source/,
  ));
test("rejects an import destination escaping the workspace", () =>
  assert.throws(
    () =>
      createOwnedArchifyResolver(root, [
        { repository: "archify", sourcePath: "a", targetPath: "../outside" },
      ]),
    /outside-root/,
  ));
test("does not map an ambiguous directory to the first child", () => {
  const r = createOwnedArchifyResolver(root, [
    { repository: "archify", sourcePath: "split/a", targetPath: "docs/a/a" },
    { repository: "archify", sourcePath: "split/b", targetPath: "tools/b/b" },
  ]);
  assert.throws(() => r("split"), /split-directory/);
});
test("synthetic release fixtures keep their own archive topology", () =>
  assert.equal(
    ownedArchifyPath("/tmp/release-fixture", "archify/package.json"),
    path.resolve("/tmp/release-fixture/archify/package.json"),
  ));
test("synthetic skill fixtures keep their own asset topology", () =>
  assert.equal(
    ownedSkillPath("/tmp/skill-fixture", "assets/template.html"),
    path.resolve("/tmp/skill-fixture/assets/template.html"),
  ));

test("new temporary skill files stay in the declared engine root", () =>
  assert.equal(
    resolve("archify/.temporary-test/new.json"),
    path.resolve(root, "packages/diagram-engine/.temporary-test/new.json"),
  ));

test("already rebased worktree references are not prefixed twice", () =>
  assert.equal(
    resolve("docs/upstream/archify/docs/index.html"),
    path.resolve(root, "docs/upstream/archify/docs/index.html"),
  ));
