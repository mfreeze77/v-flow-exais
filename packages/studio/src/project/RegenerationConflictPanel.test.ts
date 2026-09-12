import { it } from "vitest";
import assert from "node:assert/strict";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  applyProjectCommand,
  type DiagramSource,
  type ProjectOperation,
} from "@hyperframes/project-model";
import { conflictProjectFixture } from "../../../project-model/src/regenerationConflicts.fixture";
import { RegenerationConflictPanel } from "./RegenerationConflictPanel";

type Props = { children?: ReactNode; onClick?: () => void; disabled?: boolean };
function buttons(node: ReactNode): Props[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<Props>(node)) return [];
  return [...(node.type === "button" ? [node.props] : []), ...buttons(node.props.children)];
}
function snapshot() {
  const current = conflictProjectFixture();
  const source = structuredClone(current.sources.diagram) as DiagramSource;
  source.connections = (source.connections as { id: string }[]).filter(
    (edge) => edge.id !== "edge-b",
  );
  return applyProjectCommand(current, {
    commandId: "remove-edge",
    origin: "ui",
    projectId: current.manifest.id,
    expectedRevision: 0,
    operations: [{ type: "replace-diagram-source", documentId: "diagram", source }],
  });
}
it("does not display a warning for a project with no persistent conflicts", () => {
  assert.equal(
    RegenerationConflictPanel({
      snapshot: conflictProjectFixture(),
      busy: false,
      onResolve: () => {},
    }),
    null,
  );
});
it("renders reopened conflict identity and original revision from project state", () => {
  const reopened = JSON.parse(JSON.stringify(snapshot()));
  const html = renderToStaticMarkup(
    createElement(RegenerationConflictPanel, {
      snapshot: reopened,
      busy: false,
      onResolve: () => {},
    }),
  );
  assert.ok(html.includes("Unresolved presentation conflicts"));
  assert.ok(html.includes("edge-b"));
  assert.ok(html.includes("diagram.json"));
  assert.ok(html.includes("revision <!-- -->1") || html.includes("revision 1"));
});
it("disables restoration when the original target is not authored", () => {
  const controls = buttons(
    RegenerationConflictPanel({ snapshot: snapshot(), busy: false, onResolve: () => {} }),
  );
  assert.equal(controls.length, 2);
  assert.equal(controls[0]!.disabled, true);
  assert.equal(controls[1]!.disabled, false);
});
it("enables only explicit original-target restoration after source repair", () => {
  const repaired = snapshot();
  repaired.sources = conflictProjectFixture().sources;
  const actions: ProjectOperation[] = [];
  const controls = buttons(
    RegenerationConflictPanel({
      snapshot: repaired,
      busy: false,
      onResolve: (op) => actions.push(op),
    }),
  );
  assert.equal(controls[0]!.disabled, false);
  controls[0]!.onClick!();
  assert.deepEqual(actions, [
    {
      type: "restore-regeneration-conflict",
      conflictId: repaired.manifest.regenerationConflicts![0]!.id,
    },
  ]);
});
it("discard emits a command instead of locally hiding or deleting the record", () => {
  const current = snapshot();
  const original = JSON.stringify(current);
  const actions: ProjectOperation[] = [];
  const controls = buttons(
    RegenerationConflictPanel({
      snapshot: current,
      busy: false,
      onResolve: (op) => actions.push(op),
    }),
  );
  controls[1]!.onClick!();
  assert.equal(JSON.stringify(current), original);
  assert.deepEqual(actions, [
    {
      type: "discard-regeneration-conflict",
      conflictId: current.manifest.regenerationConflicts![0]!.id,
    },
  ]);
});
it("disables both actions during a pending project transaction", () => {
  const current = snapshot();
  current.sources = conflictProjectFixture().sources;
  const controls = buttons(
    RegenerationConflictPanel({ snapshot: current, busy: true, onResolve: () => {} }),
  );
  assert.equal(controls.length, 2);
  assert.ok(controls.every((control) => control.disabled));
});
it("renders preserved detail as text, not executable HTML", () => {
  const current = snapshot();
  current.manifest.regenerationConflicts![0]!.detail = "<script>untrusted()</script>";
  const html = renderToStaticMarkup(
    createElement(RegenerationConflictPanel, {
      snapshot: current,
      busy: false,
      onResolve: () => {},
    }),
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});
