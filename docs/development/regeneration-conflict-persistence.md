# Durable regeneration conflicts — bounded AFM-048/073 contribution

Base: `48c25f8402bf9248cd25b3bb27b69c8af556cfec`.

## One authoritative commit

`manifest.regenerationConflicts` is an optional extension of the v1 authoring
manifest. An orphan's scene, document, target, intent field, original ordered
field value, originating command and revision are preserved there. The active
field no longer targets a missing entity, but this separate record survives
reopen and subsequent edits. `rememberOrphanedIntents` only mutates the prepared
snapshot, and schema/context validation precedes the existing atomic commit.

No sidecar write, localStorage store, or new persistence queue is introduced.
The manifest is covered by the existing revision index hash. The same index
stores `command.outcome` before CURRENT is published. Outcomes are stored once
in their original revision rather than duplicated into every later command map.

`executeProjectCommand` fills its optional conflict collector only AFTER a
successful commit, by reading that immutable outcome. Both its fast replay path
and a replay decided by the locked worker return the original event outcome.
Validation failure does not leak tentative conflicts. A lost acknowledgement
after pointer publication is retried without another source mutation.

## Current state versus historical outcome

`get()` exposes current unresolved records, also present in its manifest.
`command()` returns the original command's `conflicts` and snapshot, including
on retry after later edits. Replaying a deletion after a later discard reports
what the deletion did, but does not resurrect the warning in current state.

Old indexes without `command.outcome` remain readable. Their responses explicitly
set `conflictOutcomeRecorded: false`; an empty compatibility array is not proof
that no conflict occurred. This change cannot reconstruct warnings discarded by
older releases. Existing projects without the new manifest field are not rewritten
on read. Older binaries that reject unknown manifest fields may not read projects
containing this extension: do not downgrade a workspace containing new conflicts
without exporting/backing up its authoring state first.

## Explicit resolution through the existing journal

- `discard-regeneration-conflict` removes only the preserved record. It does not
  restore or change the legitimate source deletion. Undo restores the record.
- `restore-regeneration-conflict` requires the original target ID to be currently
  authored in the same document and scene. It restores the saved selection in
  its original relative order without duplicating targets or deleting new ones.
  If surviving targets have been reordered incompatibly, restoration refuses rather
  than moving them silently. Source repair and intent restoration can be batched
  into one atomic command.
- Neither operation guesses a new target, creates an edge, or silently reassigns
  intent. Missing IDs and stale revisions fail without publication.

Only a real source removal can create a quarantine record. A newly requested
focus/relationship that never existed is rejected, rather than being normalized
away into a warning. This intentionally tightens the previous indiscriminate
quarantine step.

`RegenerationConflictPanel` reads persisted manifest state inside the existing
managed ProjectWorkspace. Discard/restore buttons submit those typed commands
through the same commit callback as other edits. It does not maintain an
independent dismissed-warning state. A failed request leaves the record visible.

## Scope and verification

This implements persistence, replay, original-target restore/discard, and a
managed-workspace panel. It does NOT complete AFM-073/078 or the shared native
Studio shell, arbitrary reassignment, identity-ambiguity analysis, detached
scenes, or a visual rebase diff. Restoring an existing ID is an explicit user
choice; determining whether a source reused an ID for a different entity is a
separate identity-conflict requirement, not claimed here.

No rendering/encoding code, dependency versions, existing tests, or canonical
completed ticket receipts are replaced. Tests are additive:

- `regenerationConflicts.test.ts`: pure preservation/order/outcome validation.
- `storage/regenerationConflicts.test.ts`: real filesystem fault hooks/replay.
- `AFM-073.conflicts.test.ts`: actual service and kernel-locked journal journeys.
- `RegenerationConflictPanel.test.ts`: React rendering and emitted-action tests.

The contribution's sandbox can run the pure helper tests and Python Draft-07
schema checks, not this repository's Bun/Docker/React runtime. Pin-package build,
full typechecking, AJV, fault/journal tests, UI tests, lint and formatting remain
required before merge. Do not present the pure helper pass as a passing browser
or application journey.
