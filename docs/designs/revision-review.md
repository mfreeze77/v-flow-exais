# Local revision comparison checkpoint

2026-09-11. AFM-037, AFM-093 and AFM-095 remain in progress. This checkpoint
finishes a callable local source/diagram comparison path. It does not finish
AFM-092 change-review films or the full product.

## Implemented behavior

The Studio service and CLI resolve two local Git references to complete commit
IDs before analysis. They read tree entries and blobs without checking out,
running repository scripts or changing working files. Expected commit IDs can
reject stale selections. Missing Git objects are an error; no implicit fetch
occurs. Separate before/head snapshots retain original captured bytes and hashes.

The receipt compares every Git tree entry by path, object ID and mode. It lists
additions, removals, content changes and mode/type changes, including files
excluded from text analysis. Renames are explicit removal/addition pairs; there
is no similarity-based identity claim or line-hunk analysis yet. Each snapshot
reports its capture exclusions and limits. Syntax observations from the two
snapshots are independent; they are not a semantic code-delta model.

`compareDiagrams` validates authored architecture JSON and reuses the owned
architecture comparator. It consumes compiler SVG artifacts directly and emits
before/delta/head views with separate namespaces. Removed objects and routes
come from the before artifact. Parallel relationships match authored IDs;
missing or duplicate IDs fail validation. Labels, topology and geometry changes
retain their classifications. Both original diagram strings, source revision
links, compiler artifacts, delta receipt and content hashes are persisted.

Diagrams can come from captured paths or be supplied separately as JSON strings.
The latter supports diagrams citing commits that already exist: a file cannot
meaningfully embed the hash of the same commit that introduces its own bytes.
Declared source revisions and available origin identities must match the pinned
review. Captured citation paths, hashes and line ranges are checked. Missing or
uncaptured citations remain explicitly unavailable and prevent a revision-pinned
evidence claim. Changed captured bytes are rejected. Source verification does
not establish deployed architecture or causal improvements.

These read-only comparisons create review records, not project edits. Existing
project command/history ownership is unchanged.

## CLI and API

Run inside the workspace image, with the repository already mounted at `/input`:

```sh
bun run vflow compare-revisions --source /input --before HEAD~1 --head HEAD
bun run vflow get-review --id review-<uuid>
bun run vflow compare-diagrams --id review-<uuid> --file /input/compare.json
```

The comparison file names the returned `reviewHash` (the source review's
`contentHash`) and exactly one input per side: `beforePath` or `beforeJson`, and
`headPath` or `headJson`. Paths select already captured files; JSON strings are
preserved as separately authored diagrams. CLI failures return nonzero status.

Studio API routes are `POST /api/vflow/reviews`, `GET /api/vflow/reviews/:id`,
and `POST /api/vflow/reviews/:id/diagrams`. Creation accepts `rootId`, `path`,
`before`, `head`, and optional `expectedBefore`/`expectedHead` complete commit IDs.
The API returns 409 for stale selections and 400 for invalid comparison input.
Git reads run asynchronously with finite process timeouts. Static analysis is
still bounded synchronous work; this does not close AFM-051/052 background jobs.

## Evidence and remaining work

Sixteen focused tests pass, including real Git commits, API requests, actual
CLI subprocesses, byte preservation, parallel IDs, stale/missing evidence and
the existing source/story regressions. Both inherited delta/evidence suites
pass all 42 tests with pinned Chrome, including their browser check. The owned
baseline test's imported fixture path was repaired; baseline bytes were unchanged.
Studio-server and CLI typechecks and changed-file lint pass.

An actual comparison of this repository's `bf826a8` and `8756a98` commits found
38 changed paths. It captured 2,855 before files and 2,857 head files; 5,354 and
5,370 paths respectively were outside text capture. The durable source review
is in `/var/lib/vflow/revision-review-checkpoint` on the project-data volume.
Its exact commits, counts and tree hashes are recorded in
`evidence/tickets/AFM-037/revision-review/repository-proof.json`.

Open: Studio revision selection and factual review UI; authorized PR intake;
line-hunk and stable semantic source deltas; proposal approval and atomic scene
creation; editable before/change/after films; per-change timing/callouts and
regeneration; complete source/delta/build export bundles; human usefulness
review. No new MP4, video acceptance or full-product gate is claimed here.
Required predecessor tickets and the previously failing broad quality gate
remain open. See the affected ticket receipts for commands and retained failures.
