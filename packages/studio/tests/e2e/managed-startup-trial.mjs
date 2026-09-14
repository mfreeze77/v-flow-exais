import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sampleManagedStartup, startupIdentityMatches } from "./managed-startup-probe.mjs";
import {
  STARTUP_PROFILES,
  STARTUP_TIMEOUT_MS,
  STARTUP_VIEWPORT,
  STARTUP_BROWSER_ARGS,
  loopbackOrigin,
  managedProjectId,
  requestPermitted,
} from "./managed-startup-contract.mjs";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const failure = (error) =>
  error instanceof Error ? (error.stack ?? error.message) : String(error);
const NETWORK_EVENTS = new Set(["request", "response", "requestfinished", "requestfailed"]);

/** The original observers are reused. This facade drops exactly the selected observer group. */
export function diagnosticPageFacade(page, profile, attached = []) {
  return {
    on(event, handler) {
      const enabled =
        event === "console" ? profile.console : NETWORK_EVENTS.has(event) ? profile.network : true;
      if (enabled) {
        page.on(event, handler);
        attached.push([event, handler]);
      }
      return this;
    },
  };
}

/** Always installed, including the no-diagnostics arms. Observers cannot authorize requests. */
export function attachLoopbackGuard(page, origin, evidence) {
  const handler = (request) => {
    let action;
    try {
      const permitted = requestPermitted(request.url(), origin);
      if (!permitted) evidence.blockedExternal.push(request.url());
      // Preserve immediate legacy interception, as the current harness uses.
      // Catch rejected resolutions so a transport failure cannot be reported as a clean arm.
      if (request.isInterceptResolutionHandled?.()) {
        evidence.instrumentationErrors.push(
          "Request was resolved before the required loopback guard.",
        );
        return;
      }
      action = permitted ? request.continue() : request.abort();
      Promise.resolve(action).catch((error) => evidence.instrumentationErrors.push(failure(error)));
    } catch (error) {
      evidence.instrumentationErrors.push(failure(error));
      try {
        Promise.resolve(request.abort()).catch(() => {});
      } catch {
        /* Recorded above. */
      }
    }
  };
  page.on("request", handler);
  return () => page.off("request", handler);
}

/**
 * One read-only startup trial. No application mutation API, event dispatch, overlay removal,
 * browser bringToFront, timeout inflation, or automatic retry. Real Puppeteer is injected by CLI.
 * Adjacent unit/browser tests inject their explicitly identified transport implementation.
 */
