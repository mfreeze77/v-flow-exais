// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, vi } from "vitest";
import assert from "node:assert/strict";
import { ManagedStudioEntry } from "./ManagedStudioEntry";
import { MANAGED_STUDIO_PROTOCOL } from "./managedStudioAccess";

vi.mock("../App", () => ({
  StudioApp: () => <div data-testid="retained-app">Retained Studio</div>,
}));
let host: HTMLDivElement, root: Root;
const flag = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
beforeEach(() => {
  flag.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const good = () =>
  Response.json({
    protocol: MANAGED_STUDIO_PROTOCOL,
    projectId: "project-test",
    nativeRoutes: "blocked-except-authoring-reads",
    history: "project-journal",
  });
async function render() {
  await act(async () => {
    root.render(<ManagedStudioEntry id="project-test" />);
  });
}
it("does not mount retained App before preflight completes", async () => {
  let resolve!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((yes) => {
        resolve = yes;
      }),
  );
  await render();
  assert.equal(host.querySelector("[data-testid=retained-app]"), null);
  await act(async () => resolve(good()));
  assert(host.querySelector("[data-testid=retained-app]"));
});
it("bad capability never mounts the retained App", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ protocol: "old" }));
  await render();
  assert.equal(host.querySelector("[data-testid=retained-app]"), null);
  assert(host.querySelector("[role=alert]"));
});
it("HTTP failure preserves a route back without mounting", async () => {
  vi.stubGlobal("fetch", async () => new Response("not here", { status: 404 }));
  await render();
  assert(host.querySelector("a[href='#project/project-test']"));
  assert.equal(host.querySelector("[data-testid=retained-app]"), null);
});
it("malformed JSON is a handled preflight error", async () => {
  vi.stubGlobal("fetch", async () => new Response("{"));
  await render();
  assert(host.querySelector("[role=alert]"));
  assert.equal(host.querySelector("[data-testid=retained-app]"), null);
});
it("unmount aborts an outstanding handshake and cannot mount after resolution", async () => {
  let resolve!: (r: Response) => void;
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", (_url: string, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return new Promise<Response>((yes) => {
      resolve = yes;
    });
  });
  await render();
  await act(async () => {
    root.render(null);
  });
  assert(signal?.aborted);
  await act(async () => resolve(good()));
  assert.equal(host.textContent, "");
});
it("Strict Mode aborted first handshake cannot authorize the second instance", async () => {
  const pending: Array<{ resolve: (r: Response) => void; signal: AbortSignal }> = [];
  vi.stubGlobal(
    "fetch",
    (_url: string, options: RequestInit) =>
      new Promise<Response>((resolve) =>
        pending.push({ resolve, signal: options.signal as AbortSignal }),
      ),
  );
  await act(async () =>
    root.render(
      <React.StrictMode>
        <ManagedStudioEntry id="project-test" />
      </React.StrictMode>,
    ),
  );
  assert.equal(pending.length, 2);
  assert(pending[0]!.signal.aborted);
  await act(async () => pending[0]!.resolve(good()));
  assert.equal(host.querySelector("[data-testid=retained-app]"), null);
  await act(async () => pending[1]!.resolve(good()));
  assert(host.querySelector("[data-testid=retained-app]"));
});
