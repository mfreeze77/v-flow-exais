/** Startup experiments are observations, never an authoring/export acceptance receipt. */
export const STARTUP_PROFILES = Object.freeze({
  full: Object.freeze({
    network: true,
    console: true,
    summary: true,
    checkpoints: true,
    polling: "raf",
  }),
  "without-network-diagnostics": Object.freeze({
    network: false,
    console: true,
    summary: true,
    checkpoints: true,
    polling: "raf",
  }),
  "without-console-diagnostics": Object.freeze({
    network: true,
    console: false,
    summary: true,
    checkpoints: true,
    polling: "raf",
  }),
  "without-response-summary": Object.freeze({
    network: true,
    console: true,
    summary: false,
    checkpoints: true,
    polling: "raf",
  }),
  "without-checkpoint-writes": Object.freeze({
    network: true,
    console: true,
    summary: true,
    checkpoints: false,
    polling: "raf",
  }),
  "interval-polling": Object.freeze({
    network: true,
    console: true,
    summary: true,
    checkpoints: true,
    polling: 100,
  }),
});
export const STARTUP_TIMEOUT_MS = 60_000;
export const STARTUP_VIEWPORT = Object.freeze({ width: 1600, height: 1000 });
export const STARTUP_BROWSER_ARGS = Object.freeze(["--no-sandbox", "--disable-dev-shm-usage"]);
export const STARTUP_SOURCE_BLOBS = Object.freeze({
  "managed-studio.mjs": "38aa6c974d27bf26654b1f0e33eabff61f2da8d2",
  "managed-studio-probe.mjs": "45f7ccde2d4cc8eca30e1de16259cda2621faf7a",
  "managed-studio-diagnostics.mjs": "40cef2fb84757bff0dc4e9c93a294e31274f6eb7",
});

export function loopbackOrigin(input) {
  const url = new URL(input);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("Use a bare HTTP loopback origin; no credentials, path, query or hash.");
  return url;
}
export function managedProjectId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value))
    throw new Error("An explicit managed test-project ID is required.");
  return value;
}
export function requestPermitted(rawUrl, origin) {
  const url = new URL(rawUrl);
  return ["about:", "data:", "blob:"].includes(url.protocol) || url.origin === origin.origin;
}
export function profileChanges(name) {
  if (!Object.hasOwn(STARTUP_PROFILES, name)) throw new Error(`Unknown startup profile: ${name}`);
  const profile = STARTUP_PROFILES[name];
  return Object.keys(profile).filter((key) => profile[key] !== STARTUP_PROFILES.full[key]);
}
export function makeTrialPlan(names = Object.keys(STARTUP_PROFILES)) {
  if (
    !Array.isArray(names) ||
    names.length < 2 ||
    names[0] !== "full" ||
    new Set(names).size !== names.length
  )
    throw new Error("Profiles must start with full and contain unique baseline/variant names.");
  for (const name of names) profileChanges(name);
  // Same fixture and settings; reverse the order for the second observation.
  // This reduces simple order/cache confounding, but is not a statistical proof of causation.
  return [...names, ...names.toReversed()].map((profile, index) => ({
    index,
    profile,
    round: index < names.length ? 1 : 2,
    directory: `${String(index + 1).padStart(2, "0")}-${profile}`,
  }));
}
export function readCli(argv) {
  const allowed = new Set([
    "--base-url",
    "--project-id",
    "--from-result",
    "--headless-shell",
    "--output",
    "--profiles",
  ]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index],
      value = argv[index + 1];
    if (!allowed.has(key) || Object.hasOwn(values, key) || !value || value.startsWith("--"))
      throw new Error(`Unknown, duplicate or incomplete option: ${key}`);
    values[key] = value;
  }
  const baseUrl = loopbackOrigin(values["--base-url"] ?? "http://127.0.0.1:5190").origin;
  if (Boolean(values["--project-id"]) === Boolean(values["--from-result"]))
    throw new Error("Supply exactly one --project-id or --from-result for the retained fixture.");
  const projectId = values["--project-id"] ? managedProjectId(values["--project-id"]) : null;
  const shell = values["--headless-shell"];
  if (!shell || !values["--output"])
    throw new Error("--headless-shell and a NEW --output are required.");
  const profiles = values["--profiles"]?.split(",") ?? Object.keys(STARTUP_PROFILES);
  return {
    baseUrl,
    projectId,
    fromResult: values["--from-result"] ?? null,
    shell,
    output: values["--output"],
    plan: makeTrialPlan(profiles),
  };
}

