/** Local browser verification. Creates one NEW fixture only with explicit permission.
 * Never deletes projects, changes timeouts in tests, or contacts paid/external services.
 * Requires the pinned workspace server and headless shell. This harness was NOT run
 * in the contribution sandbox; successful execution is a local acceptance prerequisite.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
const origin = new URL(arg("--base-url") ?? "http://127.0.0.1:5190");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
  origin.protocol !== "http:" ||
  origin.pathname !== "/"
)
  throw new Error("Use an HTTP loopback origin for the local verification server.");
if (!args.includes("--allow-create-test-project"))
  throw new Error(
    "Pass --allow-create-test-project to create a disposable fixture. No existing project is touched.",
  );
const outputArg = arg("--output");
if (!outputArg) throw new Error("A new --output directory is required.");
const output = resolve(outputArg);
if (existsSync(output)) throw new Error("Output exists; choose a new evidence directory.");
mkdirSync(output, { recursive: true });
const shell = arg("--headless-shell") ?? process.env.PRODUCER_HEADLESS_SHELL_PATH;
if (!shell)
  throw new Error(
    "Pass the actual pinned --headless-shell path (or PRODUCER_HEADLESS_SHELL_PATH).",
  );
const evidence = {
  status: "running",
  steps: [],
  requests: [],
  blockedExternal: [],
  pageErrors: [],
  projectId: null,
};
let browser;
const save = () =>
  writeFileSync(join(output, "result.json"), JSON.stringify(evidence, null, 2) + "\n");
try {
  browser = await puppeteer.launch({
    executablePath: shell,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["about:", "data:", "blob:"].includes(url.protocol) && url.origin !== origin.origin) {
      evidence.blockedExternal.push(request.url());
      void request.abort();
    } else void request.continue();
  });
  page.on("response", (response) => {
    const request = response.request();
    evidence.requests.push({
      method: request.method(),
      path: new URL(response.url()).pathname,
      status: response.status(),
    });
  });
  page.on("pageerror", (error) => evidence.pageErrors.push(String(error)));
  await page.goto(origin.href, { waitUntil: "domcontentloaded" });
  const imported = await page.evaluate(async () => {
    const response = await fetch("/api/vflow/import-diagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schema_version: 1,
        diagram_type: "architecture",
        meta: {
          title: "Managed Studio browser fixture",
          viewBox: [900, 570],
          legend: { mode: "hidden" },
        },
        components: [
          { id: "gateway", type: "backend", label: "Gateway", pos: [60, 80], size: [180, 70] },
          { id: "api", type: "backend", label: "API", pos: [320, 80], size: [180, 70] },
        ],
        connections: [{ id: "edge-a", from: "gateway", to: "api" }],
        cards: [],
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body;
  });
  assert.equal(typeof imported.id, "string");
  const id = imported.id;
  evidence.projectId = id;
  save();
  const get = () =>
    page.evaluate(async (id) => {
      const r = await fetch(`/api/vflow/projects/${id}`);
      if (!r.ok) throw new Error("project read failed");
      return r.json();
    }, id);
  const initial = await get();
  assert.equal(initial.snapshot.manifest.revision, 0);
  await page.goto(`${origin.origin}/#project/${encodeURIComponent(id)}?editor=studio`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('header[aria-label="Managed Studio"]');
  await page.waitForFunction(
    () => [...document.querySelectorAll('[aria-label="Timeline"] [data-clip]')].length > 0,
    { timeout: 60000 },
  );
  const preview = await page.evaluate(async (id) => {
    const view = await (await fetch(`/api/vflow/projects/${id}/editor`)).json();
    const r = await fetch(`/api/vflow/projects/${id}/editor/previews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: id,
        revision: view.revision,
        revisionHash: view.revisionHash,
      }),
    });
    if (!r.ok) throw new Error("preview preparation failed");
    return r.json();
  }, id);
  const title = preview.scenes.find((s) => s.documentKind === "native");
  assert(title);
  // Use an emitted playback identity, not a display-label or position guess.
  // hostKey is the player's own scoped form (`index.html#el-N`); the bare
  // hostId is the DOM id and never appears as a timeline key.
  const tokens = [title.hostKey, title.hostId, title.hostCompositionId, title.renderId];
  const clipId = await page.evaluate(
    (tokens) =>
      [...document.querySelectorAll('[aria-label="Timeline"] [data-clip][data-el-id]')]
        .map((el) => el.getAttribute("data-el-id"))
        .find((key) => tokens.includes(key)),
    tokens,
  );
  assert(
    clipId,
    "No native scene clip matches its emitted identity; timeline integration is not accepted.",
  );
  const clip = await page.$(`[aria-label="Timeline"] [data-clip][data-el-id="${clipId}"]`);
  assert(clip);
  await clip.click({ clickCount: 2 });
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Authoring target"] option[value]:not([value=""])') !==
      null,
    { timeout: 60000 },
  );
  let frame;
  for (const candidate of page.frames()) {
    if (new URL(candidate.url(), origin).searchParams.get("sceneId") === title.sceneId)
      frame = candidate;
  }
  assert(frame, "The retained player never opened the pinned native scene.");
  await frame.waitForSelector("h1");
  await frame.click("h1");
  await page.waitForFunction(() =>
    Boolean(document.querySelector('[aria-label="Authoring target"]')?.value),
  );
  evidence.steps.push({ name: "timeline drill-down and real canvas selection", status: "passed" });
  await page.screenshot({ path: join(output, "01-native-before.png"), fullPage: true });
  const text = await page.$('[aria-label="Authored text"]');
  assert(text);
  await text.click({ clickCount: 3 });
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Browser-authored title");
  async function button(label) {
    const handles = await page.$$("button");
    for (const h of handles)
      if ((await h.evaluate((el) => el.textContent?.trim())) === label) return h;
    throw new Error(`Missing button ${label}`);
  }
  await (await button("Save authored text")).click();
  await page.waitForFunction(
    async (id) =>
      (await (await fetch(`/api/vflow/projects/${id}`)).json()).snapshot.manifest.revision === 1,
    { timeout: 60000 },
    id,
  );
  const nativeSaved = await get();
  assert.match(nativeSaved.snapshot.sources.title, /Browser-authored title/);
  const ready = () =>
    page.waitForFunction(
      () => {
        const buttons = [...document.querySelectorAll('[aria-label="Managed scenes"] button')];
        return buttons.length > 1 && buttons.every((b) => !b.disabled);
      },
      { timeout: 60000 },
    );
  await ready();
  const diagramButton = await page.$(
    '[aria-label="Managed scenes"] button[aria-pressed]:last-of-type',
  );
  assert(diagramButton);
  await diagramButton.click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[aria-label="Authoring target"] option')].some(
        (el) => el.value === "gateway",
      ),
    { timeout: 60000 },
  );
  await page.select('[aria-label="Authoring target"]', "gateway");
  await page.click('[aria-label="Authored text"]', { clickCount: 3 });
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Browser gateway");
  await (await button("Save authored text")).click();
  await page.waitForFunction(
    async (id) =>
      (await (await fetch(`/api/vflow/projects/${id}`)).json()).snapshot.manifest.revision === 2,
    { timeout: 60000 },
    id,
  );
  const mixed = await get();
  assert.equal(mixed.snapshot.sources.diagram.components[0].label, "Browser gateway");
  assert.deepEqual(
    mixed.snapshot.sources.diagram.connections,
    initial.snapshot.sources.diagram.connections,
  );
  evidence.steps.push({
    name: "native and diagram edit through one Studio",
    status: "passed",
    revision: 2,
  });
  await ready();
  await (await button("Undo")).click();
  await page.waitForFunction(
    async (id) =>
      (await (await fetch(`/api/vflow/projects/${id}`)).json()).snapshot.manifest.revision === 3,
    { timeout: 60000 },
    id,
  );
  const undo = await get();
  assert.equal(undo.snapshot.sources.diagram.components[0].label, "Gateway");
  assert.match(undo.snapshot.sources.title, /Browser-authored title/);
  await ready();
  await (await button("Redo")).click();
  await page.waitForFunction(
    async (id) =>
      (await (await fetch(`/api/vflow/projects/${id}`)).json()).snapshot.manifest.revision === 4,
    { timeout: 60000 },
    id,
  );
  evidence.steps.push({ name: "journal undo/redo through actual UI", status: "passed" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('header[aria-label="Managed Studio"]');
  await ready();
  const reopened = await get();
  assert.equal(reopened.snapshot.manifest.revision, 4);
  assert.equal(reopened.snapshot.sources.diagram.components[0].label, "Browser gateway");
  // Deliberate legacy mutation request proves the server fence, not just disabled controls.
  const blocked = await page.evaluate(
    async (id) =>
      (
        await fetch(`/api/projects/${id}/files/title.html`, {
          method: "PUT",
          body: "malicious replacement",
        })
      ).status,
    id,
  );
  assert.equal(blocked, 409);
  assert.equal((await get()).snapshot.manifest.revision, 4);
  evidence.steps.push({ name: "reopen and server mutation refusal", status: "passed" });
  await page.screenshot({ path: join(output, "02-after-reopen.png"), fullPage: true });
  const unauthorized = evidence.requests.filter(
    (r) =>
      r.path.startsWith(`/api/projects/${id}/`) &&
      !["GET", "HEAD"].includes(r.method) &&
      r.status < 400,
  );
  assert.deepEqual(unauthorized, []);
  evidence.status = "passed";
  evidence.limitations = [
    "No video export or visual sign-off is claimed by this harness.",
    "Fixture project is deliberately retained; remove only its recorded ID through an authorized cleanup workflow.",
    "The timeline is read-only; drill-down, selection and journal inspector edits are covered.",
  ];
} catch (error) {
  evidence.status = "failed";
  evidence.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  save();
}
console.log(JSON.stringify({ status: evidence.status, projectId: evidence.projectId, output }));
