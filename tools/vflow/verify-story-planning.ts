import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";

const home = process.env.VFLOW_DATA_HOME!;
assert.equal(home, "/tmp/vflow-story-review");
const evidence = "evidence/tickets/AFM-093/story-planning";
const output = "out/story-planning";
mkdirSync(evidence, { recursive: true });
mkdirSync(output, { recursive: true });
const require = createRequire(new URL("../../packages/studio/package.json", import.meta.url));
let ready = false;
for (let attempt = 0; attempt < 30 && !ready; attempt++) {
  ready = await fetch("http://127.0.0.1:5190/api/vflow/sources", {
    signal: AbortSignal.timeout(3000),
  })
    .then((response) => response.ok)
    .catch(() => false);
  if (!ready) await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.ok(ready, "The isolated Studio server did not become ready.");
const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer-core")).href);
const browser = await puppeteer.launch({
  executablePath: process.env.PRODUCER_HEADLESS_SHELL_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (error: Error) => errors.push(error.message));
const api = async (path: string, body?: unknown) => {
  const response = await fetch(
    `http://127.0.0.1:5190/api/vflow${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
};
const click = async (text: string) => {
  const button = await page.evaluateHandle(
    (text: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) => item.textContent?.trim() === text,
      ),
    text,
  );
  assert.ok(button.asElement(), `Missing button ${text}`);
  await button.asElement()!.click();
};
const setInput = async (selector: string, value: string) => {
  await page.$eval(
    selector,
    (element: HTMLInputElement, value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        element,
        value,
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
    },
    value,
  );
};
try {
  await page.setViewport({ width: 1500, height: 1100 });
  await page.goto("http://127.0.0.1:5190", { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector('[aria-label="Project folder"]');
  await setInput('[aria-label="Project folder"]', "packages/studio-server/src/project");
  await setInput('[aria-label="Story target seconds"]', "25");
  await setInput('[aria-label="Story video count"]', "3");
  await page.select('[aria-label="Story audience"]', "maintainers");
  const inspected = page.waitForResponse(
    (response: any) =>
      response.url().endsWith("/vflow/intakes") && response.request().method() === "POST",
    { timeout: 90_000 },
  );
  await click("Inspect source →");
  let intake = await (await inspected).json();
  assert.equal(intake.proposals.length, 3, JSON.stringify(intake));
  await page.waitForSelector(".vf-story-plan");
  await page.$eval(".vf-plan-grid", (element: Element) => element.scrollIntoView());
  await page.screenshot({ path: `${evidence}/plans-desktop.png` });
  await page.click(".vf-story-plan details summary");
  await setInput(
    `input[aria-label="Video title ${intake.proposals[0].id}"]`,
    `${intake.proposals[0].title} / source walkthrough`,
  );
  await page.click(".vf-story-plan:nth-child(2) details summary");
  const secondId = intake.proposals[1].id;
  const secondTitle = `${intake.proposals[1].title} / reviewed`;
  await setInput(`input[aria-label="Video title ${secondId}"]`, secondTitle);
  assert.equal(
    await page.$eval(".vf-story-ack input", (element: HTMLInputElement) => element.checked),
    false,
  );
  const revised = page.waitForResponse(
    (response: any) =>
      response.url().includes("/stories/") && response.request().method() === "POST",
    { timeout: 60_000 },
  );
  await click("Save story edits");
  const revisedResponse = await revised;
  assert.equal(revisedResponse.status(), 200);
  intake = await revisedResponse.json();
  await page.waitForFunction(() => !document.body.innerText.includes("Validating story edits…"));
  assert.equal(
    await page.$eval(
      `input[aria-label="Video title ${secondId}"]`,
      (element: HTMLInputElement) => element.value,
    ),
    secondTitle,
    "Saving the first story discarded another unsaved story",
  );
  const secondSaved = page.waitForResponse(
    (response: any) =>
      response.url().endsWith(`/stories/${secondId}`) && response.request().method() === "POST",
    { timeout: 60_000 },
  );
  await page.click(".vf-story-plan:nth-child(2) details button");
  const secondResponse = await secondSaved;
  assert.equal(secondResponse.status(), 200);
  intake = await secondResponse.json();
  await page.waitForFunction(() => !document.body.innerText.includes("Validating story edits…"));
  await page.click(".vf-story-plan details summary");
  await page.$eval(".vf-story-plan", (element: Element) => element.scrollIntoView());
  await page.screenshot({ path: `${evidence}/script-desktop.png` });
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval(".vf-story-plan", (element: Element) => element.scrollIntoView());
  await page.screenshot({ path: `${evidence}/script-mobile.png` });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    "Mobile page overflows",
  );
  await page.setViewport({ width: 1500, height: 1100 });
  await page.click(".vf-story-ack input");
  const accepted = page.waitForResponse(
    (response: any) => response.url().endsWith(`/intakes/${intake.id}/accept`),
    { timeout: 60_000 },
  );
  await click("Create 3 video projects");
  const acceptedResponse = await accepted;
  assert.equal(acceptedResponse.status(), 200);
  const projects = (await acceptedResponse.json()).projects;
  writeFileSync(`${output}/intake.json`, JSON.stringify(intake, null, 2));
  writeFileSync(`${output}/projects.json`, JSON.stringify(projects, null, 2));
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    JSON.stringify({
      event: "story-review-passed",
      titles: intake.proposals.map((plan: any) => plan.title),
      families: intake.proposals.map((plan: any) => plan.story.family),
      projectIds: projects.map((project: any) => project.id),
      preservedOtherDraft: true,
    }),
  );
  const batch = await api("/batches", { projectIds: projects.map((project: any) => project.id) });
  writeFileSync(`${output}/batch-id.txt`, batch.id);
  console.log(JSON.stringify({ event: "batch-started", id: batch.id }));
  let state = batch;
  const deadline = Date.now() + 20 * 60_000;
  let previous = "";
  while (state.status === "running" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    state = await api(`/batches/${batch.id}`);
    const status = state.items
      .map((item: any) => `${item.status}:${Math.floor(item.progress / 20) * 20}`)
      .join(",");
    if (status !== previous) {
      console.log(status);
      previous = status;
    }
  }
  assert.equal(state.status, "complete", JSON.stringify(state.items));
  const stored = JSON.parse(readFileSync(join(home, "batches", `${batch.id}.json`), "utf8"));
  const service = new UnifiedProjectService({ home, sourceRoots: [] });
  for (const [index, item] of stored.items.entries()) {
    copyFileSync(item.outputPath, `${output}/story-${index}.mp4`);
    const snapshot = service.get(item.projectId).snapshot;
    const frames = [];
    for (const [beatIndex, scene] of snapshot.manifest.scenes.entries()) {
      const at = (scene.startFrame + scene.durationFrames * 0.75) / 30;
      const path = `${evidence}/film-${index}-beat-${beatIndex}.png`;
      execFileSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          String(at),
          "-i",
          item.outputPath,
          "-frames:v",
          "1",
          path,
        ],
        { timeout: 60_000 },
      );
      frames.push({ at, path });
    }
    item.frames = frames;
    item.retainedVideo = `${output}/story-${index}.mp4`;
  }
  writeFileSync(
    `${evidence}/result.json`,
    JSON.stringify(
      {
        intakeId: intake.id,
        snapshotHash: intake.facts.snapshotHash,
        options: intake.planning.options,
        plans: intake.proposals.map((plan: any) => ({
          id: plan.id,
          planHash: plan.planHash,
          title: plan.title,
          family: plan.story.family,
          beats: plan.story.beats,
        })),
        batch: stored,
        errors,
        providerEvidence:
          "Offline evidence-driven draft planning and user-interface script revision; no model call or human film acceptance is claimed.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      event: "render-proof-complete",
      id: stored.id,
      videos: stored.items.map((item: any) => ({ path: item.retainedVideo, probe: item.probe })),
    }),
  );
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png` }).catch(() => undefined);
  writeFileSync(
    `${evidence}/failure.json`,
    JSON.stringify(
      {
        error: String(error),
        errors,
        text: await page.evaluate(() => document.body.innerText).catch(() => "Page unavailable"),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
