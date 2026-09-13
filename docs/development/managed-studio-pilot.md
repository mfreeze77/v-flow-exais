# Managed Studio pilot — AFM-059/060/072

Implementation based on `2405c178db83bd1c4a2aff45ef062a032a3ca402`. This is an opt-in pilot, not completion of all native editing capabilities or an accepted browser journey.

## What is mounted

`#project/<id>?editor=studio` now mounts the existing `StudioApp` and `EditorShell` after the server's `studio-access` handshake succeeds. The managed workspace remains the default and provides an entry link. Ordinary native projects retain their existing route, controls and persistence. Failed, aborted, foreign or old-server handshakes do not mount Studio.

The pilot reuses the retained NLE canvas, player, timeline, composition navigation, selection plumbing and project journal. It substitutes a restricted managed inspector and scene list for the unrestricted native PropertyPanel/library. This is one authoring project, not a second native project or copied authoring store.

Enabled: native leaf-text content, hex colour, bounded font size and opacity; semantic diagram object labels; scene/master navigation; timeline selection/drill-down/scrubbing; project-journal undo/redo. The native SDK's capability check still governs each enabled native edit.

Not enabled: timeline timing mutation, keyframes, media placement/upload, registry install, arbitrary attributes/CSS/HTML, raw source autosave, clipboard mutations, structural/lifecycle changes, full PropertyPanel parity, or native export. Use the existing workspace for supported source/timing/conflict/export workflows. The inspector does not promise that all diagram families or complex nested native compositions have been browser-tested.

## One authority

Only the restricted inspector is handed the actual managed journal. Inherited write consumers receive a journal-shaped rejecting capability; unsupported work fails before final file mutation. The retained DOM session is selection-only, and timeline edit callbacks are absent or explicitly blocked. Standalone native history remains disabled for managed sessions by the landed journal integration.

Each inspector save opens the captured authored native document with the real SDK and `history:false`, prepares a candidate, checks `can()`, serializes it, and sends one atomic edit with the exact original authoring baseline. The ephemeral candidate is always disposed. No autonomous SDK persistence, separate history entry or direct file writer is introduced. Diagram labels change the authoritative JSON, preserving object IDs and relationships.

The inspector source, scene instance, display visit, build hash, revision index digest and journal revision must agree before and after asynchronous preparation. A later read is not silently substituted for a draft's baseline. An A → B → A navigation is a different display visit. Unsaved text drafts remain in memory per scene and are retained on failed/stale saves; target changes while dirty are refused. Explicit discard reloads. The browser warns before a full unload while drafts exist. Drafts are NOT crash-persistent; hash navigation to another whole editing surface can unmount them. Save or copy/reconcile drafts before leaving this pilot.

The journal's original-command retry and post-commit refresh semantics are retained. This pilot does not add a durable browser outbox. A subsequent journal/preview refresh failure is not grounds to resend a confirmed edit with a new identity.

## Server enforcement, not only disabled buttons

`installManagedNativeFence` is installed before all legacy `/projects/:id` handlers. For owned managed projects it allows only GET/HEAD authoring-document reads through the verified revision projection. It blocks legacy mutations AND other GET routes, including preview/thumbnail/signature paths that may perform housekeeping. Native filesystem mutation handlers cannot be reached by changing a disabled button or directly issuing their HTTP requests.

Allowed compatibility reads return committed authored text and its content version. Unknown paths, generated HTML, `.vflow` paths and traversal are not served. Native (unmanaged) IDs still use the existing native routes and validation. A corrupt managed revision does not fall through to another native root.

This fence is an integration ownership boundary, not a replacement for authentication or hostile-active-HTML isolation. Existing trusted-local/CSP/API policies remain. Global render-job management is not redesigned. The handshake proves compatible route registration, not an independent security attestation.

## Native identity in derived preview

Standalone native preview preparation passes `ensureHfIds(raw native source)` to the retained subcomposition helper in memory. That is the same source-based identity assignment the SDK uses. Stamping AFTER adding wrappers could produce different identities; stamping a source file on disk would create an unjournaled edit. Neither happens here. Diagram and master output are unchanged; the existing build verification runs before/after preparation.

## Validation and acceptance

Read the delivery verification record for exact executed checks. Isolated tests inject SDK/transport candidates and are NOT real SDK, Hono, React or journal-worker evidence. The repository includes separate actual SDK/store/compiler/Hono acceptance cases, React entry/hook tests, and a local browser harness.

Before accepting this pilot, run the new suites plus native Studio compatibility checks in the pinned container at the fixed baseline worker count. Use `packages/studio/tests/e2e/managed-studio.mjs` on the real server with explicit permission to create one new fixture. It must traverse the actual timeline and click the actual preview, save through the inspector, undo/redo, reopen and reject a legacy request. It fails rather than silently falling back to an API-only edit when a clip or canvas target is missing. It keeps screenshots, request records and the fixture ID.

The harness does not perform a video export or visual sign-off. Inspect its screenshots and export the same committed project through the existing managed workspace; probe and inspect the resulting media. Do not close AFM-059/060/072/078 solely from the isolated checks or the successful presence of this route.
