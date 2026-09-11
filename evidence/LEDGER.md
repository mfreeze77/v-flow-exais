# Progress ledger

Required by `docs/EXECUTION_RULES.md`: at every checkpoint record implemented,
verified, blocked and untouched ticket IDs, the current commit, evidence paths
and the next dependency-ready work. Resume from this file and the per-ticket
receipts — never by guessing that a generated file proves success.

**Last updated:** 2026-09-10
**Head commit:** `2f1997c` — AFM-003: acceptance tests, receipt and docker hygiene rule
**Gate status:** G0 in progress (AFM-129 gates it)

## Counts

| State | Count | Tickets |
|---|---|---|
| verified | 3 | AFM-001, AFM-002, AFM-003 |
| in_progress | 1 | AFM-005 (hooks neutralized; audit tool and docs outstanding) |
| implemented_unverified | 0 | — |
| blocked | 0 | — |
| untouched | 130 | AFM-004, AFM-006 … AFM-134 |

## Verified

| Ticket | Commit | Evidence | Result |
|---|---|---|---|
| AFM-001 | `a3feeb1` | `evidence/tickets/AFM-001/` | 31 tests; both sources reproduce the pinned baseline tree digests |
| AFM-002 | `25d8bf8` | `evidence/tickets/AFM-002/` | 22 tests; 7786 entries, 0 ledger problems, 0 duplicate targets |
| AFM-003 | `8bae64a` | `evidence/tickets/AFM-003/` | 21 tests; 7784 files imported and hash-verified, 0 conflicts |

Acceptance suite total: **74 passing across 3 files.**

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

## Next dependency-ready work

Layer 3 (all depend on AFM-002): **AFM-004**, AFM-005 (finish), AFM-007,
AFM-008. Then AFM-006 and AFM-009.
