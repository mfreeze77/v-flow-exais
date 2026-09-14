/** Diagnostic support for the ORIGINAL managed-studio.mjs entry point.
 * Default editing/export acceptance is unchanged. Diagnostic mode stops before
 * the first authoring action and never produces a passed journey receipt.
 */
import { createHash, randomUUID } from "node:crypto";
import { sampleManagedStartup, startupIdentityMatches } from "./managed-startup-probe.mjs";

const managedId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function parseFreshnessMode(argv) {
  const names = [
    "--startup-only",
    "--reuse-project",
    "--startup-editor-preflight",
    "--startup-run-id",
  ];
  for (const name of names)
    if (argv.filter((value) => value === name).length > 1)
      throw new Error(`Duplicate diagnostic option: ${name}`);
  const enabled = argv.includes("--startup-only");
  const index = argv.indexOf("--reuse-project");
  const reuseProjectId = index < 0 ? null : argv[index + 1];
  const editorPreflight = argv.includes("--startup-editor-preflight");
  const runIndex = argv.indexOf("--startup-run-id");
  const requestedRunId = runIndex < 0 ? null : argv[runIndex + 1];
  if (
    runIndex >= 0 &&
    (typeof requestedRunId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestedRunId))
  )
    throw new Error("--startup-run-id must be a UUID.");
  if (index >= 0 && !managedId(reuseProjectId))
    throw new Error("--reuse-project requires an exact managed test-project ID.");
  if (!enabled && (index >= 0 || editorPreflight || runIndex >= 0))
    throw new Error("Fixture reuse/preflight is diagnostic-only; --startup-only is required.");
  if (reuseProjectId && argv.includes("--allow-create-test-project"))
    throw new Error("Fixture reuse must not also authorize a fresh import.");
  return Object.freeze({
    enabled,
    reuseProjectId,
    editorPreflight,
    runId: enabled ? (requestedRunId ?? randomUUID()) : null,
  });
}

/** Stable content comparison only; no editor view/read/build call is hidden here. */
export function snapshotDigest(snapshot) {
  const normalize = (value) => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!record(value)) return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  };
  return createHash("sha256")
    .update(JSON.stringify(normalize(snapshot)))
    .digest("hex");
}

export function beginFreshnessEvidence(evidence, mode, ledger) {
  if (!mode.enabled) return;
  if (mode.reuseProjectId) ledger.phases[0].name = "fixture-reused";
  evidence.diagnosticScope = "Original harness startup prefix only; editing/export are not run.";
  evidence.startup = {
    schemaVersion: 1,
    runId: mode.runId,
    valid: false,
    fixtureKind: mode.reuseProjectId ? "reused" : "fresh",
    requestedProjectId: mode.reuseProjectId,
    preflight: mode.editorPreflight ? "editor-view" : "none",
    beforeHash: null,
    afterHash: null,
    mount: "not-run",
    acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
  };
}

export function captureFreshnessBaseline(evidence, initial, projectId) {
  if (
    !record(initial?.snapshot) ||
    initial.snapshot.manifest?.id !== projectId ||
    initial.snapshot.manifest.revision !== 0
  )
    throw new Error("Startup comparison requires an unchanged revision-zero test fixture.");
  evidence.startup.beforeHash = snapshotDigest(initial.snapshot);
  evidence.startup.projectId = projectId;
  evidence.startup.revision = 0;
}

/** The one optional pre-navigation request. It does not prepare or fetch a preview. */
export async function readFreshnessEditorView(page, projectId) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/vflow/projects/${id}/editor`);
    if (!response.ok) throw new Error(`Editor view failed (${response.status}).`);
    const value = await response.json();
    if (
      value.projectId !== id ||
      value.revision !== 0 ||
      !/^[0-9a-f]{64}$/.test(value.revisionHash ?? "")
    )
      throw new Error("Startup editor view is malformed or authoring changed.");
    return { projectId: id, revision: value.revision, revisionHash: value.revisionHash };
  }, projectId);
}

export async function primeFreshnessEditor(page, evidence, mode) {
  if (!mode.enabled || !mode.editorPreflight) return;
  evidence.startup.preflightStartedAt = Date.now();
  evidence.startup.preflightView = await readFreshnessEditorView(page, evidence.projectId);
  evidence.startup.preflightFinishedAt = Date.now();
}

/** Called only AFTER the unchanged mount wait succeeds or fails.
 * A late screenshot/probe cannot rewrite the wait's original result.
 */
export async function finishFreshnessEvidence(page, evidence) {
  const item = evidence.startup;
  if (!item) throw new Error("Not a startup observation.");
  evidence.status = "diagnostic-only";
  item.valid = false;
  if (item.finalizationAttempted) throw new Error("Startup finalization cannot be retried.");
  item.finalizationAttempted = true;
  const mount = evidence.phases.find((phase) => phase.name === "managed-route-mounted");
  item.mount =
    mount?.status === "passed" ? "passed" : mount?.status === "failed" ? "failed" : "not-run";
  item.elapsedMs = mount?.finishedAt == null ? null : mount.finishedAt - mount.startedAt;
  item.observedAt = Date.now();
  // First post-wait action is an observation, not a warming HTTP request.
  item.observation = await page.evaluate(sampleManagedStartup);
  if (!item.beforeHash || !evidence.projectId || !["passed", "failed"].includes(item.mount))
    throw new Error("Startup failed before the original mount assertion could be observed.");
  const after = await page.evaluate(async (id) => {
    const response = await fetch(`/api/vflow/projects/${id}`);
    if (!response.ok) throw new Error(`Post-startup project read failed (${response.status}).`);
    return response.json();
  }, evidence.projectId);
  if (
    after?.snapshot?.manifest?.id !== evidence.projectId ||
    after.snapshot.manifest.revision !== 0
  )
    throw new Error("Startup observation changed or lost its revision-zero fixture.");
  item.afterHash = snapshotDigest(after.snapshot);
  item.afterView = await readFreshnessEditorView(page, evidence.projectId);
  if (
    item.beforeHash !== item.afterHash ||
    (item.preflightView && item.preflightView.revisionHash !== item.afterView.revisionHash)
  )
    throw new Error("The startup fixture changed during the experiment.");
  item.observedReady = startupIdentityMatches(item.observation, {
    ...item.afterView,
    origin: new URL(item.observation.url).origin,
  });
  if (evidence.pageErrors.length || evidence.blockedExternal.length)
    throw new Error("Page errors or an external request invalidate the startup observation.");
  item.valid = true;
  // Every valid child observation is inconclusive by itself, whether mount passed or failed.
  return 2;
}
