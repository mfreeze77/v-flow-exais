# Progress ledger

Required by `docs/EXECUTION_RULES.md`: at every checkpoint record implemented,
verified, blocked and untouched ticket IDs, the current commit, evidence paths
and the next dependency-ready work. Resume from this file and the per-ticket
receipts — never by guessing that a generated file proves success.

**Last updated:** 2026-09-11
**Review baseline:** `37e2d0a28f282c40340723f65b156aab72f754ea`
**Gate status:** G0 in progress (AFM-129 gates it)

## Active full-product continuation

The owner requires all 28 non-security product areas in
`docs/designs/product-completion.md`. No area is fully accepted yet.
The latest AFM-037/093/095 checkpoint adds immutable local before/head Git
capture, exact tree deltas, source-bound authored diagram comparison and shared
API/CLI ingress. Sixteen focused tests, 42 inherited delta/evidence tests with
pinned Chrome, two package typechecks and changed-file lint pass. A real
repository comparison records 38 changed paths. This is a comparison-service
checkpoint; Studio review, PR intake and AFM-092 editable change films remain
open. Exact code SHA and receipts are in `evidence/tickets/AFM-037/result.json`;
resume from `docs/designs/revision-review.md`.

The latest AFM-093 checkpoint replaces the fixed manifest templates with
source-supported story drafts, audience/purpose/count/duration controls,
script/storyboard revision and mixed native/diagram scenes. Captured call-site
columns keep long excerpts framed around the referenced call. This does not
complete repository understanding, useful films, PR deltas or a gate. Current
code SHA, commands, probes and visual checks are in `evidence/tickets/AFM-093/result.json`
and `docs/designs/story-planning.md`.

The latest AFM-098 checkpoint adds typed source-backed proposals, real Studio
claim/diff review, revision/rejection/atomic acceptance and CLI ingress. Seven
focused tests, three package typechecks, changed-file lint and the actual browser
review/accept/undo journey pass. The broad branch audit fails; configured model
calls, complete agent tooling and useful story/video acceptance remain open.
See `evidence/tickets/AFM-098/result.json` and `docs/designs/proposal-review.md`.

Continue with richer product/workflow stories and review-to-editable-scene
integration, using the actual AFM-092/093/098 ticket bodies. Local before/head
capture now exists; do not restart it. The recorded font-resolution
stall now has bounded requests and a forwarded cancellation signal; complete
font pinning and crash/cancellation coverage remain before durable or offline
production acceptance. Keep the entire owner checklist active. Source
understanding limits are in `docs/designs/source-understanding.md`.

## Counts

| State | Count | Tickets |
|---|---|---|
| verified | 7 | AFM-001–006, AFM-009 |
| in_progress | 31 | AFM-017–022, AFM-024–029, AFM-037, AFM-039–043, AFM-049, AFM-051, AFM-054–055, AFM-057, AFM-059, AFM-063, AFM-083, AFM-093, AFM-095–096, AFM-098–099 |
| implemented_unverified | 0 | — |
| blocked | 1 | AFM-011 — package isolation and integration now pass; clean workspace build prerequisite remains |
| untouched | 95 | Remaining tickets, including AFM-007–008, AFM-010, AFM-012–016 and the gates |

This checkpoint delivers a working source-to-three-videos path, not closure of
every contributing ticket. Per-ticket receipts distinguish the verified slice
from unmet criteria. Code commit and artifact hashes are in
`evidence/tickets/AFM-099/result.json`.

## Verified

| Ticket | Commit | Evidence | Result |
|---|---|---|---|
| AFM-001 | `a3feeb1` | `evidence/tickets/AFM-001/` | 31 tests; both sources reproduce the pinned baseline tree digests |
| AFM-002 | `25d8bf8` | `evidence/tickets/AFM-002/` | 22 tests; 7786 entries, 0 ledger problems, 0 duplicate targets |
| AFM-003 | `8bae64a` | `evidence/tickets/AFM-003/` | 21 tests; 7784 files imported and hash-verified, 0 conflicts |
| AFM-004 | `42a02c1` | `evidence/tickets/AFM-004/` | 16 tests; 4/4 license records, 0 font binaries in evidence, 4 explained modifications |
| AFM-005 | `4bc67ba` | `evidence/tickets/AFM-005/` | 13 tests; automation audit 0 blocked, hooks neutralized |
| AFM-006 | `4bc67ba` | `evidence/tickets/AFM-006/` | 21 tests; all 7786 target paths cross-platform safe, no raw-checkout reach-back |
| AFM-009 | `dab0132` | `evidence/tickets/AFM-009/` | 18 packages register, 0 workspace problems, nested npm root removed |

Historical acceptance run at `dab0132`: **153 passing across 8 files**.
That count does not prove the inherited package suites, actual archive installs,
Studio integration, or video rendering. Current work must retain its own logs.

