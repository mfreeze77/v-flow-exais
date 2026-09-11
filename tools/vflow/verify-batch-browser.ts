import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../packages/studio/package.json", import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer-core")).href);
const base = "http://127.0.0.1:5190";
const output = "out/vflow-demo";
mkdirSync(output, { recursive: true });
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
  await page.goto(base, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector(".vf-project-card");
  const created = page.waitForResponse(
    (response: any) =>
      response.url().endsWith("/api/vflow/batches") && response.request().method() === "POST",
  );
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      node.textContent?.includes("Export all"),
    );
    if (!button) throw new Error("Export all missing");
    button.click();
  });
  const response = await created;
  assert.ok(response.ok());
  const started = await response.json();
  console.log(JSON.stringify({ event: "ui-batch-started", id: started.id }));
  let batch = started;
  let previous = "";
  const deadline = Date.now() + 600000;
  while (batch.status === "running" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    batch = await (await fetch(`${base}/api/vflow/batches/${started.id}`)).json();
    const progress = batch.items
      .map((item: any) => `${item.status}:${Math.floor(item.progress / 20) * 20}`)
      .join(",");
    if (progress !== previous) {
      console.log(progress);
      previous = progress;
    }
  }
  assert.equal(
    batch.status,
    "complete",
    JSON.stringify(batch.items.map((item: any) => item.error)),
  );
  await page.waitForFunction(() => document.querySelectorAll(".vf-batch a").length === 3, {
    timeout: 15000,
  });
  await page.locator(".vf-batch").scroll();
  await page.screenshot({
    path: "evidence/tickets/AFM-099/browser/05-batch-complete.png",
    fullPage: true,
  });
  const links: string[] = await page.$$eval(".vf-batch a", (links: HTMLAnchorElement[]) =>
    links.map((link) => link.href),
  );
  const projects = (await (await fetch(`${base}/api/vflow/projects`)).json()).projects;
  const artifacts: any[] = [];
  for (const item of batch.items) {
    assert.ok(links.includes(base + item.downloadUrl));
    const response = await fetch(base + item.downloadUrl);
    assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
    const title = projects.find((project: any) => project.id === item.projectId).title;
    const name = title.split(" / ").at(-1).replace(/\s+/g, "-");
    const path = `${output}/${name}.mp4`;
    writeFileSync(path, bytes);
    const source = await (await fetch(`${base}/api/vflow/projects/${item.projectId}`)).json();
    writeFileSync(`${output}/${name}.project.json`, JSON.stringify(source, null, 2));
    writeFileSync(`${output}/${name}.build.json`, JSON.stringify(item.build, null, 2));
    const contact = `evidence/tickets/AFM-099/browser/${name}-frames.png`;
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      path,
      "-vf",
      "select='eq(n,18)+eq(n,76)+eq(n,114)+eq(n,174)+eq(n,241)+eq(n,300)+eq(n,406)+eq(n,489)+eq(n,564)',scale=640:360,tile=3x3",
      "-frames:v",
      "1",
      "-y",
      contact,
    ]);
    artifacts.push({
      projectId: item.projectId,
      title,
      path,
      sha256: item.sha256,
      probe: item.probe,
      buildHash: item.build.hash,
      revision: item.build.revision,
      contact,
    });
  }
  assert.equal(errors.length, 0);
  writeFileSync(`${output}/batch.json`, JSON.stringify(batch, null, 2));
  writeFileSync(
    "evidence/tickets/AFM-099/browser/batch-result.json",
    JSON.stringify({ batchId: batch.id, errors, artifacts }, null, 2),
  );
  console.log(JSON.stringify({ batchId: batch.id, errors, artifacts }));
} catch (error) {
  await page.screenshot({
    path: "evidence/tickets/AFM-099/browser/batch-failure.png",
    fullPage: true,
  });
  console.error(
    JSON.stringify({ errors, body: await page.evaluate(() => document.body.innerText) }),
  );
  throw error;
} finally {
  await browser.close();
}
