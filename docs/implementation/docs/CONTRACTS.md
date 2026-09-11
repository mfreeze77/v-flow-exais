# Shared contracts and architecture decisions

The interfaces and paths in this document are **proposed implementation contracts**, not claims that the upstream code exports them today. AFM-017–AFM-027 implement and test the contracts before dependent teams rely on them. Revise deliberately through a versioned decision and dependency review, not individual-agent guesswork.

## C01 — Project envelope and document kinds

Use stable project/document IDs, schemaVersion, monotonically advancing committed revision, relative authoring-document references, scenes, asset references, output settings and policy. Reject unknown/unsupported versions or open read-only. Diagram documents keep their own original type/schema. A scene is either a managed diagram instance or a native composition reference. Preserve unknown native metadata by roundtrip where safe; never silently drop it.

Use a discriminated union for architecture/workflow/sequence/dataflow/lifecycle. A normalized render artifact is allowed, but never use a generic graph as the only authoritative source for every kind.

## C02 — Engine boundary

`compileDiagram(request) -> DiagramArtifact` is a proposed library API. Inputs explicitly specify kind, source, theme/preset, compile options, authorized evidence resolver and asset resolver. Output includes SVG, styles, viewBox/bounds, semantic objects, typed relationships, guided views, source evidence and diagnostics. Pure compile logic does not parse process.argv, write files, set global handlers, fetch remote assets, infer repository roots or terminate the process. The CLI/API wrap the same library.

The final video implementation must consume this artifact directly, not permanently render a full standalone HTML viewer and scrape it back apart. Transitional compatibility helpers may remain only with removal gates and tests.

## C03 — Stable identities

Separate project ID, document ID, semantic object/relationship ID, scene-instance ID, track ID and generated render ID. Use persistent explicit relationship IDs, minted during a versioned backup-first migration when absent. Do not use array index or from/to hash alone: parallel edges and repeated sequence messages make those ambiguous. Where a schema cannot carry a needed identity, use an explicit versioned sidecar or reviewed schema extension; tests must preserve original compatibility.

Render IDs are namespaced by scene instance. Rewrite SVG marker/filter/mask/gradient IDs, URL and href references, style selectors/keyframes and accessibility references. Retain semantic IDs in bindings; do not expose one global namespace for every scene.

## C04 — Commands and validation

A command includes commandId, origin, projectId, expectedRevision, typed operation, target and payload. The shared service returns committed revision and diagnostics or an explicit invalid/conflict/idempotency response. Same commandId plus same payload is a retry, not a second edit; same ID plus different payload is a conflict. Validation happens before commit. Supported mutations have declared capabilities. User/agent batches are atomic.

Draft form/JSON text may be invalid, but cannot become committed source or a successful build. Every mutation ingress, including source file endpoints, SDK patches, storyboard edits and agent tools, applies the same semantic ownership policy. Filesystem users retain control of their own files; unexpected manual modifications must be detected and reconciled rather than treated as an impossible event.

## C05 — Atomic state and history

Use immutable revision content and a validated atomic commit pointer with appropriate locking and expectedRevision checks. Define fsync and replacement behavior on supported platforms rather than claiming independent writes are transactional. Reads/renders pin committed revisions. Crash before commit leaves old complete state; successful commit exposes the new complete state. Undo is a new revision restoring prior authoring state.

One project history owns cross-document edits. Integrate SDK patches/inverse patches without loops. **Disabling SDK history is not the same as disabling SDK persistence.** When project storage owns the transaction, disable/delegate both autonomous histories and write queues as appropriate. Keep native editing behavior, not two competing autosave systems.

## C06 — Story and temporal contract

Store startFrame and durationFrames as integers; use fps numerator/denominator. Define half-open active frame ranges, trim semantics, finite duration and output dimensions. Convert to upstream seconds/fps only at emission and test the actual upstream support for fractional rates. Do not round an unsupported rate silently. Child scene time is mapped by the existing runtime; do not manually add its timeline a second time.

Allowed semantic intents initially include frame-group, focus-object(s), reveal-authored-edge, authored-route signal and presentation callout. Resolve IDs and validate topology before generating motion. Paused timelines have explicit initial/final state and must survive out-of-order seeking. Native animations remain governed by their retained capability/runtime contracts. No autonomous Archify viewer recorder or live story loop enters a video composition.

## C07 — Ownership, overrides and regeneration

Compiler-owned: diagram geometry, relationship endpoints/direction, semantic labels and provenance binding metadata. Presentation-owned: scene framing, timing, emphasis, decorative callouts/titles and narration/captions. Native authored HTML is its own source. Persist overrides against semantic identity + scene instance + base revision, not positional DOM paths.

On regeneration reapply compatible intent and classify conflicts: missing target, incompatible property, ambiguous identity, stale base. Preserve the original conflicting intent for repair/discard/reassignment. Never silently erase or retarget. Explicit detach converts one scene to native HTML, preserves a source snapshot and disables future managed propagation only for that instance; undo must restore coherent ownership.

## C08 — Assets and build receipts

Asset records include stable ID, content hash, original source/provenance, rights disposition, measured metadata and local storage reference. Credentials/expiring signed URLs do not belong in projects or compiled artifacts. Build receipts pin source revisions/hashes, engine/compiler versions, asset hashes, dimensions/fps and diagnostics. Render job state pins a specific build; new edits cannot mutate it. Garbage collection respects retained revisions, drafts and active jobs.

Block captures until required images/fonts/media are ready with finite timeouts. Offline frame capture has no unexpected external requests. Output success requires an actual file, format/probe checks and meaningful visual/audio inspection where relevant—not merely a returned path.

## C09 — Shared API and UI

Extend the existing Studio API adapter and server. UI/CLI/tools call the same commands. The browser receives validated artifacts and identifiers rather than unrestricted repository access. Selection carries document/object/scene instance and revision context. Invalid/stale events cannot select an unrelated element. Keep native file/layer editing available and distinguish last-valid preview from current committed/draft revision.

## C10 — Trust and deployment

Local input HTML is active content. Validate project roots and asset downloads, constrain browser/encoder workers, protect local API origin/host access and keep secrets out of frames. Viewer selection/preview messages require source/origin validation. Default loopback; remote single-user deployment requires explicit protected configuration. Multi-tenant SaaS isolation is a separate scope, not an implied property of Docker. Optional hosted capabilities are off unless configured and cannot be claimed live-tested from mocks.

## C11 — Source control, packages and releases

Raw snapshots are read-only. One output repo; no fabricated upstream ancestry, automatic upstream main merges, inherited publishing, or runtime global CLI fallback. Retain internal package scopes initially to reduce churn; a public custom CLI can coexist with them. A scope rename must update code, lockfile, exports, build scripts, skills and distribution tests atomically. No font binaries or embedded font payloads are included in this planning package; release asset policy must separately address rights and availability.