## Partially implemented / blocked

AFM-011 retains credit for the asset-resolution fix and standalone renderer
process checks. Its original receipt overstated verification: one acceptance
criterion was explicitly partial; archive contents and raw-source isolation
were inferred from paths/manifests. The original receipt is preserved as
`evidence/tickets/AFM-011/initial-result.json`.

Actual archive packing, installation into an isolated directory, denied source
checkout reads, all-five-family rendering, and directed relationship checks now
pass. Studio and CLI share the callable engine and real producer path. AFM-010's
installation contract and the full clean workspace build remain unverified.

## Render path status

All five diagram families compile to standalone HTML from the owned monorepo:

| Family | Bytes | Example |
|---|---|---|
| architecture | 821,349 | brand-aware-delivery |
| workflow | 817,897 | agent-tool-call |
| sequence | 812,111 | async-job-roundtrip |
| dataflow | 819,318 | event-stream |
| lifecycle | 808,440 | agent-run |

**The source-to-video path now runs.** Public GitHub URL and local project
intake produce three reviewed, editable projects. The shared path is
`compileDiagram -> diagram-motion -> retained composition compiler/player ->
retained producer -> ffprobe-verified MP4`. Three 19-second 1280×720 H.264 files
were rendered, downloaded through Studio, and visually inspected. A real edit,
reopen, continuous authored-edge trace, repeated/reverse pixel equality, and
three matched-motion seams were checked in the browser.

Current focused checks: 32 acceptance tests, 30 project-model tests, 10 motion
tests; typechecks pass for project-model, diagram-motion, studio-server, Studio,
and CLI. Real batch recovery also passed with two valid projects and an invalid
diagram, cancellation, resume, unchanged-output reuse, and a 30000/1001-fps MP4.
Logs and scripts are under AFM-099 and `tools/vflow/`.

These are silent source-inventory drafts based primarily on package manifests.
Configured-agent proposal review, narration/captions, richer code/PR analysis,
full editor capability parity, distribution/build closure, and the complete
gate matrices remain open. No gate is newly marked passed.

## Resolved: the render-path blocker

**AFM-011-F1 — fixed in `dab0132`.**

The imported CLI originally looked for a template under the engine, although
the import placed it in the viewer. The repair introduced package-owned asset
resolution and package manifests. That removed the standalone renderer's
ENOENT failure. The AFM-027 callable artifact boundary now returns owned SVG,
geometry, authored relationships, styles and diagnostics without CLI/process IO.
Complete per-family contract/golden coverage remains separate acceptance work.

## Repository state

- 18 workspace packages under `packages/`, including `diagram-engine`,
  `diagram-viewer`, `project-model` and `diagram-motion`, all with manifests.
  The project model now implements validation, revision-aware commands,
  immutable filesystem commits and undo/redo. Diagram motion emits scoped,
  seekable compositions using integer frames and rational FPS.
- `bun install` resolves 1555 packages with no reference to `_sources/`, no
  global CLI, no submodule and no nested `.git`.
- No `.github/workflows/`: all 18 upstream workflow entries are quarantined to
  `docs/upstream/`. `core.hooksPath` redirected to a repo-owned `.githooks/`.
- Root manifest renamed to `v-flow-exais` with the upstream repository URL and
  the inherited `prepare` lifecycle hook removed.
- Original import fidelity: 7784/7784 tracked, 28 executable bits, 1 symlink
  (mode 120000). Current code intentionally diverges from that frozen baseline.

## Source baseline

| Repository | Entries | Tree digest | Status |
|---|---|---|---|
| archify | 483 | `f2b43966…d21bcb` | matches baseline |
| hyperframes | 7303 | `78d8162e…9c7a2c9` | matches baseline |

Archive comment revision candidates remain **unverified** — the inputs carry no
upstream Git history.

## Findings carried forward

| ID | Status | Summary |
|---|---|---|
| AFM-001-F1 | resolved | Windows extraction destroyed the one upstream symlink. All extraction now happens in-container. |
| AFM-001-F2 | resolved | In-place build conflicts with the "no root inside destination" rule; resolved by a declared, recorded quarantine exemption. |
| AFM-003-F1 | resolved | Unanchored `.gitignore` rules silently dropped 48 imported files, including 16 Studio source files. Rules anchored; reconciliation now asserted. |
| AFM-003-F2 | resolved | Windows git dropped all 28 executable bits and refused the symlink. Both now driven from the ledger, not the filesystem. |
| AFM-003-F3 | resolved | `lefthook`'s own postinstall installed git hooks despite the `prepare` script being removed. `core.hooksPath` redirected. |
| AFM-011-F1 | resolved | The engine/viewer split broke Archify asset resolution; every renderer failed with ENOENT. Replaced with `src/resolveAssets.mjs`, resolving from `import.meta.url` and package exports. |
| AFM-011-F2 | resolved | Inherited bin was named `archify`, colliding with a globally installed upstream CLI. Renamed `archframe-diagram`. |
| AFM-009-F1 | resolved | `packages/diagram-engine/package-lock.json` was a second package-manager root inside a bun workspace member. Relocated to `docs/upstream/archify/`. |

