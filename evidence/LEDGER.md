# Progress ledger

Required by `docs/EXECUTION_RULES.md`: at every checkpoint record implemented,
verified, blocked and untouched ticket IDs, the current commit, evidence paths
and the next dependency-ready work. Resume from this file and the per-ticket
receipts — never by guessing that a generated file proves success.

**Last updated:** 2026-09-10
**Head commit:** `a3feeb1` — AFM-001: preflight the two raw source inputs
**Gate status:** G0 in progress (AFM-129 gates it)

## Counts

| State | Count | Tickets |
|---|---|---|
| verified | 1 | AFM-001 |
| implemented_unverified | 0 | — |
| in_progress | 0 | — |
| blocked | 0 | — |
| untouched | 133 | AFM-002 … AFM-134 |

## Verified

| Ticket | Commit | Evidence | Result |
|---|---|---|---|
| AFM-001 | `a3feeb1` | `evidence/tickets/AFM-001/` | 31/31 acceptance tests pass; both sources reproduce the pinned baseline tree digests |

## Foundation established alongside AFM-001

Not tickets of their own, but prerequisites the first ticket could not run without:

- Bun workspace root (`package.json`, `bun.lock`) — will be reconciled with the
  upstream lockfile when packages land in E01/E02.
- Development container (`.devcontainer/Dockerfile`, `compose.yaml`): bun 1.3.13,
  ffmpeg 5.1.9, chromium 152, pinned chrome-headless-shell 148.0.7778.167, 1909
  fonts. Mirrors the upstream render environment.
- `.gitattributes` LF normalisation, so Windows authoring cannot shift hashes in
  a Linux build.
- `AGENTS.md` / `CLAUDE.md` and the `docs/designs/` decision record convention.

## Source baseline

Both inputs match the planning package's pinned snapshots exactly; the 240
ticket source anchors are therefore trustworthy as written.

| Repository | Entries | Tree digest | Status |
|---|---|---|---|
| archify | 483 | `f2b43966…d21bcb` | matches baseline |
| hyperframes | 7303 | `78d8162e…9c7a2c9` | matches baseline |

Archive comment revision candidates are recorded in
`provenance/upstream-lock.json` and remain **unverified** — the inputs carry no
upstream Git history.

## Standing constraints

- All extraction and execution happens inside the container. Extracting on
  Windows destroys the one upstream symlink (see finding AFM-001-F1).
- `_sources/` is a declared quarantine, read-only and gitignored. Nothing
  imports from it; the repo must build with it absent.
- Local only: no remote push, no package publication, no paid provider calls.

## Next dependency-ready work

Per `backlog/dependency-layers.json`, layers are strictly sequential at the
start: AFM-001 → AFM-002 → {AFM-003, 004, 005, 007, 008}.

**Next:** AFM-002.
