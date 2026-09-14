# Managed Studio startup isolation — AFM-059

Base: `e19b419b789ae44b51a27d0250cbe0593bbdd938`.

This is a diagnostic contribution, not a product repair or an accepted editing journey.
The existing `managed-studio.mjs`, its assertions, the delivery driver, and all production
code are unchanged. Successful startup in a separate script demonstrates that startup is
possible; it does not prove that an observer, rather than an observer-sensitive product
race, causes the recorded failure.

## Controlled comparison

Run `managed-studio-startup-compare.mjs` against one explicitly selected EXISTING retained
fixture. It does not import, create, edit, undo, delete, or export a project. Opening the real
application can prepare its usual preview/build cache and issue requests that its existing
middleware refuses. The authoring snapshot and revision-index hash must remain unchanged.

Each trial has a fresh Node worker, Chromium process, and browser profile. All use the same
fixture, server, browser binary, 1600x1000 viewport, launch flags, source fingerprints, external
request refusal, navigation selectors and 60-second clip-wait timeout. The default plan runs
six profiles and then repeats them in reverse order:

| Profile                       | Only difference from the instrumented control                                       |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `full`                        | None: network/console diagnostics, response summary, checkpoint writes, RAF polling |
| `without-network-diagnostics` | Do not attach the four passive network recorder listeners                           |
| `without-console-diagnostics` | Do not attach the console observer                                                  |
| `without-response-summary`    | Do not attach the additional response-summary listener                              |
| `without-checkpoint-writes`   | Do not synchronously write phase checkpoints during startup                         |
| `interval-polling`            | Use 100ms clip polling instead of Puppeteer's default RAF polling                   |

Request interception and the loopback guard remain present in EVERY profile. The no-network
profile removes recorders, not request resolution or network policy. Its missing network
observations are null/disabled, never represented as proof of zero pending requests. The guard
also records interception-resolution errors instead of swallowing them.

The current original diagnostics module is imported directly. A narrow facade filters only
the selected observer group. The current three harness/probe/diagnostics Git blob hashes are
checked before execution so an unreviewed source change cannot silently change the experiment.
The guard's failure accounting is stricter than the old harness in every profile; immediate
continue/abort decisions are the same. This is not a byte-identical replay of every old step.

### Important scope difference

This experiment reuses a fixture rather than rerunning the original POST import in each trial.
It adds a pre-navigation read of the editor's revision identity and hashes the project before
and after. Its phase-checkpoint contents also differ from the complete journey's result object.
Those differences are held constant across profiles, but may change timing compared with the
original failure. The `full` profile must reproduce the failure before a variant can identify
an association. A passing control is **inconclusive**, not proof that the original harness was
fixed. The comparison does not replace or skip `managed-studio.mjs`.

Reversing trial order reduces a simple order effect; server/module/build caches and system
load still vary. Two observations per profile establish only the reported observations, not
statistical certainty. Local Git hashes are not an attestation of the serving process.

## Evidence collected after the wait

The original mount predicate is unchanged. New DOM/layout probes run AFTER it finishes or
fails, not in its polling loop. The snapshot distinguishes:

- `data-vflow-timeline-phase`: load/runtime/timeline-pending versus ready;
- the timeline's reported element count versus mounted clips and scoped clip keys;
- timeline/overlay/frame geometry and display state, visibility and focus;
- requested versus loaded frame URL, project/build/revision stamps, and shadow-root frames;
- the frame's own clip-manifest count, registered timeline keys, and adapter presence;
- console messages, page errors, request attempts and unfinished requests where observed.

Runtime inspection reads own data descriptors and never invokes playback methods or getters.
Missing data stays missing. A structurally correct srcdoc cannot impersonate a pinned loopback
preview. Readiness requires a matching actual master frame, not a successful HTTP status.

Screenshots can provoke rendering. Therefore the primary result and snapshot are stored before
the screenshot; an optional `afterScreenshot` snapshot cannot turn a failed wait into a pass.
The runtime map is diagnostic evidence, not synthesized timeline content.

Each worker writes `trial.json`, `process.json`, stdout and stderr. The parent writes the plan,
source hashes, paired observations and outcome to `comparison.json`. A crashed, timed-out,
interrupted, stale-source, changed-project or incomplete trial invalidates the comparison and
leaves later trials explicitly not-run. A worker watchdog bounds the complete worker at 180s;
it does not enlarge the 60s mount predicate. On Linux only the process group created for that
worker is signalled. No server or unrelated browser/Docker process is stopped.

## Interpret results

| Interpretation                             | Meaning                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `repeatable-startup-difference`            | Both control observations failed; both observations of a variant were ready. Inspect the traces before assigning a cause. |
| `baseline-failure-not-reproduced`          | The instrumented control was ready both times; this experiment did not reproduce the old failure.                         |
| `baseline-is-variable`                     | The control differed between observations; do not attribute a causal fix to a variant.                                    |
| `failure-not-isolated-to-these-dimensions` | The selected changes did not consistently separate working from failing startup.                                          |
| `invalid-comparison`                       | Evidence/source/project/process invariants were not met.                                                                  |

Exit 0 means a completed diagnostic with a repeatable difference, NOT passing product
acceptance. Exit 2 is inconclusive; exit 1 is invalid/incomplete execution. Every result says
`status: diagnostic-only`, with editing/export not-run and visual review not-performed.
It cannot satisfy the existing delivery driver's complete-journey contract. Never copy a
successful variant's settings into the acceptance harness merely to manufacture a pass.

## Execute

Use the same pinned serving container/loopback namespace and a source-frozen checkout.
No extra packages are required beyond the existing `puppeteer-core` dependency.

```sh
node --test packages/studio/tests/e2e/managed-startup-*.node.mjs

node packages/studio/tests/e2e/managed-studio-startup-compare.mjs \
  --base-url http://127.0.0.1:5190 \
  --from-result /workspace/out/PREVIOUS-FAILED-RUN/result.json \
  --headless-shell "$PRODUCER_HEADLESS_SHELL_PATH" \
  --output /workspace/out/managed-startup-isolation-UNIQUE
```

`--project-id <recorded-fixture-id>` may replace `--from-result`; provide exactly one.
Use a NEW output directory. To perform one bounded comparison first, add
`--profiles full,without-network-diagnostics` (four trials, forward/reverse).
Do not infer a fixture ID from a filename, overwrite evidence, or delete retained projects.

The new test names end in `.node.mjs`, not `.test.mjs`: they register with node:test and
must not be collected as Vitest suites. Run repository lint/format/script checks on the new
files in the pinned environment. The contribution did not run those checks remotely.
Record the actual serving commit/tree/image independently, and keep prior failed receipts.
After a mechanism is established and corrected, rerun the ORIGINAL full editing journey and
then its existing editing-to-export driver. AFM-059/060/072/078 remain incomplete here.
