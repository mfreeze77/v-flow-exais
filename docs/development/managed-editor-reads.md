# Managed editor reads — AFM-059/060 integration slice

Base: `06b775989e5c7d8b0d01b988dda9738b85b2cbcd`.

This patch implements the read side of the retained Studio's managed-project
integration. It does **not** switch `ProjectRouter` to mount the native Studio
for managed projects. That switch still needs a project-owned history adapter,
capability/ownership dispatch for generated content, and a real browser journey.

## Existing code reused

The server reads through `readCommittedProject` and its verified immutable index.
Asset responses use `readProjectAssetBytes`. The browser keeps the existing
file-manager lifecycle and SDK candidate/session publication logic. Authoring
path validation uses `isAuthoringPath`, not a second diagram-family/path policy.
No new dependency, workspace package, lockfile, persistence queue, schema version,
mutation endpoint, or renderer is introduced.

## Read contract

- `GET /api/vflow/projects/:id/editor` returns the current committed revision and
  index digest, authored document IDs/paths/kinds and content hashes, their scene
  appearances, owned asset metadata, journal capabilities and unresolved-conflict
  count. It neither builds a preview nor creates a revision.
- `GET /api/vflow/projects/:id/editor/documents/:documentId?revision=R&revisionHash=H`
  requires the captured revision identity. A mismatch returns `409 editor/stale-read`.
  The caller must keep its draft and explicitly reload, not silently retry against
  newer content. IDs identify authoring documents; generated scene filenames and
  revision-store paths are not editable documents.
- `GET /api/vflow/projects/:id/editor/assets/:assetId?revision=R&revisionHash=H`
  serves verified project-owned WAV/PNG bytes with the correct MIME type and
  `nosniff`. It does not accept a host filesystem path. Responses are full-file
  responses; range requests and broader media formats are not added here.

A read that captures revision R just before another process publishes R+1 may
still return the verified R document. It must never label R+1 bytes as R. A
subsequent read that observes R+1 rejects an R token rather than guessing.

Native authoring content is returned exactly, including CRLF and whitespace.
Diagram JSON is pretty-printed for the editor. `contentHash` hashes the returned
representation, not a claim about the original imported JSON whitespace. The
command writer already compares diagram baselines as values. Reads never save a
format-normalized document.

The read view carries only a conflict count; the already-landed manifest and
RegenerationConflictPanel remain the authority for the full unresolved records.

## Native reader integration

`useFileTree`, `useFileManager` (read, optional read, file selection, click-to-source),
and `useSdkSession` consume `createProjectReadClient`. Project ownership is captured
in a reader scoped to a project. The router's existing classification storage is
moved to a small module and re-exported for compatibility, avoiding an App import
from every read adapter.

For native projects, requests retain their existing URL/response contract,
including hidden editor sidecars. For managed projects, the reader uses only the
new gateway, verifies the document identity, captured revision, and SHA-256 of
returned content, and never falls back to native filesystem routes on an error.
Optional absence is absence from a successfully validated authoring view; server
failures, malformed data, stale reads and missing formerly-listed documents are
not turned into empty successful documents.

The old file manager's mutation endpoints, native IndexedDB history, preview
loading and generated-DOM editing policy are **not** made managed-safe by this
read bridge. Keep the router unchanged until the next slice delegates all of those
native mutation/history paths to project commands. This is not a second editor
and is not an AFM-059/060/078 completion claim.

## Verification

The delivery includes isolated projection/transport tests and real store/Hono
acceptance tests. Execute the latter in the pinned workspace. Standalone tests
with injected fetch prove the reader/projection contract, not a browser interaction
or the complete SDK lifecycle. Rebuild project-model after adding its new exports;
Node's conditional export must not read stale dist output.
