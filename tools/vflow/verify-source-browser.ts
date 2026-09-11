// Run inside the workspace container against the owned Studio acceptance instance.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(new URL("../../packages/studio/package.json", import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer-core")).href);
const output = resolve("evidence/tickets/AFM-099/browser");
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.PRODUCER_HEADLESS_SHELL_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 1560, height: 1050, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on("pageerror", (error: Error) => errors.push(error.message));
page.on("console", (message: any) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("response", async (response: any) => {
  if (response.url().endsWith("/api/vflow/intakes") && response.request().method() === "POST") {
    try {
      writeFileSync(`${output}/intake.json`, JSON.stringify(await response.json(), null, 2));
    } catch {
      /* Error recorded through UI. */
    }
  }
});
try {
  await page.goto("http://127.0.0.1:5190/", { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector(".vf-intake-card", { timeout: 30_000 });
  await page.screenshot({ path: `${output}/01-launcher.png`, fullPage: true });
  const clickText = async (text: string) => {
    const clicked = await page.evaluate((needle: string) => {
      const button = [...document.querySelectorAll("button")].find((item) =>
        item.textContent?.includes(needle),
      );
      button?.click();
      return !!button;
    }, text);
    if (!clicked) throw new Error(`Button not found: ${text}`);
  };
  await clickText("Inspect source");
  await page.waitForSelector(".vf-plan", { timeout: 180_000 });
  await page.screenshot({ path: `${output}/02-plans.png`, fullPage: true });
  if ((await page.$$eval(".vf-plan", (plans: Element[]) => plans.length)) !== 3)
    throw new Error("Expected three source-grounded video plans.");
  await clickText("Create 3 video projects");
  await page.waitForFunction(() => document.querySelectorAll(".vf-project-card").length >= 3, {
    timeout: 90_000,
  });
  await clickText("dependency story");
  await page.waitForSelector("hyperframes-player", { timeout: 90_000 });
  await page.waitForFunction(() => (document.querySelector("hyperframes-player") as any)?.ready, {
    timeout: 60_000,
  });
  await page.evaluate(() => (document.querySelector("hyperframes-player") as any).seek(4));
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.screenshot({ path: `${output}/03-editor.png`, fullPage: true });
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        url: page.url(),
        errors,
        player: await page.evaluate(() => {
          const player = document.querySelector("hyperframes-player") as any;
          return {
            ready: player.ready,
            duration: player.duration,
            currentTime: player.currentTime,
          };
        }),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ url: page.url(), errors, evidence: output }));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  writeFileSync(
    `${output}/failure.json`,
    JSON.stringify(
      {
        error: String(error),
        errors,
        text: await page.evaluate(() => document.body.innerText),
        url: page.url(),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
