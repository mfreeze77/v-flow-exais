/** Run the EXISTING editing journey unchanged, then export the SAME project through the UI.
 * Local-only, explicit new-fixture authorization, no cleanup of existing project data.
 * A failed editing journey stops this run. There is no API-only editing fallback.
 * This orchestrator has not been run against the full server in the contribution sandbox.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { assertManagedDeliveryProbe } from "./managed-delivery-contract.mjs";
import { MANAGED_JOURNEY_PHASES } from "./managed-studio-diagnostics.mjs";

const allowed = new Set(["--base-url", "--output", "--headless-shell", "--ffprobe", "--ffmpeg"]);
const values = new Map();
let permit = false;
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (key === "--allow-create-test-project") {
    assert(!permit, "Duplicate permission flag");
    permit = true;
    continue;
  }
  assert(allowed.has(key) && !values.has(key), `Unknown or duplicated option: ${key}`);
  const value = process.argv[++index];
  assert(value && !value.startsWith("--"), `Missing ${key} value`);
  values.set(key, value);
}
assert(
  permit,
  "Pass --allow-create-test-project; exactly one NEW retained fixture will be created.",
);
const origin = new URL(values.get("--base-url") ?? "http://127.0.0.1:5190");
assert(
  origin.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
    origin.pathname === "/" &&
    !origin.search &&
    !origin.hash &&
    !origin.username &&
    !origin.password,
  "HTTP loopback origin required",
);
assert(values.has("--output"), "A fresh --output directory is required");
const output = resolve(values.get("--output"));
assert(!existsSync(output), "Output already exists");
mkdirSync(output, { recursive: true });
const shell = values.get("--headless-shell") ?? process.env.PRODUCER_HEADLESS_SHELL_PATH;
assert(shell, "Specify the actual pinned headless-shell path");
const ffprobe = values.get("--ffprobe") ?? "ffprobe",
  ffmpeg = values.get("--ffmpeg") ?? "ffmpeg";
const here = dirname(fileURLToPath(import.meta.url));
const evidence = {
  status: "running",
  editingJourney: "not-run",
  export: "not-run",
  probe: "not-run",
  frames: "not-run",
  visualReview: "not-performed",
  commands: [],
  requests: [],
  pageErrors: [],
  blockedExternal: [],
};
const save = () =>
  writeFileSync(join(output, "result.json"), JSON.stringify(evidence, null, 2) + "\n");
function execute(name, binary, args, timeout) {
  return new Promise((resolveRun, reject) => {
    const item = { name, binary, args, exitCode: null, signal: null };
    evidence.commands.push(item);
    let stdout = "",
      stderr = "",
      timedOut = false,
      tooLarge = false;
    // Linux/macOS: the fixture harness and its descendants own one NEW process
    // group. On timeout stop only that group, never an unrelated browser/server.
    const ownGroup = process.platform !== "win32";
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], detached: ownGroup });
    let force;
    const signalOwned = (signal) => {
      if (!child.pid) return;
      try {
        if (ownGroup) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error.code !== "ESRCH") item.cleanupError = String(error);
      }
    };
    const stop = () => {
      signalOwned("SIGTERM");
      if (!force) {
        force = setTimeout(() => signalOwned("SIGKILL"), 2000);
        force.unref();
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeout);
    const collect = (stream) => (bytes) => {
      if (stream === "out") stdout += bytes.toString();
      else stderr += bytes.toString();
      if (!tooLarge && Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > 32 * 1024 * 1024) {
        tooLarge = true;
        stop();
      }
    };
    child.stdout.on("data", collect("out"));
    child.stderr.on("data", collect("err"));
    child.on("error", (error) => {
      item.spawnError = String(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (timedOut || tooLarge) signalOwned("SIGKILL");
      if (force) clearTimeout(force);
      Object.assign(item, { exitCode: code, signal, timedOut, tooLarge });
      writeFileSync(join(output, name + ".stdout.log"), stdout);
      writeFileSync(join(output, name + ".stderr.log"), stderr);
      save();
      if (code !== 0 || signal || timedOut || tooLarge || item.spawnError || item.cleanupError)
        reject(new Error(`${name} failed: ${JSON.stringify(item)}`));
      else resolveRun(stdout);
    });
  });
}
let browser;
try {
  const runnerFiles = [
    "managed-studio-delivery.mjs",
    "managed-delivery-contract.mjs",
    "managed-studio.mjs",
    "managed-studio-diagnostics.mjs",
    "managed-studio-probe.mjs",
  ];
  const runnerHashes = () =>
    Object.fromEntries(
      runnerFiles.map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(join(here, file)))
          .digest("hex"),
      ]),
    );
  evidence.runnerSources = runnerHashes();
  evidence.node = process.version;
  save();
  await execute("ffprobe-version", ffprobe, ["-version"], 10000);
  await execute("ffmpeg-version", ffmpeg, ["-version"], 10000);
  const journeyOutput = join(output, "journey");
  evidence.editingJourney = "running";
  await execute(
    "editing-journey",
    process.execPath,
    [
      join(here, "managed-studio.mjs"),
      "--base-url",
      origin.origin,
      "--headless-shell",
      shell,
      "--allow-create-test-project",
      "--output",
      journeyOutput,
    ],
    18 * 60 * 1000,
  );
  const journey = JSON.parse(readFileSync(join(journeyOutput, "result.json"), "utf8"));
  assert.equal(journey.status, "passed", "Editing journey did not pass");
  assert(Array.isArray(journey.phases), "Editing journey has no phase evidence");
  assert.deepEqual(
    journey.phases.map((phase) => phase.name),
    MANAGED_JOURNEY_PHASES,
    "Editing journey phase inventory is missing, duplicated, or out of order",
  );
  assert(
    journey.phases.every((phase) => phase.status === "passed"),
    "Editing journey has incomplete phases",
  );
  assert.deepEqual(
    runnerHashes(),
    evidence.runnerSources,
    "Harness source changed during execution",
  );
  const id = journey.projectId;
  assert(typeof id === "string" && /^video-[0-9a-f-]+$/.test(id), "Unexpected fixture ID");
  evidence.projectId = id;
  evidence.editingJourney = "passed";
  save();
  const get = async (path) => {
    const response = await fetch(new URL(path, origin), {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    assert(response.ok, `${path} returned ${response.status}`);
    return response.json();
  };
  const before = await get(`/api/vflow/projects/${id}`);
  const revision = before.snapshot.manifest.revision;
  evidence.revision = revision;
  writeFileSync(
    join(output, "captured-project.json"),
    JSON.stringify(before.snapshot, null, 2) + "\n",
    { flag: "wx" },
  );
  evidence.export = "running";
  save();
  browser = await puppeteer.launch({
    executablePath: shell,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  evidence.browser = await browser.version();
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["about:", "blob:", "data:"].includes(url.protocol) && url.origin !== origin.origin) {
      evidence.blockedExternal.push(request.url());
      void request.abort();
    } else void request.continue();
  });
  page.on("response", (response) =>
    evidence.requests.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
    }),
  );
  page.on("pageerror", (error) => evidence.pageErrors.push(String(error)));
  await page.goto(`${origin.origin}/#project/${encodeURIComponent(id)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent?.trim() === "Export MP4" && !button.disabled,
      ),
    { timeout: 60000 },
  );
  const buttons = await page.$$("button");
  let exportButton;
  for (const button of buttons)
    if (await button.evaluate((el) => el.textContent?.trim() === "Export MP4")) {
      exportButton = button;
      break;
    }
  assert(exportButton, "Workspace export button missing");
  const started = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/vflow/batches" &&
      response.request().method() === "POST",
    { timeout: 60000 },
  );
  await exportButton.click();
  const startResponse = await started;
  assert(startResponse.ok(), "UI export request failed");
  const batch = await startResponse.json();
  assert(typeof batch.id === "string" && /^[A-Za-z0-9_-]+$/.test(batch.id), "Invalid batch ID");
  evidence.batchId = batch.id;
  const link = await page.waitForFunction(
    (id) => {
      const section = document.querySelector('[aria-label="Render batch"]');
      if (!section) return false;
      const status = section.querySelector(".vf-tag")?.textContent?.trim();
      if (["failed", "partial", "cancelled", "interrupted"].includes(status ?? ""))
        throw new Error(`Render failed: ${section.textContent}`);
      return (
        [...section.querySelectorAll("a[href]")]
          .map((a) => a.getAttribute("href"))
          .find((href) => href?.endsWith(`/outputs/${id}`)) || false
      );
    },
    { timeout: 300000 },
    id,
  );
  const downloadPath = await link.jsonValue();
  assert.equal(
    downloadPath,
    `/api/vflow/batches/${batch.id}/outputs/${id}`,
    "Download belongs to another batch/project",
  );
  await page.screenshot({ path: join(output, "workspace-export.png"), fullPage: true });
  const finished = await get(`/api/vflow/batches/${batch.id}`);
  const item = finished.items.find((entry) => entry.projectId === id);
  assert.equal(item?.status, "complete");
  assert.equal(item.build?.revision, revision, "Export used a different revision");
  const response = await fetch(new URL(downloadPath, origin), {
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  assert(response.ok && response.body, "Output download failed");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert(size <= 256 * 1024 * 1024, "Unexpected fixture export size");
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  assert(bytes.length > 0, "Empty export");
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash, item.sha256, "Downloaded bytes differ from batch receipt");
  const movie = join(output, "managed-studio.mp4");
  writeFileSync(movie, bytes, { flag: "wx", mode: 0o600 });
  evidence.export = "passed";
  evidence.video = {
    file: "managed-studio.mp4",
    bytes: bytes.length,
    sha256: hash,
    buildHash: item.build.hash,
  };
  save();
  evidence.probe = "running";
  save();
  const probeArgs = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-count_frames",
    "-show_entries",
    "stream=codec_name,width,height,avg_frame_rate,nb_read_frames:format=duration",
    "-of",
    "json",
    "--",
    movie,
  ];
  const probe = JSON.parse(await execute("ffprobe", ffprobe, probeArgs, 60000));
  evidence.measured = assertManagedDeliveryProbe(probe, before.snapshot.manifest);
  evidence.probe = "passed";
  evidence.frames = "running";
  save();
  for (const kind of ["native", "diagram"]) {
    const scene = before.snapshot.manifest.scenes.find((entry) => entry.kind === kind);
    assert(scene, `Missing ${kind} scene`);
    const frame = scene.startFrame + Math.floor(scene.durationFrames / 2),
      fps = before.snapshot.manifest.output.fps;
    const args = [
      "-nostdin",
      "-v",
      "error",
      "-ss",
      String((frame * fps.denominator) / fps.numerator),
      "-i",
      movie,
      "-frames:v",
      "1",
      "-n",
      join(output, `${kind}-frame.png`),
    ];
    await execute(`${kind}-frame`, ffmpeg, args, 60000);
    assert(
      readFileSync(join(output, `${kind}-frame.png`)).length > 0,
      "No inspection frame produced",
    );
  }
  assert.deepEqual(
    (await get(`/api/vflow/projects/${id}`)).snapshot,
    before.snapshot,
    "Export mutated authoring state",
  );
  assert.deepEqual(evidence.pageErrors, [], "Export page had errors");
  assert.deepEqual(evidence.blockedExternal, [], "Export attempted external browser requests");
  assert.deepEqual(
    runnerHashes(),
    evidence.runnerSources,
    "Harness source changed during execution",
  );
  evidence.frames = "produced-for-review";
  evidence.status = "automated-checks-passed-visual-review-required";
  evidence.limitations = [
    "Inspect the real native/diagram frames and video; no perceptual or visual acceptance is automated.",
    "Fixture and its revisions are retained. No unrelated containers, volumes, or projects are removed.",
  ];
} catch (error) {
  for (const key of ["editingJourney", "export", "probe", "frames"])
    if (evidence[key] === "running") evidence[key] = "failed";
  evidence.status = "failed";
  evidence.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  save();
}
console.log(
  JSON.stringify({ status: evidence.status, projectId: evidence.projectId ?? null, output }),
);