/** Classify only matched, complete observations. Never choose an arm to bypass acceptance. */
export function summarizeStartupComparison(plan, rows) {
  if (rows.length !== plan.length) throw new Error("Not all planned startup trials have a result.");
  const hash = /^[0-9a-f]{64}$/;
  for (let i = 0; i < plan.length; i++) {
    const row = rows[i],
      expected = plan[i];
    if (
      !row ||
      row.profile !== expected.profile ||
      row.index !== expected.index ||
      row.round !== expected.round ||
      !["ready", "mount-failed", "invalid"].includes(row.outcome) ||
      !row.browserVersion ||
      !hash.test(row.beforeHash ?? "") ||
      !hash.test(row.afterHash ?? "") ||
      !hash.test(row.expected?.revisionHash ?? "") ||
      !hash.test(row.afterRevisionHash ?? "")
    )
      throw new Error(`Incomplete or mismatched trial at index ${i}.`);
  }
  const same = (field) => rows.every((r) => r[field] === rows[0][field]);
  const comparable =
    same("projectId") &&
    same("browserVersion") &&
    same("localTree") &&
    same("beforeHash") &&
    same("inputHash") &&
    rows.every(
      (r) =>
        r.beforeHash === r.afterHash &&
        r.outcome !== "invalid" &&
        r.expected.revisionHash === rows[0].expected.revisionHash &&
        r.afterRevisionHash === r.expected.revisionHash,
    );
  const baseline = rows.filter((r) => r.profile === "full");
  const consistentFailure =
    comparable && baseline.length === 2 && baseline.every((r) => r.outcome === "mount-failed");
  const associations = [];
  if (consistentFailure)
    for (const name of new Set(plan.map((p) => p.profile))) {
      if (name === "full") continue;
      const observations = rows.filter((r) => r.profile === name);
      if (observations.length === 2 && observations.every((r) => r.outcome === "ready"))
        associations.push({
          profile: name,
          changedDimension: profileChanges(name)[0],
          finding:
            "Startup differs repeatably under this change; inspect traces before assigning root cause.",
        });
    }
  const interpretation = !comparable
    ? "invalid-comparison"
    : baseline.every((r) => r.outcome === "ready")
      ? "baseline-failure-not-reproduced"
      : !consistentFailure
        ? "baseline-is-variable"
        : associations.length
          ? "repeatable-startup-difference"
          : "failure-not-isolated-to-these-dimensions";
  return {
    schemaVersion: 1,
    status: "diagnostic-only",
    interpretation,
    comparable,
    projectId: rows[0].projectId,
    associations,
    observations: rows.map(({ index, round, profile, outcome, elapsedMs, snapshot, error }) => ({
      index,
      round,
      profile,
      outcome,
      elapsedMs,
      error: error ?? null,
      timelinePhase: snapshot?.timelinePhase ?? null,
      frameworkElements: snapshot?.timelineRoots?.map((r) => r.elementCount) ?? [],
      renderedClips: snapshot?.renderedClipCount ?? null,
    })),
    acceptance: { editing: "not-run", export: "not-run", visualReview: "not-performed" },
    limitations: [
      "Reuses one existing fixture read-only; it does not repeat import timing for each arm.",
      "Local source hashes do not independently attest the code loaded by the serving process.",
      "Browser cache/profile are fresh each trial; server/module/build caches can remain warm.",
      "Observer-sensitive behavior can expose a product race; a working arm does not exonerate the product.",
      "Two observations per arm identify a reproducible association, not a universal causal proof.",
    ],
  };
}

/** CLI exit describes diagnostic validity, never product acceptance. */
export function startupComparisonExitCode(interpretation) {
  if (interpretation === "invalid-comparison") return 1;
  if (interpretation === "repeatable-startup-difference") return 0;
  if (
    [
      "baseline-failure-not-reproduced",
      "baseline-is-variable",
      "failure-not-isolated-to-these-dimensions",
    ].includes(interpretation)
  )
    return 2;
  throw new Error(`Unknown comparison outcome: ${interpretation}`);
}
