# Implementation kickoff prompt

You are implementing a complete custom product from two raw source repositories, not writing another plan and not building a standalone bridge.

## Inputs and output

Locate these sibling directories in the provided workspace:

- `archify-main/`: raw Archify source input, read-only.
- `hyperframes-main/`: raw HyperFrames source input, read-only.
- `archframe-unified-implementation-v2.0.0/`: authoritative ticket/contract package.
- Create `archframe-studio/` as a NEW output repo. Never overwrite either input or the ticket package. Do not assume the inputs contain `.git` or preserve upstream history.

Folder names may differ; discover them from sentinels and report resolved paths. Do not guess a remote repo, token or publication target. Raw ZIP inputs can be preflighted with the supplied read-only checker and then safely extracted under the import policy.

## Goal

Create one buildable, deeply unified monorepo and application using HyperFrames' workspace/Studio/SDK/player/producer plus owned refactored Archify diagram engine/viewer packages, a shared project model, and native diagram-scene compilation. Preserve all five diagram families and ordinary native-video projects. One project, command/history boundary, asset registry, playhead and export workflow. Clear internal module boundaries are required; separate runtime apps, a screenshot workflow or an external bridge are not the end state.

## Read before writing

Read START_HERE.md; docs/PRODUCT_SPEC.md; docs/CONTRACTS.md; docs/DEFINITION_OF_DONE.md; docs/EXECUTION_RULES.md; docs/CAPABILITY_MATRIX.md; backlog/tickets.json; backlog/dependency-layers.json; provenance/SOURCE_SNAPSHOTS.json; provenance/SOURCE_MAP.md; and the actual bodies of the next tickets. Run the provided planning/source validation tools when Python is available. Inspect the exact source and adjacent tests yourself. The source inventory establishes file identity, not runtime behavior.

## Execute

Implement AFM-001 through AFM-134 in dependency order, prioritizing the G0/G1 actual vertical-slice gates. All tickets start planned. Create real code, tests, docs, configuration and provenance in the new repo. Establish upstream baselines before modifying interfaces; distinguish inherited failures from regressions. Keep input folders unchanged. Use one workspace/lockfile and owned packages, not global upstream installs or automatic downloads of latest main.

Reuse existing layout, validators, viewer features, Studio editing, runtime and producer. Do not rebuild equivalent engines or convert/rename the entire stack as a cosmetic first step. Refactor CLI IO out of the diagram library. Use standard composition/paused seekable timeline contracts. Keep authored source facts separate from presentation intent, and preserve stable identities across revisions and repeated scene instances.

Implement shared atomic revisions and history; disable competing SDK auto-history AND autonomous persistence when the project owns them. Enforce managed ownership on every UI/API/file/tool entry. Handle overrides and external edits with explicit conflicts. Never infer connectivity from view order or animate a fabricated relationship. Keep local media/narration/captions and rendering usable without upstream service accounts.

## Evidence and release

Each ticket requires a commit, actual acceptance/failure tests, exact commands/exit statuses, and a per-ticket receipt following DEFINITION_OF_DONE. Do not mark implemented work verified until tests pass. Do not mark a rendered file present unless it exists and is inspected. Mocked provider/agent responses are contract tests, never live/model evidence. Run actual videos early and again for all five families, native-only projects and mixed scenes. Verify undo/regenerate/reopen, privacy, offline behavior, platform support and clean-source packaging.

Maintain a progress ledger with completed/verified/blocked/untouched tickets, last commit, source/build hashes and artifact paths. Continue on dependency-ready work when a prerequisite is unavailable; record exact blockers without hiding them or weakening acceptance. Do not stop the project's scope at the first successful export. If a session ends, leave a precise resumable checkpoint rather than claiming completion.

The final deliverable is the complete new repository, source archive, lockfile, tests, migrations, docs, notices, provenance, reviewed demos/assets policy, real video evidence, manifest and SHA-256 checksums. It builds without the two raw source folders. Do not create/push a remote repo, publish packages, deploy infrastructure or spend on providers without explicit authorization/configuration. Report local/remote status truthfully. Final completion is allowed only when AFM-134/G5 passes.
