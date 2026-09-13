# Managed Studio: distinguish a lost click from failed navigation

Based on `d2c397c3a25435c1337f5b433c076f087d4294dc`. This is a harness/readiness
correction and diagnostic contribution, not an accepted pilot or a diagnosis of
that commit's recorded failing browser run. Production application code is unchanged.

## Why the former assertion was insufficient

The old harness waits for any timeline clip to exist, clicks the chosen element,
and waits for inspector options. TimelinePane can render its clips while its
loading overlay still intercepts the pointer. A clip in the DOM is not evidence
that a physical double-click was delivered. When the click is lost, waiting longer
for inspector options cannot make it happen retroactively.

This mechanism was reproduced with a real Chromium physical mouse event against
controlled offline HTML. It has NOT been established as the cause of the recorded
V-Flow failure. Its cause remains open until the real pinned application is run.

## Readiness and evidence changes

The harness requires exactly one clip matching the emitted scoped `hostKey`.
Before one physical double-click, it verifies that the loaded iframe's actual URL,
requested URL, project/build/revision stamps and master scene match the expected
pin. It also checks clip visibility, ancestor disabled/inert state and the actual
center-point hit target. The same point is used for the physical click. It never
removes an overlay, invokes an application callback, dispatches a synthetic DOM
click, substitutes a sidebar action, or retries a possibly delivered double-click.

A capture-only observer records whether a trusted `dblclick` reached that clip.
That is delivery evidence, NOT proof the product handler accepted navigation.
The next phases separately require the pinned scene frame, then a populated and
enabled inspector target list. Queries traverse open shadow roots because the
retained player puts its iframe there. No network request is made by DOM probes.

The existing 60-second bound is retained on each readiness stage; it has not been
increased. Splitting stages can increase the aggregate upper bound across a run.
No fixed sleep or polling HTTP request is added to the drill-down readiness checks.

On failure, `result.json` identifies passed/failed/not-run phases; `failure-probe.json`
records frame URLs and stamps, visible alerts, inspector state, target geometry,
the actual hit element, click events and loading overlays. `failure.png` is captured
before closing the browser when possible. Failed captures are recorded separately
and never replace the original assertion error. Requests retain query strings and
attempt identities, response status, failures and pending state. Source hashes and
Node/browser versions identify the harness actually executed. The caller must also
record the application tree/image and its clean/dirty state.

## Interpreting the next failed phase

- `native-clip-interactable`: inspect the loading overlay, hit target and pinned
  root/URL. A permanently loading product remains a failure; the harness does not
  clear the guard.
- `native-double-click-delivered`: a physical event was not delivered to the
  intended clip. Inspect `events` and `target.hit`.
- `native-scene-loaded`: delivery was observed but the selected frame did not
  load. Inspect navigation errors, requested URLs, pending requests and both frame
  identities. Do not conclude the inspector is at fault yet.
- `native-authoring-targets`: the pinned frame loaded but the inspector did not
  become ready. Inspect authoring-document requests and visible inspector errors.
- Later phases keep the original real UI edits, revision/content checks,
  undo/redo, reopen and deliberate legacy-refusal assertions. They are not marked
  passed by a successful navigation diagnostic.

The main application default route, source writer, journal, identity guards,
preview implementation, middleware order, checksummed runtime, schemas and old
blocked receipts are unchanged. Even if this harness passes, it still does not
perform an export or establish full editing parity or visual acceptance.

## Run

From the repository root, in the pinned environment:

```sh
node --test packages/studio/tests/e2e/managed-studio-diagnostics.test.mjs
node packages/studio/tests/e2e/managed-studio.mjs \
  --base-url http://127.0.0.1:5190 \
  --headless-shell "$PRODUCER_HEADLESS_SHELL_PATH" \
  --allow-create-test-project \
  --output /workspace/out/managed-studio-diagnostic-UNIQUE
```

The browser process must share the server's loopback namespace. Run the second
command inside the already-serving Studio container, not a different container
whose localhost points somewhere else. Use a new output directory. Exactly one
new fixture is authorized by the flag; the fixture is retained and its ID recorded.
Do not delete existing projects, restart unrelated services or run parallel harnesses.
Keep the old failed logs. Do not mark tickets complete from the diagnostic helper
unit tests or the controlled HTML reproduction.
