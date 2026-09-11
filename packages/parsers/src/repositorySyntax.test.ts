import { describe, expect, it } from "vitest";
import { inspectRepositorySyntax } from "./repositorySyntax";

describe("repository syntax observations", () => {
  it("extracts TypeScript models, exported functions, class methods and awaited call sites", () => {
    const result = inspectRepositorySyntax(
      "service.ts",
      `
import { save as persist } from './store.js';
export interface Order { id: string; total: number }
export async function submit(order: Order) { await persist(order); }
export class Service { run() { submit({id: 'one', total: 3}); } }
export { submit as placeOrder };
`,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.declarations.find((item) => item.name === "Order")?.fields).toEqual([
      "id",
      "total",
    ]);
    expect(result.declarations.find((item) => item.name === "submit")).toMatchObject({
      exportedAs: ["submit", "placeOrder"],
      calls: [{ target: "persist", line: 4, awaited: true, shadowed: false }],
    });
    expect(result.declarations.find((item) => item.name === "Service.run")?.calls[0]?.target).toBe(
      "submit",
    );
  });
  it("does not mistake comments, strings, unrelated .get calls or shadowed parameters for observed API registrations", () => {
    const result = inspectRepositorySyntax(
      "api.ts",
      `
import { Hono } from 'hono';
const app = new Hono();
app.get('/orders', handler);
const text = "app.post('/invented', handler)";
// app.delete('/imagined', handler)
other.get('/cache', handler);
function shadow(app: unknown) { app.get('/fake', handler); }
function register(api: Hono) { api.post('/real', handler); }
`,
    );
    expect(result.routes.map((item) => item.path)).toEqual(["/orders", "/real"]);
  });
  it("withholds local/parameter-shadowed call resolution and nested callbacks from the outer workflow", () => {
    const result = inspectRepositorySyntax(
      "api.ts",
      `
import { save } from './store';
function execute(save: Function) { save(); }
function configure() { const save = () => {}; save(); }
function register() { subscribe(() => save()); }
`,
    );
    expect(result.declarations.find((item) => item.name === "execute")?.calls[0]?.shadowed).toBe(
      true,
    );
    expect(result.declarations.find((item) => item.name === "configure")?.calls[0]?.shadowed).toBe(
      true,
    );
    expect(
      result.declarations
        .find((item) => item.name === "register")
        ?.calls.map((item) => item.target),
    ).toEqual(["subscribe"]);
  });
  it("reports malformed input rather than extracting plausible text with regular expressions", () => {
    const result = inspectRepositorySyntax("broken.ts", "export function missing( {");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.declarations).toEqual([]);
  });
  it("parses JSX and TSX without executing expressions", () => {
    for (const path of ["page.jsx", "page.tsx"]) {
      const result = inspectRepositorySyntax(
        path,
        "export function Page() { return <h1>Hello</h1>; }",
      );
      expect(result.diagnostics).toEqual([]);
      expect(result.declarations[0]?.name).toBe("Page");
    }
  });
  it("withholds reassigned call bindings and mutable or unrelated framework receivers", () => {
    const result = inspectRepositorySyntax(
      "app.ts",
      `
import { Hono, html } from 'hono';
let app = new Hono();
app = cache;
app.get('/not-a-route', handler);
const template = html();
template.get('/also-not-a-route', handler);
function save() {}
save = somethingElse;
function run() { save(); }
`,
    );
    expect(result.routes).toEqual([]);
    expect(result.declarations.find((item) => item.name === "run")?.calls[0]?.shadowed).toBe(true);
  });
  it("records module side effects and re-exports while preserving catch binding uncertainty", () => {
    const result = inspectRepositorySyntax(
      "app.ts",
      "import './setup'; export * from './other'; import { save } from './store'; function run() { try {} catch (save) { save(); } }",
    );
    expect(result.imports.map((item) => item.module)).toEqual(["./setup", "./other", "./store"]);
    expect(result.declarations[0]?.calls[0]?.shadowed).toBe(true);
  });
  it("does not bind a route's shadowed handler to an unrelated global function", () => {
    const result = inspectRepositorySyntax(
      "app.ts",
      "import { Hono } from 'hono'; const app = new Hono(); function handler() {} function register(handler: Function) { app.get('/orders', handler); }",
    );
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.handler).toBeNull();
  });
});
