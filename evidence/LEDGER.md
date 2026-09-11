# Progress ledger

Required by `docs/EXECUTION_RULES.md`: at every checkpoint record implemented,
verified, blocked and untouched ticket IDs, the current commit, evidence paths
and the next dependency-ready work. Resume from this file and the per-ticket
receipts — never by guessing that a generated file proves success.

**Last updated:** 2026-09-10
**Head commit:** `7d02e0d` — AFM-009, AFM-011 receipts
**Gate status:** G0 in progress (AFM-129 gates it)

## Counts

| State | Count | Tickets |
|---|---|---|
| verified | 8 | AFM-001–006, AFM-009, AFM-011 |
| in_progress | 0 | — |
| implemented_unverified | 0 | — |
| blocked | 0 | — |
| untouched | 126 | AFM-007, AFM-008, AFM-010, AFM-012 … AFM-134 |

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
| AFM-011 | `dab0132` | `evidence/tickets/AFM-011/` | all five diagram families render from an unrelated directory |

Acceptance suite total: **153 passing across 8 files.**

## Render path status

All five diagram families compile to standalone HTML from the owned monorepo:

| Family | Bytes | Example |
|---|---|---|
| architecture | 821,349 | brand-aware-delivery |
| workflow | 817,897 | agent-tool-call |
| sequence | 812,111 | async-job-roundtrip |
| dataflow | 819,318 | event-stream |
| lifecycle | 808,440 | agent-run |

**The animation half is not wired.** Nothing in the diagram path calls the
HyperFrames composition/producer stack yet. That connection —
`compileDiagram -> scene -> motion -> composition -> MP4` — is E04/E05/E06 and
is what AFM-130 / G1 gates.

## Resolved: the render-path blocker

**AFM-011-F1 — fixed in `dab0132`.**

`packages/diagram-engine/renderers/shared/cli.mjs` resolves its template as
`path.resolve(rendererDir, '../..') + '/assets/template.html'`, but the import
ledger routed `archify/assets/template.html` to
`packages/diagram-viewer/assets/template.html`. Running the architecture
renderer fails with ENOENT on
`/workspace/packages/diagram-engine/assets/template.html`.

Compounding it: `packages/diagram-viewer/` contains only two asset files and
**no `package.json`**, so it is not a workspace member at all, and
`packages/diagram-engine` is still registered under the upstream name
`archify` rather than a `@hyperframes/*` scope.

This is AFM-011's work (map Archify runtime code to diagram-engine/viewer) and
it is the first hard blocker on the path to rendering a diagram. The proper
resolution is the C02 boundary: the engine compiles to an artifact (SVG,
styles, semantic objects) and the viewer owns the HTML template, rather than
the engine reading a template at all. Interim path-patching would contradict
AFM-027, so it is fixed as real ticket work.

## Repository state

- 16 workspace packages under `packages/`, including `diagram-engine` and
  `diagram-viewer` from Archify. Still to be created: `project-model`,
  `diagram-motion`, and package manifests for the two diagram packages.
- `bun install` resolves 1555 packages with no reference to `_sources/`, no
  global CLI, no submodule and no nested `.git`.
- No `.github/workflows/`: all 18 upstream workflow entries are quarantined to
  `docs/upstream/`. `core.hooksPath` redirected to a repo-owned `.githooks/`.
- Root manifest renamed to `v-flow-exais` with the upstream repository URL and
  the inherited `prepare` lifecycle hook removed.
- Index fidelity: 7784/7784 tracked, 28 executable bits, 1 symlink (mode 120000).

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
- Local only: no remote push, no package publication, no paid provider calls.

## Scope

`docs/designs/scope-local-single-user.md`: local single-user build. E12
(AFM-103–112) and 77 off-path tickets are deferred; work is ordered by the
54-ticket dependency path to AFM-130 / G1.

## Remote

`origin` = https://github.com/mfreeze77/v-flow-exais (public). Branch `main`.
Push authorized by the owner; see the note in the session transcript about
vendored font binaries becoming public on first push.

## Next dependency-ready work

AFM-010 and AFM-012 (then AFM-013–016) close E02. AFM-007 and AFM-008 close E01
and are required for gate AFM-129 / G0, but are off the render critical path.

After E02, the G1 path runs through E03 (project model, AFM-017+), E04
(callable engine, AFM-027+), E05 (motion, AFM-039+), E06 (render jobs) and
E07 (Studio).