export async function runStartupTrial(options, dependencies) {
  const { launch, attachNetworkDiagnostics, now = Date.now } = dependencies;
  const { profile: name, index, round, output, shell, localTree, inputHash } = options;
  if (!Object.hasOwn(STARTUP_PROFILES, name)) throw new Error(`Unknown profile ${name}`);
  const profile = STARTUP_PROFILES[name];
  const origin = loopbackOrigin(options.baseUrl);
  const projectId = managedProjectId(options.projectId);
  const evidence = {
    schemaVersion: 1,
    status: "diagnostic-only",
    index,
    round,
    profile: name,
    projectId,
    localTree,
    inputHash,
    settings: profile,
    browserVersion: null,
    nodeVersion: process.version,
    outcome: "invalid",
    originalMountWait: "not-run",
    startedAt: now(),
    beforeHash: null,
    afterHash: null,
    expected: null,
    afterRevisionHash: null,
    requests: [],
    blockedExternal: [],
    pageErrors: [],
    instrumentationErrors: [],
    diagnosticsEnabled: {
      network: profile.network,
      console: profile.console,
      responseSummary: profile.summary,
    },
    phases: [],
    acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
  };
  let browser,
    page,
    pending = () => [],
    phaseName = null;
  const checkpoint = () => {
    if (profile.checkpoints)
      writeFileSync(join(output, "checkpoint.json"), JSON.stringify(evidence, null, 2) + "\n");
  };
  const phase = async (name, task) => {
    const entry = { name, state: "running", startedAt: now() };
    evidence.phases.push(entry);
    phaseName = name;
    checkpoint();
    try {
      const result = await task();
      entry.state = "complete";
      return result;
    } catch (error) {
      entry.state = "failed";
      entry.error = failure(error);
      throw error;
    } finally {
      entry.finishedAt = now();
      phaseName = null;
      checkpoint();
    }
  };
  const readProject = () =>
    page.evaluate(async (id) => {
      const response = await fetch(`/api/vflow/projects/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(`Project read failed (${response.status}).`);
      const data = await response.json();
      if (data.snapshot?.manifest?.id !== id) throw new Error("Project identity mismatch.");
      return data.snapshot;
    }, projectId);
  const readView = () =>
    page.evaluate(async (id) => {
      const response = await fetch(`/api/vflow/projects/${encodeURIComponent(id)}/editor`);
      if (!response.ok) throw new Error(`Editor view failed (${response.status}).`);
      const view = await response.json();
      if (
        view.projectId !== id ||
        !Number.isSafeInteger(view.revision) ||
        view.revision < 0 ||
        !/^[a-f0-9]{64}$/.test(view.revisionHash ?? "")
      )
        throw new Error("Malformed editor view.");
      return {
        projectId: id,
        revision: view.revision,
        revisionHash: view.revisionHash,
        origin: location.origin,
      };
    }, projectId);
  try {
    browser = await launch({
      executablePath: shell,
      headless: true,
      args: [...STARTUP_BROWSER_ARGS],
    });
    evidence.browserVersion = await browser.version();
    page = await browser.newPage();
    pending = attachNetworkDiagnostics(
      diagnosticPageFacade(page, profile),
      evidence,
      () => phaseName,
    );
    await page.setViewport({ ...STARTUP_VIEWPORT });
    await page.setRequestInterception(true);
    attachLoopbackGuard(page, origin, evidence);
    if (profile.summary)
      page.on("response", (response) => {
        const request = response.request(),
          url = new URL(response.url());
        evidence.requests.push({
          method: request.method(),
          path: url.pathname,
          search: url.search,
          status: response.status(),
        });
      });
    page.on("pageerror", (error) => evidence.pageErrors.push(String(error)));
    await page.goto(origin.href, { waitUntil: "domcontentloaded" });
    const before = await phase("existing-fixture-read", readProject);
    evidence.beforeHash = digest(before);
    evidence.expected = await readView();
    if (evidence.expected.revision !== before.manifest.revision)
      throw new Error("Authoring changed before startup.");
    const started = now();
    try {
      await phase("managed-route-mounted", async () => {
        // The same navigation and selectors used by managed-studio.mjs.
        await page.goto(
          `${origin.origin}/#project/${encodeURIComponent(projectId)}?editor=studio`,
          { waitUntil: "domcontentloaded" },
        );
        const header = await page.waitForSelector('header[aria-label="Managed Studio"]');
        await header?.dispose();
        const waitOptions = { timeout: STARTUP_TIMEOUT_MS };
        if (profile.polling !== "raf") waitOptions.polling = profile.polling;
        const handle = await page.waitForFunction(
          () => [...document.querySelectorAll('[aria-label="Timeline"] [data-clip]')].length > 0,
          waitOptions,
        );
        await handle.dispose();
      });
      evidence.originalMountWait = "complete";
    } catch (error) {
      evidence.originalMountWait = "failed";
      evidence.error = failure(error);
    }
    evidence.elapsedMs = now() - started;
    // Probe AFTER the wait. No DOM sampling or layout forcing is added to its polling loop.
    evidence.snapshot = await page.evaluate(sampleManagedStartup);
    if (typeof page.metrics === "function") {
      try {
        evidence.browserMetrics = await page.metrics();
      } catch (error) {
        evidence.metricsError = failure(error);
      }
    }
    evidence.outcome =
      evidence.originalMountWait === "failed"
        ? "mount-failed"
        : startupIdentityMatches(evidence.snapshot, evidence.expected)
          ? "ready"
          : "invalid";
    if (evidence.originalMountWait === "complete" && evidence.outcome === "invalid")
      evidence.error =
        "The original clip wait completed, but the immediate snapshot does not confirm a ready matching view.";
    evidence.pendingAtObservation = profile.network ? pending() : null;
    // A screenshot can force rendering. Capture that separately; never use it to rewrite the wait's outcome.
    try {
      await page.screenshot({ path: join(output, "observed.png"), fullPage: true });
      evidence.afterScreenshot = await page.evaluate(sampleManagedStartup);
    } catch (error) {
      evidence.captureError = failure(error);
    }
    const after = await readProject();
    evidence.afterHash = digest(after);
    evidence.afterRevisionHash = (await readView()).revisionHash;
    if (
      evidence.afterHash !== evidence.beforeHash ||
      evidence.afterRevisionHash !== evidence.expected.revisionHash
    ) {
      evidence.outcome = "invalid";
      evidence.error = "The authoring snapshot changed during this read-only trial.";
    }
    if (
      evidence.pageErrors.length ||
      evidence.blockedExternal.length ||
      evidence.instrumentationErrors.length
    ) {
      evidence.outcome = "invalid";
      evidence.error ??= "Page/network-policy/observer errors invalidate this startup comparison.";
    }
  } catch (error) {
    evidence.outcome = "invalid";
    evidence.error = failure(error);
    if (page) {
      try {
        evidence.snapshot = await page.evaluate(sampleManagedStartup);
      } catch (capture) {
        evidence.captureError = failure(capture);
      }
      try {
        evidence.afterHash = digest(await readProject());
      } catch (read) {
        evidence.afterReadError = failure(read);
      }
    }
  } finally {
    if (page) evidence.pendingBeforeClose = profile.network ? pending() : null;
    if (browser)
      try {
        await browser.close();
      } catch (error) {
        evidence.outcome = "invalid";
        evidence.closeError = failure(error);
      }
    if (
      evidence.pageErrors.length ||
      evidence.blockedExternal.length ||
      evidence.instrumentationErrors.length
    )
      evidence.outcome = "invalid";
    evidence.finishedAt = now();
    writeFileSync(join(output, "trial.json"), JSON.stringify(evidence, null, 2) + "\n");
  }
  return evidence;
}
