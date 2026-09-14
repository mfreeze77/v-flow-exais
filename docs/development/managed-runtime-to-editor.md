# Runtime-to-editor recovery and delivery verification — AFM-059/060/072/078

Base: `2c8a89b044b75c85951ef10a46df2ae702f2a3f8`.
This is an implementation contribution, not an accepted pilot or a replacement ticket receipt.

## The connected failure

An iframe `load` establishes the document, not the eventual playback adapter. NLE's existing
load hydration makes a final attempt after five seconds. The custom player's later `ready`
event previously cleared its own loading presentation but did not notify NLE. A runtime that
becomes usable after that final attempt, without an accepted runtime postMessage, could therefore
be ready while NLE remains empty. Increasing a timeout is not a durable lifecycle connection.

In a controlled Chromium run using the actual Player, custom element, NLE, hydration and store
source, a GSAP-backed adapter was deliberately made available at 6.2 seconds. Before: no clips.
After: the existing hydration path discovers two real DOM clips. The normal actual-core-runtime
control works on both versions. This establishes the defect and recovery mechanism; it does NOT
establish that the same timing explains the user's recorded pinned-server failure.

## Runtime readiness is separate from document load

- Player exposes an optional runtime-ready callback carrying the emitting iframe. Its listener
  reads the latest committed observer, without reconnecting the custom element.
- NLEPreview forwards only its current frame. Ordinary native previews receive no new observer.
- NLEProvider revalidates the original project/build/revision stamps and selected-view URL before
  invoking the retained adapter/manifest/DOM hydration. It does not synthesize clips or mark runtime
  readiness from HTTP success. A warm frame that is already hydrated is not paused or reseeked.
- The existing bootstrap filter, strict identity checks and timeline-disabled condition remain.
- `data-vflow-timeline-phase` distinguishes load-pending, runtime-pending, timeline-pending and
  ready for diagnosis. It reports state; it is not a new permission or a bypass of a loading gate.

## One hydration waiter per live document

`watchPreviewHydration` subscribes before inspection and releases its listener and final-attempt
timer on success, replacement, cancellation, failure, timeout and unmount. The hook captures both
iframe and Document identity. A later document that reuses an iframe must not be initialized by
an old attempt. The existing five-second bound is unchanged; a later ready event establishes a
new explicit rendezvous rather than silently extending the old attempt.

The callback refs returned by useTimelineSyncCallbacks are now actual stable React refs, updated
in a layout effect. Previously they were freshly allocated objects despite the comment promising
stable refs to the once-installed message handler.

## Scene ownership stays aligned

The native source map includes the emitted scoped hostKey, without granting diagram-generated
content a native writer. External source navigation and build reconciliation now announce the
actual selected scene/document to the parent inspector, with deduplication of parent echoes.

A new build that removes the selected appearance can still contain a different appearance of the
same source document. Reapplying the parent's old source path would silently select that other
appearance, undoing the identity-aware state machine's safe return to master. An echoed old path
is now distinguished from a subsequent explicit navigation request. The inspector is told that
master is selected. Unknown or ambiguous external paths leave the current view intact and restore
its actual owning path; no positional or filename retargeting is introduced.

## Full local delivery runner

`packages/studio/tests/e2e/managed-studio-delivery.mjs` runs the existing managed-studio.mjs journey
unchanged, requires every expected phase to pass, and only then opens the SAME fixture in the
existing project workspace and physically clicks Export MP4. It waits for that batch's UI download
link, validates the batch/build revision, verifies the downloaded content hash, probes H.264,
dimensions, exact decoded frame count and rational FPS, and extracts native/diagram frames for
human inspection. It verifies export did not mutate the captured authoring snapshot.

A failed/partial/malformed journey stops before export; later work remains not-run. The driver's
aggregate subprocess watchdog does not enlarge the existing journey's per-stage timeout. The
export stage has its own five-minute bound. On POSIX, timed-out children and descendants are
signalled only through the new process group owned by this invocation. No global process or Docker
cleanup is performed. Supported execution is the existing pinned Linux container.

A successful automated run is labelled `automated-checks-passed-visual-review-required`, NEVER
accepted. `visualReview` stays `not-performed`. Screenshots and extracted images must be inspected,
and the actual video must be reviewed. The fixture and evidence are retained. No existing project
is modified or removed, no API-only authoring fallback exists, and no external service is used.
Runner file hashes and the captured project are recorded. The local manager must additionally
record the actual served application commit/tree/image and freeze it for the whole run; a harness
file hash alone does not attest the server's source or runtime.

## Verification scope

The contribution includes before/after controlled-browser records, 45 executed Node checks and
34 additional React/Vitest cases requiring the pinned workspace. Controlled runs use Chromium 144,
React 18.2, a small replacement Zustand substrate, source-built runtime/player modules and explicit
fixture transport. They are not the full StudioApp, real server, SDK inspector, journal or export.
No bundled diagnostic assets are product dependencies, and no font binaries are distributed.

The full native Studio/server suites, package typechecks, lint, format, fixed-worker baseline
comparison, the actual editing journey and export/visual review remain required. Existing blocked
receipts remain historical evidence. Do not record the pilot as accepted from helper tests.
