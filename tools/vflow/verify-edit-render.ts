import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../packages/studio/package.json", import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer-core")).href);
const base = "http://127.0.0.1:5190";
const api = async (path: string, body?: unknown) => {
  const response = await fetch(
    `${base}/api/vflow${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
};
const original = JSON.parse(readFileSync("evidence/tickets/AFM-099/browser/intake.json", "utf8"));
const ids = original.proposals.map((plan: any) => plan.snapshot.manifest.id);
// Persist presentation-friendly source layouts through exactly the same command
// ingress as the editor. Old revisions remain available to undo/reopen.
for (const id of ids) {
  const { snapshot } = await api(`/projects/${id}`);
  if (snapshot.manifest.revision > 0) continue;
  const operations: any[] = [];
  for (const doc of snapshot.manifest.documents) {
    if (doc.kind !== "architecture") continue;
    const source = structuredClone(snapshot.sources[doc.id]);
    source.connections = source.connections.slice(0, 2);
    const fan = source.connections.length > 0;
    const needed = new Set(source.connections.flatMap((edge: any) => [edge.from, edge.to]));
    source.components = fan
      ? source.components.filter((node: any) => needed.has(node.id))
      : source.components.slice(0, 4);
    source.components.forEach((node: any, index: number) => {
      node.size = [180, 70];
      node.pos = fan
        ? index === 0
          ? [50, 135]
          : [330, 85 + (index - 1) * 100]
        : [60 + (index % 2) * 240, 80 + Math.floor(index / 2) * 110];
    });
    operations.push({ type: "replace-diagram-source", documentId: doc.id, source });
    for (const scene of snapshot.manifest.scenes.filter(
      (scene: any) => scene.documentId === doc.id,
    ))
      operations.push({
        type: "set-scene-presentation",
        sceneId: scene.id,
        presentation: {
          ...scene.presentation,
          subtitle: fan
            ? "Selected relationships declared in source. Arrows preserve their authored direction."
            : "Selected packages from the inspected source manifests.",
          focusObjectIds: source.components.map((node: any) => node.id),
          relationshipIds: source.connections.map((edge: any) => edge.id),
        },
      });
  }
  await api(`/projects/${id}/commands`, {
    commandId: crypto.randomUUID(),
    projectId: id,
    origin: "agent",
    expectedRevision: snapshot.manifest.revision,
    operations,
  });
}
const id = ids[1];
const browser = await puppeteer.launch({
  executablePath: process.env.PRODUCER_HEADLESS_SHELL_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1560, height: 1050 });
const errors: string[] = [];
page.on("pageerror", (error: Error) => errors.push(error.message));
try {
  const before = await api(`/projects/${id}`);
  console.log("Opening revision", before.snapshot.manifest.revision);
  await page.goto(`${base}/#project/${id}`, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForFunction(() => (document.querySelector("hyperframes-player") as any)?.ready, {
    timeout: 60_000,
  });
  await page.evaluate(() =>
    (document.querySelectorAll(".vf-scene-card")[1] as HTMLButtonElement).click(),
  );
  const input = await page.$('input[aria-label="Label for object-0"]');
  await input.focus();
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await input.type("CLI entry point");
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Label for object-0"]')!;
    input.closest("form")!.requestSubmit();
  });
  await page.waitForFunction(
    (revision: number) => document.body.innerText.includes(`Saved revision ${revision}`),
    { timeout: 30_000 },
    before.snapshot.manifest.revision + 1,
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForFunction(() => (document.querySelector("hyperframes-player") as any)?.ready, {
    timeout: 60_000,
  });
  await page.evaluate(() =>
    (document.querySelectorAll(".vf-scene-card")[1] as HTMLButtonElement).click(),
  );
  const state: any[] = [];
  const captures: string[] = [];
  for (const time of [18.5, 0, 4.2, 4.2, 7, 4.2]) {
    await page.evaluate(
      (time: number) => (document.querySelector("hyperframes-player") as any).seek(time),
      time,
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
    const frame = page.frames().find((frame: any) => frame.url().includes("/api/vflow/projects/"));
    state.push(
      await frame.evaluate(
        (time: number) => ({
          time,
          timelines: Object.fromEntries(
            Object.entries((window as any).__timelines || {}).map(([id, timeline]: any) => [
              id,
              { time: timeline.time(), duration: timeline.duration(), paused: timeline.paused() },
            ]),
          ),
          signals: [...document.querySelectorAll("[data-vflow-relationship-id]")].map((node) => ({
            id: node.id,
            from: node.getAttribute("data-vflow-from"),
            to: node.getAttribute("data-vflow-to"),
            offset: getComputedStyle(node).strokeDashoffset,
          })),
          labels: [...document.querySelectorAll("[data-node-label]")]
            .map((node) => node.textContent)
            .filter(Boolean),
        }),
        time,
      ),
    );
    if (time === 4.2)
      captures.push(
        createHash("sha256")
          .update(await (await page.$(".vf-canvas")).screenshot())
          .digest("hex"),
      );
  }
  assert.equal(errors.length, 0);
  assert.equal(
    new Set(captures).size,
    1,
    "Repeated and reverse seeks must reproduce identical pixels.",
  );
  assert.deepEqual(state[2], state[3]);
  assert.deepEqual(state[2], state[5]);
  assert.ok(
    state[2].signals.every(
      (signal: any) => signal.from === "object-0" && ["object-1", "object-2"].includes(signal.to),
    ),
  );
  assert.ok(
    parseFloat(state[2].signals[0].offset) > 0 && parseFloat(state[2].signals[0].offset) < 1,
    "Authored path should draw continuously, not switch on in one step.",
  );
  assert.ok(state[2].labels.includes("CLI entry point"));
  await page.screenshot({
    path: "evidence/tickets/AFM-099/browser/04-edited-reopened.png",
    fullPage: true,
  });
  writeFileSync(
    "evidence/tickets/AFM-099/browser/edit-seek.json",
    JSON.stringify({ id, errors, state, captures }, null, 2),
  );
  console.log(
    JSON.stringify({
      id,
      errors,
      captures,
      checks: [
        "edit/reopen",
        "authored edge direction",
        "continuous trace",
        "repeated and reverse pixel equality",
      ],
    }),
  );
} catch (error) {
  await page.screenshot({
    path: "evidence/tickets/AFM-099/browser/edit-failure.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      error: String(error),
      errors,
      body: await page.evaluate(() => document.body.innerText),
      url: page.url(),
    }),
  );
  throw error;
} finally {
  await browser.close();
}
