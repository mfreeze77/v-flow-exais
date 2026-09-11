# Ticket and product definition of done

## Ticket states

`planned -> in_progress -> implemented_unverified -> verified`, with `blocked` available at any point. This package starts every application ticket as planned. A code change is not verified until the ticket-specific acceptance checks and affected regressions pass. Planning-package validation is not application evidence.

Every completed implementation ticket requires: an actual code/config/docs diff; no stub replacing required behavior; exact source and target paths; a reviewable commit; test commands with exit status and counts; negative/failure tests; updated affected docs/capabilities; and a receipt naming all remaining blockers/skips. Gate tickets require their actual predecessor evidence. Unit tests are not a replacement for actual renders on render tickets. A mocked provider response establishes a contract test only, never live service behavior or model reasoning evidence.

## Proposed implementation receipt

```json
{
  "ticketId": "AFM-001",
  "status": "planned",
  "commit": null,
  "sourceSnapshotHashes": {},
  "commands": [],
  "artifacts": [],
  "acceptanceResults": [],
  "skippedTests": [],
  "blockers": [],
  "review": null
}
```

The implementer fills real data. Never manufacture commit IDs, timing, output hashes or successes. A commands entry records invocation, cwd, environment/runtime identifiers, exit code and log path. An artifact entry records its actual path, SHA-256 and type. Failed evidence is retained through repair.

## Required negative cases

Stale expectedRevision; duplicate IDs; repeated/parallel relationships; missing references; disconnected views; wrong direction; invalid/negative/nonfinite timing; missing media/fonts; orphaned overrides; generated-file edit bypass; interrupted atomic writes; external edit conflicts; disk-full; cancelled/hung browser/encoder; unsafe project/archive paths; untrusted HTML/asset network access; privacy leakage; unavailable optional provider; source snapshot drift.

## Completion rules

No unchecked release-critical acceptance criterion; no required skipped test disguised as green; no imported-but-unused feature marked integrated; no baseline tests deleted merely to pass; no globally installed upstream CLI; no runtime sibling folder/submodule; no screenshot-only semantic workflow; no persistent second editor/save/undo system; no unverified success output path; no permanent standalone-HTML scrape as the engine library contract.

All five diagram types and native-only/mixed video projects pass the complete workflow. Local narration/captions, viewer/share/export capabilities, before/delta/after reviews, migration, recovery and source privacy have real evidence. Conditional live services can remain unverified only when explicitly labeled, source/interfaces are preserved and local scope is unaffected. Final handoff includes buildable source, lockfile, tests, docs, provenance, notices, approved assets/asset instructions, demos, checksums and reviewed support limitations.
