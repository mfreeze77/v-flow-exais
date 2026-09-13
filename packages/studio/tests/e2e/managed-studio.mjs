/** Local browser verification. Creates one NEW fixture only with explicit permission.
 * Never deletes projects, changes timeouts in tests, or contacts paid/external services.
 * Requires the pinned workspace server and headless shell. This harness was NOT run
 * in the contribution sandbox; successful execution is a local acceptance prerequisite.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import puppeteer from "puppeteer-core";
import {
  installManagedClickTrace,
  managedPhasePredicate,
  sampleManagedStudio,
} from "./managed-studio-probe.mjs";
import {
  attachNetworkDiagnostics,
  captureManagedFailure,
  createPhaseLedger,
} from "./managed-studio-diagnostics.mjs";

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
  verificationEnvironment: { node: process.version, browser: null },
  harnessSourceHashes: Object.fromEntries(
    ["managed-studio.mjs", "managed-studio-probe.mjs", "managed-studio-diagnostics.mjs"].map(
      (name) => [
        name,
        createHash("sha256")
          .update(readFileSync(new URL(name, import.meta.url)))
          .digest("hex"),
      ],
    ),
  ),
  status: "running",
  steps: [],
  requests: [],
  blockedExternal: [],
  pageErrors: [],
  projectId: null,
};
const ledger = createPhaseLedger();
evidence.phases = ledger.phases;
evidence.diagnosticScope =
  "Real managed Studio harness; a passed phase is not full-pilot or export acceptance.";
let browser;
let page;
let probeRequest = {};
let pendingRequests = () => [];
const save = () =>
  writeFileSync(join(output, "result.json"), JSON.stringify(evidence, null, 2) + "\n");
try {
  browser = await puppeteer.launch({
    executablePath: shell,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  evidence.verificationEnvironment.browser = await browser.version();
  page = await browser.newPage();
  pendingRequests = attachNetworkDiagnostics(page, evidence, ledger.current);
  const phase = async (name, task) => {
    const pending = ledger.run(name, task);
    save();
    try {
      return await pending;
    } finally {
      save();
    }
  };
  const waitPhase = async (name, stage, request) => {
    probeRequest = request;
    await phase(name, async () => {
      const handle = await page.waitForFunction(
        managedPhasePredicate(stage),
        {
          timeout: 60000,
          polling: 100,
        },
        request,
      );
      await handle.dispose();
      const snapshot = await page.evaluate(sampleManagedStudio, request);
      assert.equal(snapshot.ready[stage], true, `${stage} changed before it could be confirmed`);
      writeFileSync(join(output, `${name}.json`), JSON.stringify(snapshot, null, 2) + "\n");
    });
  };
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
      search: new URL(response.url()).search,
      status: response.status(),
    });
  });
  page.on("pageerror", (error) => evidence.pageErrors.push(String(error)));
  await page.goto(origin.href, { waitUntil: "domcontentloaded" });
  const imported = await phase("fixture-created", () =>
    page.evaluate(async () => {
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
    }),
  );
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
  await phase("managed-route-mounted", async () => {
    await page.goto(`${origin.origin}/#project/${encodeURIComponent(id)}?editor=studio`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('header[aria-label="Managed Studio"]');
    await page.waitForFunction(
      () => [...document.querySelectorAll('[aria-label="Timeline"] [data-clip]')].length > 0,
      { timeout: 60000 },
    );
  });
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
  // Only the emitted scoped host key identifies the actual master timeline clip.
  const clipId = await phase("native-clip-resolved", async () => {
    assert.equal(typeof title.hostKey, "string", "Pinned scene has no player hostKey.");
    const count = await page.evaluate(
      (key) =>
        [...document.querySelectorAll('[aria-label="Timeline"] [data-clip][data-el-id]')].filter(
          (element) => element.getAttribute("data-el-id") === key,
        ).length,
      title.hostKey,
    );
    assert.equal(count, 1, "Expected exactly one native clip with the emitted scoped hostKey.");
    return title.hostKey;
  });
  const expected = {
    projectId: id,
    buildHash: preview.buildHash,
    revisionHash: preview.revisionHash,
    sceneId: null,
  };
  // A rendered clip can exist underneath TimelinePane's loading overlay. Check
  // the actual hit target and loaded pin before sending a physical mouse event.
  await waitPhase("native-clip-interactable", "clip-interactable", { clipId, expected });
  await page.evaluate(installManagedClickTrace);
  await phase("native-double-click-delivered", async () => {
    const beforeClick = await page.evaluate(sampleManagedStudio, { clipId, expected });
    assert(
      beforeClick.ready["clip-interactable"],
      "The clip became non-interactable; no click was sent.",
    );
    const { x, y } = beforeClick.target.point;
    // Click the checked point once. Never synthesize a DOM event, use a sidebar
    // fallback, or repeatedly double-click (which may toggle the composition).
    await page.mouse.click(x, y, { clickCount: 2 });
    const delivered = await page.evaluate(sampleManagedStudio, { clipId, expected });
    writeFileSync(
      join(output, "native-double-click-delivered.json"),
      JSON.stringify(delivered, null, 2) + "\n",
    );
    assert(
      delivered.ready["double-click-delivered"],
      "The physical double-click did not reach the expected timeline clip.",
    );
  });
  const sceneRequest = { clipId, expected: { ...expected, sceneId: title.sceneId } };
  await waitPhase("native-scene-loaded", "scene-loaded", sceneRequest);
  await waitPhase("native-authoring-targets", "authoring-targets", sceneRequest);
  const sceneFrames = page.frames().filter((candidate) => {
    const url = new URL(candidate.url(), origin);
    return (
      url.origin === origin.origin &&
      url.pathname === `/api/vflow/projects/${id}/editor/previews/${preview.buildHash}/view` &&
      url.searchParams.get("sceneId") === title.sceneId
    );
  });
  assert.equal(sceneFrames.length, 1, "Expected one frame for the pinned native scene.");
  const frame = sceneFrames[0];
  await phase("canvas-heading-selected", async () => {
    await frame.waitForSelector("h1");
    await frame.click("h1");
    await page.waitForFunction(() =>
      Boolean(document.querySelector('[aria-label="Authoring target"]')?.value),
    );
    evidence.steps.push({
      name: "timeline drill-down and real canvas selection",
      status: "passed",
    });
  });
  await page.screenshot({ path: join(output, "01-native-before.png"), fullPage: true });
  async function button(label) {
    const handles = await page.$$("button");
    for (const h of handles)
      if ((await h.evaluate((el) => el.textContent?.trim())) === label) return h;
    throw new Error(`Missing button ${label}`);
  }
  await phase("native-text-saved", async () => {
    const text = await page.$('[aria-label="Authored text"]');
    assert(text);
    await text.click({ clickCount: 3 });
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Browser-authored title");
    await (await button("Save authored text")).click();
    await page.waitForFunction(
      async (id) =>
        (await (await fetch(`/api/vflow/projects/${id}`)).json()).snapshot.manifest.revision === 1,
      { timeout: 60000 },
      id,
    );
    const nativeSaved = await get();
    assert.match(nativeSaved.snapshot.sources.title, /Browser-authored title/);
  });
  const ready = () =>
    page.waitForFunction(
      () => {
        const buttons = [...document.querySelectorAll('[aria-label="Managed scenes"] button')];
        return buttons.length > 1 && buttons.every((b) => !b.disabled);
      },
      { timeout: 60000 },
    );
  probeRequest = {}; // Later edits produce new pins; capture observed frames without assuming the old one.
  await phase("diagram-label-saved", async () => {
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
  });
  await phase("journal-undo-redo", async () => {
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
  });
  await phase("reopened", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('header[aria-label="Managed Studio"]');
    await ready();
    const reopened = await get();
    assert.equal(reopened.snapshot.manifest.revision, 4);
    assert.equal(reopened.snapshot.sources.diagram.components[0].label, "Browser gateway");
  });
  await phase("legacy-mutation-refused", async () => {
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
  });
  await page.screenshot({ path: join(output, "02-after-reopen.png"), fullPage: true });
  const unauthorized = evidence.requests.filter(
    (r) =>
      r.path.startsWith(`/api/projects/${id}/`) &&
      !["GET", "HEAD"].includes(r.method) &&
      r.status < 400,
  );
  assert.deepEqual(unauthorized, []);
  ledger.assertComplete();
  assert.deepEqual(evidence.pageErrors, [], "The browser reported uncaught page errors.");
  assert.deepEqual(evidence.blockedExternal, [], "The journey attempted an external request.");
  evidence.status = "passed";
  evidence.limitations = [
    "No video export or visual sign-off is claimed by this harness.",
    "Fixture project is deliberately retained; remove only its recorded ID through an authorized cleanup workflow.",
    "The timeline is read-only; drill-down, selection and journal inspector edits are covered.",
  ];
} catch (error) {
  evidence.status = "failed";
  evidence.error = error instanceof Error ? error.stack : String(error);
  evidence.failedPhase = ledger.phases.find((phase) => phase.status === "failed")?.name ?? null;
  evidence.pendingAtFailure = pendingRequests();
  process.exitCode = 1;
  if (page) {
    try {
      evidence.failureCapture = await captureManagedFailure(page, output, probeRequest);
    } catch (captureError) {
      evidence.failureCaptureError = String(captureError);
    }
  }
} finally {
  evidence.pendingBeforeClose = pendingRequests();
  if (browser) {
    try {
      await browser.close();
    } catch (closeError) {
      evidence.closeError = String(closeError);
      evidence.status = "failed";
      process.exitCode = 1;
    }
  }
  save();
}
console.log(JSON.stringify({ status: evidence.status, projectId: evidence.projectId, output }));
