import { it } from "vitest";
import assert from "node:assert/strict";
import { isInitialBlankPreviewLoad } from "./previewLoadLifecycle";

function frame(url: string | null, attributes: string[] = []) {
  return {
    hasAttribute: (name: string) => attributes.includes(name),
    contentDocument: url === null ? null : ({ URL: url } as Document),
  };
}

it("ignores only the unassigned initial about:blank document", () => {
  assert.equal(isInitialBlankPreviewLoad(frame("about:blank")), true);
});
for (const attribute of ["src", "srcdoc"])
  it(`an assigned ${attribute}, including an empty attribute, is never ignored`, () => {
    assert.equal(isInitialBlankPreviewLoad(frame("about:blank", [attribute])), false);
  });
for (const url of [
  "https://app.test/preview",
  "about:srcdoc",
  "chrome-error://chromewebdata/",
  "about:blank#requested",
])
  it(`does not ignore a non-bootstrap document at ${url}`, () => {
    assert.equal(isInitialBlankPreviewLoad(frame(url)), false);
  });
it("does not mistake an unavailable document for the initial blank document", () => {
  assert.equal(isInitialBlankPreviewLoad(frame(null)), false);
});
it("does not suppress an inaccessible document", () => {
  assert.equal(
    isInitialBlankPreviewLoad({
      hasAttribute: () => false,
      get contentDocument(): Document {
        throw new Error("access denied");
      },
    }),
    false,
  );
});
it("a requested preview with missing identity stamps still reaches its owner's checks", () => {
  assert.equal(isInitialBlankPreviewLoad(frame("https://app.test/preview", ["src"])), false);
});
