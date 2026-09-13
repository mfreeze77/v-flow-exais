import { it } from "vitest";
import assert from "node:assert/strict";
import { nativeManagedRequest } from "./managedNativeFencePolicy";
for (const method of ["GET", "HEAD"])
  it(`${method} only allows the owned document adapter`, () => {
    assert.equal(nativeManagedRequest(method, "/files/title.html"), "read-document");
  });
for (const method of ["POST", "PUT", "PATCH", "DELETE"])
  it(`blocks ${method} even at file-shaped paths`, () => {
    for (const path of [
      "/files/title.html",
      "/file-mutations/remove-element/title.html",
      "/registry/install",
      "/upload",
      "/gsap-mutations/title.html",
    ])
      assert.equal(nativeManagedRequest(method, path), "blocked");
  });
for (const path of [
  "",
  "/preview",
  "/preview/comp/title.html",
  "/signature",
  "/thumbnail/title.html",
  "/files",
  "/files-not-really/title.html",
])
  it(`GET ${path || "project root"} cannot enter a legacy handler`, () =>
    assert.equal(nativeManagedRequest("GET", path), "blocked"));
