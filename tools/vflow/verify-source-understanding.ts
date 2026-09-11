// Actual Chromium verification against the separately started Docker Studio.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const require = createRequire(new URL("../../packages/studio/package.json", import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer-core")).href);
const output = resolve("evidence/tickets/AFM-093/source-understanding");
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.PRODUCER_HEADLESS_SHELL_PATH,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
});
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (error: Error) => errors.push(error.message));
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
try {
  await page.goto("http://127.0.0.1:5190/", { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector('[aria-label="Project folder"]');
  await page.$eval('[aria-label="Project folder"]', (input: HTMLInputElement) => input.select());
  await page.type('[aria-label="Project folder"]', "packages/studio-server");
  const intakeResponse = page.waitForResponse(
    (response: any) =>
      response.url().endsWith("/api/vflow/intakes") && response.request().method() === "POST",
    { timeout: 180_000 },
  );
  const started = performance.now();
  await page.evaluate(() =>
    (
      [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Inspect source"),
      ) as HTMLButtonElement
    ).click(),
  );
  const response = await intakeResponse;
  if (response.status() !== 200) throw new Error(await response.text());
  const intake = await response.json();
  const elapsedMs = Math.round(performance.now() - started);
  await page.waitForSelector('[aria-label="Repository understanding"]');
  const knowledge = intake.facts.understanding;
  if (knowledge.coverage.parsedFiles < 30)
    throw new Error("Real implementation files were not parsed.");
  await page.select('[aria-label="Finding type"]', "api");
  await page.type('[aria-label="Search source findings"]', "POST /vflow");
  await page.waitForFunction(() => document.querySelectorAll(".vf-source-findings li").length > 0);
  await page.click(".vf-source-findings button");
  await page.waitForSelector(".vf-source-excerpt pre");
  const excerpt = await page.$eval(".vf-source-excerpt pre", (node: HTMLElement) => node.innerText);
  if (!excerpt.includes("api.post("))
    throw new Error("Route finding lacks matching implementation excerpt.");
  await page.$eval('[aria-label="Repository understanding"]', (element: Element) =>
    element.scrollIntoView(),
  );
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.$eval(".vf-source-detail", (element: Element) => element.scrollIntoView());
  await page.screenshot({ path: `${output}/mobile.png` });
  const overflow = await page.evaluate(
    () => document.querySelector(".vf-app")!.scrollWidth > innerWidth,
  );
  if (overflow) throw new Error("Source review overflows the mobile viewport.");
  if (errors.length) throw new Error(errors.join("\n"));
  const summary = {
    source: "packages/studio-server",
    snapshotHash: intake.facts.snapshotHash,
    elapsedMs,
    coverage: knowledge.coverage,
    observationCount: knowledge.observations.length,
    relationships: Object.fromEntries(
      ["imports", "calls", "registers-handler"].map((kind) => [
        kind,
        knowledge.relationships.filter((item: any) => item.kind === kind).length,
      ]),
    ),
    uncertaintyCount: knowledge.uncertainties.length,
    reviewedApi: knowledge.observations.find((item: any) => item.name === "POST /vflow/intakes"),
    excerpt,
    mobileOverflow: overflow,
    errors,
  };
  const text = JSON.stringify(intake, null, 2);
  mkdirSync("out/source-understanding", { recursive: true });
  writeFileSync("out/source-understanding/intake.json", text);
  writeFileSync(
    `${output}/browser-result.json`,
    JSON.stringify(
      {
        ...summary,
        intakeArtifact: {
          path: "out/source-understanding/intake.json",
          sha256: createHash("sha256").update(text).digest("hex"),
        },
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(summary));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  writeFileSync(
    `${output}/failure.json`,
    JSON.stringify(
      { error: String(error), errors, text: await page.evaluate(() => document.body.innerText) },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
