import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { managedStudioFixture } from "./managedStudio.fixture";
import {
  managedStudioPin,
  sameManagedStudioPin,
  validateNativeInspectorEdit,
  readOnlyManagedDomSession,
  ManagedStudioRejected,
} from "./managedStudioPolicy";
import type { NativeInspectorEdit } from "./managedStudioPolicy";

describe("managed Studio identity and explicit capabilities", () => {
  it("accepts one coherent observed scene and leaves inputs untouched", () => {
    const f = managedStudioFixture();
    const original = JSON.stringify(f);
    const pin = managedStudioPin(f.view, f.preview, "title-scene", f.status);
    assert.equal(pin.documentId, "title");
    assert.equal(pin.sourcePath, "title.html");
    assert.equal(pin.buildHash, f.preview.buildHash);
    assert.equal(JSON.stringify(f), original);
  });
  const faults: Array<[string, (f: ReturnType<typeof managedStudioFixture>) => void]> = [
    [
      "wrong edit owner",
      (f) => {
        f.preview.scenes[0]!.editOwner = "diagram-command";
      },
    ],
    [
      "wrong scene kind",
      (f) => {
        f.preview.scenes[0]!.kind = "diagram";
      },
    ],
    [
      "not loaded",
      (f) => {
        f.status = { ...f.status, loaded: false };
      },
    ],
    [
      "busy",
      (f) => {
        f.status = { ...f.status, busy: true };
      },
    ],
    [
      "uncertain",
      (f) => {
        f.status = { ...f.status, uncertain: true };
      },
    ],
    [
      "pending",
      (f) => {
        f.status = { ...f.status, pendingCommandId: "pending" };
      },
    ],
    [
      "foreign journal",
      (f) => {
        f.status = { ...f.status, projectId: "other" };
      },
    ],
    [
      "stale journal",
      (f) => {
        f.status = { ...f.status, revision: 5 };
      },
    ],
    [
      "foreign preview",
      (f) => {
        f.preview.projectId = "other";
      },
    ],
    [
      "stale preview",
      (f) => {
        f.preview.revision = 3;
      },
    ],
    [
      "wrong revision hash",
      (f) => {
        f.preview.revisionHash = "f".repeat(64);
      },
    ],
    [
      "wrong source path",
      (f) => {
        f.preview.scenes[0]!.sourcePath = "generated.html";
      },
    ],
    [
      "wrong source kind",
      (f) => {
        f.preview.scenes[0]!.documentKind = "architecture";
      },
    ],
    [
      "missing document",
      (f) => {
        f.view.documents.splice(0, 1);
      },
    ],
    [
      "missing scene membership",
      (f) => {
        f.view.documents[0]!.sceneInstanceIds = [];
      },
    ],
  ];
  for (const [name, mutate] of faults)
    it(`rejects ${name}`, () => {
      const f = managedStudioFixture();
      mutate(f);
      assert.throws(
        () => managedStudioPin(f.view, f.preview, "title-scene", f.status),
        ManagedStudioRejected,
      );
    });
  it("rejects missing scene without inferring a similarly named scene", () => {
    const f = managedStudioFixture();
    assert.throws(() => managedStudioPin(f.view, f.preview, "title", f.status));
  });
  it("distinguishes repeated appearances of the same document", () => {
    const f = managedStudioFixture();
    f.view.documents[0]!.sceneInstanceIds.push("again");
    f.preview.scenes.push({ ...f.preview.scenes[0]!, sceneId: "again" });
    const a = managedStudioPin(f.view, f.preview, "title-scene", f.status);
    const b = managedStudioPin(f.view, f.preview, "again", f.status);
    assert.equal(a.documentId, b.documentId);
    assert.equal(sameManagedStudioPin(a, b), false);
  });
  it("every pin dimension matters", () => {
    const f = managedStudioFixture();
    const pin = managedStudioPin(f.view, f.preview, "title-scene", f.status);
    assert.equal(sameManagedStudioPin(pin, { ...pin }), true);
    for (const key of Object.keys(pin)) {
      const changed = { ...pin, [key]: key === "revision" ? pin.revision + 1 : "changed" };
      assert.equal(sameManagedStudioPin(pin, changed), false, key);
    }
  });
  for (const edit of [
    { type: "text", value: "" },
    { type: "text", value: "<script>literal text</script>" },
    { type: "style", property: "color", value: "#Ab09fF" },
    { type: "style", property: "fontSize", value: "1000px" },
    { type: "style", property: "opacity", value: "0.125" },
  ] as NativeInspectorEdit[])
    it(`allows bounded ${JSON.stringify(edit)}`, () =>
      assert.doesNotThrow(() => validateNativeInspectorEdit(edit)));
  for (const [name, edit] of [
    ["oversize text", { type: "text", value: "a".repeat(10001) }],
    ["extra attribute", { type: "text", value: "ok", onclick: "bad" }],
    ["script attribute", { type: "attribute", name: "onclick", value: "alert(1)" }],
    ["arbitrary property", { type: "style", property: "backgroundImage", value: "url(/bad)" }],
    ["CSS injection", { type: "style", property: "color", value: "red;display:none" }],
    ["font beyond range", { type: "style", property: "fontSize", value: "1001px" }],
    ["negative opacity", { type: "style", property: "opacity", value: "-1" }],
    ["opacity over range", { type: "style", property: "opacity", value: "1.001" }],
    ["missing value", { type: "text" }],
    ["null", null],
  ] as [string, unknown][])
    it(`rejects ${name}`, () =>
      assert.throws(() => validateNativeInspectorEdit(edit as NativeInspectorEdit)));
  it("preserves selection callbacks but replaces all legacy mutation functions", () => {
    let selections = 0,
      writes = 0,
      blocked = 0;
    const session = {
      applyDomSelection: () => selections++,
      handleDelete: () => writes++,
      arbitraryNewMutation: () => writes++,
      domEditSelection: {
        element: {},
        capabilities: { canSelect: true, canEditText: true, canDrag: true },
      },
    };
    const safe = readOnlyManagedDomSession(session, () => {
      blocked++;
    });
    safe.applyDomSelection();
    safe.handleDelete();
    safe.arbitraryNewMutation();
    assert.equal(selections, 1);
    assert.equal(writes, 0);
    assert.equal(blocked, 2);
    assert.equal(safe.domEditSelection.capabilities.canSelect, true);
    assert.equal(safe.domEditSelection.capabilities.canDrag, false);
    assert.equal(session.domEditSelection.capabilities.canDrag, true);
    const locked = readOnlyManagedDomSession(
      { domEditSelection: { capabilities: { canSelect: false } } },
      () => {},
    );
    assert.equal(locked.domEditSelection.capabilities.canSelect, false);
  });
});
