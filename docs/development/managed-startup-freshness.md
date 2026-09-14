# Managed Studio: original-sequence freshness comparison

Base reviewed: `bbbb222601d89d958605598d3228a8665e05032f`.
This is a diagnostic contribution, not an application repair or accepted editor journey.

## What the prior negative result does and does not establish

Both fully instrumented controls and all variants passed in the reused-fixture experiment.
That means its failing baseline was not reproduced. It does not universally rule out
instrumentation interactions in the original fresh sequence, nor distinguish a test defect
from a product race exposed by scheduling. Its recorded measurements remain useful.

There were at least TWO constant differences from the original harness: fixture reuse and
an extra editor-view GET before navigation. `managed-startup-trial.mjs` does `readProject()`,
then `readView()`, then navigates. The original `managed-studio.mjs` imports, reads its
project snapshot, and navigates without that editor-view GET. A fast reused/preflight run
is not an exact failing control. An extra read can change both work and elapsed time.

## One executable rather than another copied startup routine

`managed-studio.mjs` accepts diagnostic-only options:

- `--startup-only`: stop after its existing mount wait and record an observation.
- `--reuse-project ID`: acquire that exact revision-zero fixture without importing;
  permitted ONLY with `--startup-only` and without the create permission.
- `--startup-editor-preflight`: add exactly one editor-view GET after the normal project
  read and before navigation. No preview preparation or preview GET is added.
- `--startup-run-id UUID`: bind the observation to its driver's invocation.

With no diagnostic options, the original editing workflow remains selected and the new
mode module is not loaded. All post-mount edit/history/reopen/refusal assertions are
unchanged. Default authorization still creates one new fixture. Diagnostic reuse cannot
enter those editing steps: later phases stay `not-run` and status is `diagnostic-only`.

All arms use the original executable's browser launch, viewport, observers, network policy,
checkpoint writes, import payload, project read, hash navigation and 60-second mount
predicate. No sleep, focus forcing, disabled request interception, fabricated clips or
fallback navigation is introduced. The control makes NO editor-view/preview request before
navigation. Its first added browser operation is the post-wait observation.

Code extraction into an async function and diagnostic bookkeeping preserve the browser-call
sequence, not a promise of identical scheduling. Isolated tests compare the actual original
and revised executable through the mount wait using a test transport; this is not a real
browser equivalence or an explanation of the application's failure.

## Eight observations, four authorized new fixtures

Run from the serving Studio container's loopback namespace, with frozen committed source:

```sh
node packages/studio/tests/e2e/managed-studio-freshness-compare.mjs \
  --base-url http://127.0.0.1:5190 \
  --headless-shell "$PRODUCER_HEADLESS_SHELL_PATH" \
  --allow-create-test-projects 4 \
  --output /workspace/out/managed-freshness-UNIQUE
```

The explicit count authorizes FOUR new retained fixtures, not four edits to user projects.
No project is deleted. Each fresh trial is immediately followed by reuse of that same ID
in a fresh Node process/browser. Round one uses no-preflight then editor-preflight;
round two reverses that ordering. Reuse necessarily follows its fresh observation, so age,
prior startup, post-observation reads, and server/build-cache history remain bundled.
The comparator does not clear application data or caches to pretend those are independent.

Before each worker and after it, the source commit/tree, declared harness dependencies and
browser binary hash must match. Tracked changes or undeclared new dependency files are
refused; make a local source checkpoint first. No Git writes/pushes occur in the runner.
Record the serving process/image/source independently: local Git hashes do not attest it.

The existing process supervisor creates an owned child group and bounds a worker. A killed,
interrupted, missing, malformed or foreign record is invalid, never a mount timeout.
No subsequent worker/import proceeds after invalid evidence. Known fixture IDs and all
prior trials are retained even when the experiment stops.

## Observation versus acceptance

The mount result is the ORIGINAL predicate outcome, not rewritten from a later probe.
`observedReady` separately records whether a post-wait snapshot has the expected ready
phase, visible timeline and matching frame identity. A later screenshot does not rewrite
a failed wait. Post-observation project/editor reads confirm an unchanged snapshot and
revision; they occur after the original wait, not before it in the no-preflight control.

A valid worker exits 2 whether its mount passed or failed: one observation is diagnostic.
The parent validates invocation identity, phase inventory, never-executed later phases,
file hashes, environment, paired project IDs and unchanged content. Comparison exits:

- 0: repeated association after BOTH fresh/no-preflight controls failed.
- 2: baseline not reproduced, variable baseline, or failure not isolated.
- 1: invalid/incomplete comparison.

None means editor or product acceptance. If both fresh controls pass, variant passes are
not credited as a solution. If only reused arms pass, the prior-startup/reuse bundle is
associated; if fresh preflight arms pass, the extra-read/timing bundle is associated.
Neither interpretation alone proves a server caching issue, harness bug, or product fix.

The older instrumentation comparator remains pinned to its original harness source hash.
It will intentionally refuse after this harness modification. Use its recorded source
checkpoint to reproduce the historical experiment; do not replace its guard with a dynamic
"whatever is on disk" hash merely to run it. Historical receipts are untouched.

## Return to the product journey

No alternate diagnostic profile is automatically promoted into editing. Run the ordinary
`managed-studio-delivery.mjs` WITHOUT diagnostic flags when testing the actual product. It
must still traverse real timeline/canvas edits, history, reopen and refusal before export,
then require media measurement and visual inspection. Diagnostics do not close AFM-059,
AFM-060, AFM-072 or AFM-078.
