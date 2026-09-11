import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import type { ProposedProjectEdit } from "../../packages/studio-server/src/project/proposalTypes";

const output = resolve("evidence/tickets/AFM-098/browser");
mkdirSync(output, { recursive: true });
const home = process.env.VFLOW_DATA_HOME!;
if (home !== "/tmp/vflow-proposal-review")
  throw new Error("Use the isolated proposal review test instance.");
const service = new UnifiedProjectService({
  home,
  sourceRoots: [
    { id: "source", label: "Owned source", path: "/input/packages/studio-server/src/project" },
  ],
});
const intake = await service.intake({ kind: "local", rootId: "source", path: "." });
const project = await service.importDiagram({
  schema_version: 1,
  diagram_type: "architecture",
  meta: { title: "Source review", viewBox: [900, 570], legend: { mode: "hidden" } },
  components: [
    { id: "object-0", type: "backend", label: "Source", pos: [60, 80], size: [180, 70] },
  ],
  connections: [],
  cards: [],
});
const id = project!.id;
const before = service.get(id).snapshot;
const document = before.manifest.documents.find((item) => item.kind !== "native")!;
const cliCommands: { args: string[]; exitCode: number }[] = [];
const cli = (args: string[]) => {
  const full = ["run", "vflow", ...args, "--home", home];
  const result = execFileSync("bun", full, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    maxBuffer: 16_000_000,
  });
  cliCommands.push({ args: ["bun", ...full], exitCode: 0 });
  try {
    return JSON.parse(result);
  } catch {
    mkdirSync("out/proposal-review", { recursive: true });
    writeFileSync(`out/proposal-review/${args[0]}-incomplete.json`, result);
    throw new Error(
      `CLI JSON was incomplete: ${args[0]}, ${Buffer.byteLength(result)} bytes. Raw output retained in out/proposal-review.`,
    );
  }
};
const context = cli(["proposal-context", "--id", id, "--intake", intake.id]);
const observation = context.source.observations.find((item: any) => item.name === "proposalPath");
if (!observation) throw new Error("Expected actual proposalPath implementation evidence.");
// This is a recorded agent-authored edit using the real source context and CLI.
// It is not evidence of a live configured generation-provider integration.
const proposal: ProposedProjectEdit = {
  schemaVersion: 1,
  projectId: id,
  title: "Explain the proposalPath source identity",
  expectedRevision: 0,
  source: { intakeId: intake.id, snapshotHash: intake.facts.snapshotHash },
  operations: [
    {
      type: "rename-object",
      documentId: document.id,
      objectId: "object-0",
      label: observation.name,
    },
  ],
  claims: [{ id: "source-name", basis: "observation", sourceId: observation.id, field: "name" }],
  wording: [{ operationIndex: 0, pointer: "/label", claimId: "source-name" }],
  objects: [],
  relationships: [],
};
writeFileSync(`${output}/agent-proposal.json`, JSON.stringify(proposal, null, 2));
const created = cli(["propose", "--file", `${output}/agent-proposal.json`]);
if (!created.preview.valid) throw new Error(JSON.stringify(created.preview.diagnostics));
const rejected = await service.proposals.create({ ...proposal, title: "Candidate to reject" });
const require = createRequire(new URL("../../packages/studio/package.json", import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer-core")).href);
const browser = await puppeteer.launch({
  executablePath: process.env.PRODUCER_HEADLESS_SHELL_PATH,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
});
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (error: Error) => errors.push(error.message));
const clickText = async (text: string) => {
  const found = await page.evaluate((text: string) => {
    const button = [...document.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === text,
    );
    button?.click();
    return !!button;
  }, text);
  if (!found) throw new Error(`Missing button: ${text}`);
};
try {
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:5190/#project/${id}`, {
    waitUntil: "networkidle2",
    timeout: 90_000,
  });
  await page.waitForSelector(".vf-workspace");
  await clickText("Proposals");
  await page.waitForSelector(".vf-proposal-choice:not(:disabled)");
  await page.evaluate(
    (title: string) =>
      [...document.querySelectorAll<HTMLButtonElement>(".vf-proposal-choice")]
        .find((button) => button.textContent?.includes(title))!
        .click(),
    "Candidate to reject",
  );
  await page.waitForSelector(".vf-proposal-claim");
  await clickText("Reject proposal");
  await page.waitForFunction(() =>
    document.querySelector(".vf-proposal-detail")?.textContent?.includes("rejected"),
  );
  await page.waitForSelector(".vf-proposal-choice:not(:disabled)");
  if (service.get(id).snapshot.manifest.revision !== 0)
    throw new Error("Rejecting changed the project.");
  await page.evaluate(
    (title: string) =>
      [...document.querySelectorAll<HTMLButtonElement>(".vf-proposal-choice")]
        .find((button) => button.textContent?.includes(title))!
        .click(),
    proposal.title,
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".vf-proposal-detail h3")?.textContent ===
      "Explain the proposalPath source identity",
  );
  await page.evaluate(() => {
    [...document.querySelectorAll<HTMLElement>("summary")]
      .find((item) => item.textContent === "Revise typed proposal")!
      .click();
  });
  const revised = { ...proposal, title: `${proposal.title} (reviewed)` };
  await page.$eval(
    'textarea[aria-label="Proposal JSON"]',
    (element: HTMLTextAreaElement, text: string) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        element,
        text,
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
    },
    JSON.stringify(revised),
  );
  await clickText("Save revised proposal");
  await page.waitForFunction(
    (title: string) => document.querySelector(".vf-proposal-detail h3")?.textContent === title,
    {},
    revised.title,
  );
  await page.waitForSelector(".vf-proposal-choice:not(:disabled)");
  await page.evaluate(() => {
    [...document.querySelectorAll<HTMLElement>("summary")]
      .find((item) => item.textContent === "Revise typed proposal")!
      .click();
    [...document.querySelectorAll<HTMLElement>("summary")]
      .find((item) => item.textContent?.includes("/components/0/label"))!
      .click();
  });
  await page.click(".vf-proposal-claim summary");
  await page.screenshot({ path: `${output}/review-desktop.png` });
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval(".vf-proposal-detail", (element: Element) => element.scrollIntoView());
  await page.screenshot({ path: `${output}/review-mobile.png` });
  await page.setViewport({ width: 1440, height: 1100 });
  await clickText("Accept as one revision");
  await page.waitForFunction(
    () =>
      document
        .querySelector(".vf-proposal-detail")
        ?.textContent?.includes("Accepted at revision 1"),
    { timeout: 60_000 },
  );
  await page.screenshot({ path: `${output}/accepted.png` });
  await clickText("Close");
  await clickText("Undo");
  await page.waitForFunction(
    () => document.querySelector(".vf-topbar")?.textContent?.includes("Saved revision 2"),
    { timeout: 60_000 },
  );
  const undone = service.get(id).snapshot;
  if (JSON.stringify(undone.sources) !== JSON.stringify(before.sources))
    throw new Error("Undo did not restore all authoring documents.");
  const historical = cli(["review-proposal", "--id", id, "--proposal", created.record.id]);
  if (historical.record.acceptedRevision !== 1 || !historical.preview.valid)
    throw new Error("Historical accepted review was not preserved after undo.");
  if (errors.length) throw new Error(errors.join("\n"));
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        projectId: id,
        intakeId: intake.id,
        sourceSnapshot: intake.facts.snapshotHash,
        sourceEvidence: observation.evidence,
        acceptedProposal: created.record.id,
        rejectedProposal: rejected.record.id,
        acceptedRevision: 1,
        reviewedProposalVersion: historical.record.version,
        undoRevision: undone.manifest.revision,
        sourceRestored: true,
        historicalPreviewValid: historical.preview.valid,
        cliCommands,
        errors,
        providerEvidence:
          "No configured-provider model call; this records an agent-authored proposal, real CLI, real Studio review and actual project revisions.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      id,
      acceptedRevision: 1,
      undoRevision: undone.manifest.revision,
      sourceRestored: true,
      cliCommands,
      errors,
    }),
  );
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
