# Scope decision: local single-user build, G1-first

**Status:** accepted
**Date:** 2026-09-10
**Decided by:** repository owner
**Affects:** E12 (AFM-103–112) and the 77 tickets off the G1 dependency path

## Decision

This is a local, single-user product driven by the owner through Claude Code
and/or Codex. It is not deployed, not multi-tenant, and not exposed to a
network. The hardening epic is therefore deferred, and work is ordered by the
dependency path to **AFM-130 / G1** — the gate that proves a typed diagram
becomes a real rendered video.

`docs/EXECUTION_RULES.md` requires scope changes to be explicit rather than
silent, which is what this record is for.

## What is deferred

77 of 134 tickets are off the G1 path, including all of **E12 — Local-first
security and resilient execution** (AFM-103–112): trust boundaries, origin and
host validation, project-root and archive-path constraints, untrusted-HTML
network policy, source-privacy leakage checks and remote-deployment protection.

Also deferred until after G1: the other four diagram families (E10), agent and
CLI tooling (E11), performance/platform certification (E13) and release handoff
(E14). These remain in scope for the product; they are sequenced after the
vertical slice, not cancelled.

## What is explicitly NOT deferred

Three things are commonly filed under "safety" but are correctness, and they
stay:

1. **Atomic revisions, commit pointers and undo** (C05, AFM-017–026). This is
   the difference between an interrupted save leaving the last good state and
   leaving a corrupted project. It is on the G1 path regardless.
2. **Ownership and regeneration conflicts** (C07). Without it, regenerating a
   diagram silently destroys presentation edits.
3. **Path containment in the import and asset resolvers.** Already implemented
   and tested in AFM-001–003; removing it would let a malformed archive write
   outside the repository. The cost of keeping it is zero.

## Consequences

- The product is safe to run locally by its owner. It is **not** certified for
  network exposure, a second user, or untrusted diagram input, and nothing in
  this repository should claim otherwise.
- If that changes, E12 is picked up before any deployment. This record is the
  marker for why it was skipped, so a future reader does not mistake the gap
  for an oversight.
- Gate AFM-134 / G5 cannot be claimed complete while E12 is deferred; the gate
  report must state the deferral rather than pass silently.
