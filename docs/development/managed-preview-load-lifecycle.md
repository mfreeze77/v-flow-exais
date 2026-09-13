# Managed preview load lifecycle — AFM-059

Base: `7a89862bacc91972f23377cbb190427cc16c4669`.
This is a bounded client lifecycle correction, NOT acceptance of the managed Studio pilot.

## Reproduced mechanism

The Studio Player installs its inner iframe load listener before connecting the custom element.
That ordering is necessary to observe a warm requested load and is retained. In Chromium, connecting
an already-created shadow iframe can deliver an initial `about:blank` load before the custom
element's connectedCallback assigns the requested source. The existing wrapper forwards that
bootstrap notification to NLE's strict managed identity guard. An empty, unassigned document has no
project/build/revision stamps, so the exact recorded stale-navigation message is produced even
though the following preview response is correct.

The controlled component reproduction observes both loads. Before this fix, it observes the false
alert followed by acceptance of the correctly stamped document; the alert remains visible. This
identifies a real source of that alert. It does NOT establish that it is the sole cause of the
recorded full-application zero-clip failure. The unchanged phase-accounted harness still must run
against the pinned real server and browser.

## Correction

- `isInitialBlankPreviewLoad` ignores ONLY a document whose URL is exactly `about:blank` while
  the inner iframe has NEITHER a `src` NOR a `srcdoc` attribute. Attribute presence matters:
  an explicitly assigned empty value is not a bootstrap exemption.
- Player checks this before changing loading state, incrementing its load counter, or notifying
  the owner. Once either source attribute exists, empty, inaccessible, error and incorrectly
  stamped documents still go through normal handling. No timer or polling loop is introduced.
- The long-lived listener invokes the latest committed onLoad callback through a layout-updated
  ref. It does not reconnect or reload a player just because a callback changes.
- Load delivery carries the emitting iframe. NLEPreview and NLEProvider do not let an outgoing
  frame initialize a newer frame through their shared ref. No ref is reassigned to accommodate
  an old notification.
- Existing no-argument NLE callback consumers remain compatible. Production Player delivery
  always includes the actual frame. Existing native callbacks can ignore the additional argument.

The project/build/revision comparisons and selected-view URL check are UNCHANGED. The fix does
not accept a correct response merely because its requested URL looks correct. The runtime-ready
condition and timeline-loading gate also remain in place. Server responses, middleware order,
CSP, journal, model, compiler, generated runtime, schemas, lockfile and the E2E assertions are
untouched.

## Tests

Ten independent predicate cases cover the narrow bootstrap condition and exclusions. Six Player
component cases exercise bootstrap filtering, ordinary/warm load delivery, callback replacement,
assigned-empty documents and unmount cleanup. Seven provider cases preserve identity and URL
rejection and frame provenance. Three NLEPreview cases cover forwarding and retiring players.

The component tests use controlled neighbors/notifications. They do not establish real renderer,
SDK or browser journey behavior. The separate controlled Chromium reproduction runs the actual
Player, NLEPreview and NLEProvider source with React 18.2 and documented doubles for neighboring
services/web-component loading. It is not the pinned application. Refer to the delivery's
VERIFICATION.json for what was actually executed rather than interpreting test existence as a pass.

## Closing check

Run the existing `packages/studio/tests/e2e/managed-studio.mjs` unchanged, on the real pinned
server, with a fresh evidence directory and one authorized new fixture. If it still fails, retain
the phase and probe instead of extending timeouts or weakening identity guards. A passing route
mount is only the first step; selection, edits, undo/redo, reopen, legacy refusal and the separate
export/visual verification remain required.