## Standing constraints

- All extraction and execution happens inside the container.
- `_sources/` is a declared quarantine: read-only, gitignored, never imported.
- Docker hygiene: always `--rm`; prune only dangling images and build cache;
  never `docker volume prune` (other projects' data lives on this host).
- Local implementation; remote push requires owner authorization. No package
  publication, infrastructure creation or paid provider calls are implied.

## Scope

`docs/designs/scope-local-single-user.md`: local single-user product. The owner
has now requested repository/project intake through multiple finished videos.
AFM-130 / G1 remains an early milestone; source-grounded proposals, batch jobs
and minimum local protections are on the delivery path. Full product scope is
retained. The complete specification and tickets ship in `docs/implementation/`.

## Remote

`origin` = https://github.com/mfreeze77/v-flow-exais (public). Branch `main`.
Push authorized by the owner; see the note in the session transcript about
vendored font binaries becoming public on first push.
The initial 15 commits were pushed, and remote `main` was verified at the review
baseline SHA above.

All work is on `main`; there are no other branches. PRs #1, #2 and #3 are merged
and their branches deleted. `feat/repo-to-video` is gone too — it held nothing
`main` did not already have, and a stale pointer to it here was worse than no
pointer at all.

## Next dependency-ready work

AFM-012 is complete: `evidence/tickets/AFM-012/result.json`, checkpoint PASS at
commit `ee23fca`, whose tree `5bb5071` is the exact source that was tested.

AFM-010, the remaining AFM-011 criteria, and AFM-013–016 close E02. AFM-007 and
AFM-008 close E01 and are required for gate AFM-129 / G0, but are off the render
critical path.

The owner-requested end-to-end slice has exercised E03–E07 and source/batch
integration ahead of complete epic closure. Continue from
`docs/designs/repo-to-video-handoff.md`; read the actual next ticket first.

## Checks the lint chain had been skipping

Recording an exit code for every check (`tools/evidence/run-checkpoint.sh`)
showed that `bun run lint` had never completed. Its first link,
`check:docs-snippet-motion`, crashed with ENOENT because it still pointed at
`docs/snippets/` — the upstream repository's layout. The import placed those
files at `docs/upstream/hyperframes/snippets/` under their
`retain-reference-docs` disposition. Because the chain is `&&`-joined, the ten
checks after it never ran, and reporting oxlint's result alone made the
repository look clean. Three real defects were hiding behind that:

- `packages/gcp-cloud-run/Dockerfile` was missing `project-model`,
  `diagram-viewer`, `diagram-engine` and `diagram-motion` — manifests, sources
  and builds. The merge added them as producer dependencies; the Dockerfile was
  never updated, so a Cloud Run image would have failed to build.
- `scripts/check-docs-snippet-motion.test.mjs` read the same stale path, so the
  scripts lane was failing too.
- `scripts/publish-workflow.test.mjs` asserted on
  `.github/workflows/publish.yml`, which does not exist here: every upstream
  workflow was imported under `quarantine-automation`, and this repository runs
  no CI. Removed — `audit:automation` already asserts the quarantine holds
  (`blocked: 0`). The quarantined copy remains at
  `docs/upstream/hyperframes/workflows/publish.yml`.

The lesson is the ticket's own: a check that records no exit status is not
evidence, and a summary assembled from console text will agree with whatever it
was given.

## A file that silently left the repository

`packages/producer/tests/render-symlinked-assets/src/shared` is the repository's
only symlink. Git on Windows cannot stat it, warns `Function not implemented`,
and `git add -A` then stages it as deleted. It was added correctly as a
mode-120000 blob in AFM-003 (`8bae64a`) and removed by AFM-005 (`f07f4c7`), a
commit about neutralising git hooks. Nothing in the diff review showed it,
because for this path a clean `git status` is exactly what the deletion looks
like — and status checks here were piping that warning through
`grep -v 'Function not implemented'`, filtering out the only evidence.

Restored as a symlink, with `--skip-worktree` set so `git add -A` leaves it
alone. That flag is local to an index, so a fresh clone on Windows needs it
again; `bun run check:import-reconciliation` is the durable guard and fails if
any of the 7,786 imported files stops being tracked without a declared reason.

Two other ledger files are absent by intent and are now declared in
`scripts/check-import-reconciliation.mjs` rather than merely missing:
`packages/diagram-engine/package-lock.json` (an npm lockfile in a Bun
workspace) and `scripts/publish-workflow.test.mjs` (asserted on CI this
repository deliberately does not have), plus the nine
`packages/core/src/studio-api/` forwarding shims removed in AFM-012.
