import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sampleManagedStudio } from "./managed-studio-probe.mjs";

export const MANAGED_JOURNEY_PHASES = [
  "fixture-created",
  "managed-route-mounted",
  "native-clip-resolved",
  "native-clip-interactable",
  "native-double-click-delivered",
  "native-scene-loaded",
  "native-authoring-targets",
  "canvas-heading-selected",
  "native-text-saved",
  "diagram-label-saved",
  "journal-undo-redo",
  "reopened",
  "legacy-mutation-refused",
];

export function createPhaseLedger(now = Date.now) {
  const phases = MANAGED_JOURNEY_PHASES.map((name) => ({ name, status: "not-run" }));
  let active = null;
  return {
    phases,
    current: () => active?.name ?? null,
    async run(name, task) {
      const item = phases.find((phase) => phase.name === name);
      if (!item || item.status !== "not-run" || active)
        throw new Error(`Invalid phase transition: ${name}`);
      const index = phases.indexOf(item);
      if (phases.slice(0, index).some((phase) => phase.status !== "passed"))
        throw new Error(`Earlier phase is incomplete: ${name}`);
      active = item;
      item.status = "running";
      item.startedAt = now();
      try {
        const value = await task();
        item.status = "passed";
        return value;
      } catch (error) {
        item.status = "failed";
        item.error = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        item.finishedAt = now();
        active = null;
      }
    },
    assertComplete() {
      if (phases.some((phase) => phase.status !== "passed"))
        throw new Error("The managed journey is incomplete.");
    },
  };
}

/** Real events, never inferred counts from console prose. Retains query strings. */
export function attachNetworkDiagnostics(page, evidence, currentPhase) {
  const requests = new WeakMap();
  const pending = new Map();
  let next = 0;
  evidence.network = [];
  evidence.console = [];
  evidence.droppedDiagnosticEntries = 0;
  const append = (array, value) => {
    if (array.length < 12000) array.push(value);
    else evidence.droppedDiagnosticEntries++;
  };
  page.on("request", (request) => {
    const id = ++next;
    requests.set(request, id);
    const url = new URL(request.url());
    const entry = {
      id,
      phase: currentPhase(),
      method: request.method(),
      url: request.url(),
      path: url.pathname,
      search: url.search,
      resourceType: request.resourceType(),
      startedAt: Date.now(),
      state: "pending",
    };
    append(evidence.network, entry);
    pending.set(id, entry);
  });
  page.on("response", (response) => {
    const entry = pending.get(requests.get(response.request()));
    if (entry) {
      entry.status = response.status();
      entry.respondedAt = Date.now();
    }
  });
  page.on("requestfinished", (request) => {
    const id = requests.get(request);
    const entry = pending.get(id);
    if (entry) {
      entry.state = "finished";
      entry.finishedAt = Date.now();
    }
    pending.delete(id);
  });
  page.on("requestfailed", (request) => {
    const id = requests.get(request);
    const entry = pending.get(id);
    if (entry) {
      entry.state = "failed";
      entry.error = request.failure()?.errorText ?? "unknown request failure";
      entry.finishedAt = Date.now();
    }
    pending.delete(id);
  });
  page.on("console", (message) => {
    if (["error", "warn"].includes(message.type()))
      append(evidence.console, {
        type: message.type(),
        text: message.text().slice(0, 4000),
        phase: currentPhase(),
        at: Date.now(),
      });
  });
  return () => [...pending.values()].map((entry) => ({ ...entry }));
}

/** Best-effort additional evidence must not replace the original assertion failure. */
export async function captureManagedFailure(page, output, request) {
  const result = { errors: [] };
  try {
    result.snapshot = await page.evaluate(sampleManagedStudio, request);
  } catch (error) {
    result.errors.push(`DOM probe: ${String(error)}`);
  }
  try {
    result.frames = page.frames().map((frame) => ({
      url: frame.url(),
      name: frame.name(),
      parentUrl: frame.parentFrame()?.url() ?? null,
    }));
  } catch (error) {
    result.errors.push(`Frame enumeration: ${String(error)}`);
  }
  // Use the already-open page. Do not create another server request or abort a build.
  try {
    await page.screenshot({ path: join(output, "failure.png"), fullPage: true });
    result.screenshot = "failure.png";
  } catch (error) {
    result.errors.push(`Screenshot: ${String(error)}`);
  }
  writeFileSync(join(output, "failure-probe.json"), JSON.stringify(result, null, 2) + "\n");
  return {
    file: "failure-probe.json",
    screenshot: result.screenshot ?? null,
    errors: result.errors,
  };
}
