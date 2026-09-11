# Progress ledger

Required by `docs/EXECUTION_RULES.md`: at every checkpoint record implemented,
verified, blocked and untouched ticket IDs, the current commit, evidence paths
and the next dependency-ready work. Resume from this file and the per-ticket
receipts — never by guessing that a generated file proves success.

**Last updated:** 2026-09-10
**Head commit:** `42a02c1` — AFM-004: license records, asset provenance and the modification ledger
**Gate status:** G0 in progress (AFM-129 gates it)

## Counts

| State | Count | Tickets |
|---|---|---|
| verified | 6 | AFM-001, AFM-002, AFM-003, AFM-004, AFM-005, AFM-006 |
| in_progress | 0 | — |
| implemented_unverified | 0 | — |
| blocked | 0 | — |
| untouched | 128 | AFM-007, AFM-008 … AFM-134 |

## Verified

| Ticket | Commit | Evidence | Result |
|---|---|---|---|
| AFM-001 | `a3feeb1` | `evidence/tickets/AFM-001/` | 31 tests; both sources reproduce the pinned baseline tree digests |
| AFM-002 | `25d8bf8` | `evidence/tickets/AFM-002/` | 22 tests; 7786 entries, 0 ledger problems, 0 duplicate targets |
| AFM-003 | `8bae64a` | `evidence/tickets/AFM-003/` | 21 tests; 7784 files imported and hash-verified, 0 conflicts |
| AFM-004 | `42a02c1` | `evidence/tickets/AFM-004/` | 16 tests; 4/4 license records, 0 font binaries in evidence, 4 explained modifications |
| AFM-005 | `4bc67ba` | `evidence/tickets/AFM-005/` | 13 tests; automation audit 0 blocked, hooks neutralized |
| AFM-006 | `4bc67ba` | `evidence/tickets/AFM-006/` | 21 tests; all 7786 target paths cross-platform safe, no raw-checkout reach-back |

Acceptance suite total: **124 passing across 6 files.**

## Open finding blocking the render path

**AFM-011-F1 — the engine/viewer split breaks Archify's asset resolution.**

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

## Next dependency-ready work

AFM-007, AFM-008 complete E01. Then **E02 (AFM-009–016)**, which is where
AFM-011-F1 is resolved and where a full `bun run build` becomes possible.
