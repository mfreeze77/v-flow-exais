# Execution rules for a coding agent or small team

## Work from files, not this chat's claims

Read START_HERE, PRODUCT_SPEC, CONTRACTS, DEFINITION_OF_DONE, the capability matrix and the next actual ticket body. Check the source inventory before editing. All 134 tickets are authoritative requirements within the defined local scope, not suggested ideas. P1 means sequencing/priority, not optional. `required-interface` means preserve and integrate the interface while live external checks are conditional; it does not permit replacing a requested local workflow with a paid service.

## Do not overwrite the raw repositories

The input sources are immutable. Build the new product in an empty sibling directory. Inventory/diff freshly downloaded input before using this plan; stop automatic import on drift. Review changed interfaces, rebaseline and update ticket mappings rather than blindly swapping versions. Apply no source scripts/hooks during inspection. Keep source import provenance even when upstream Git history is unavailable.

## Dependency execution and milestones

Follow backlog/dependency-layers.json and the individual dependency lists. Numeric order is readable but the dependency DAG is authoritative. Prioritize closing G0, then G1's early vertical slice, then G2/G3 and release gates; do not wait to attempt the first real video until all UI features are written. All required local tickets still remain in final scope. Gate AFM-134 depends on every preceding ticket so omissions cannot slip through a short critical path.

Do not declare the whole product complete at G1. At every checkpoint record implemented, verified, blocked and untouched ticket IDs, current commit, evidence paths and next dependency-ready work. A session ending is not a waiver of remaining requirements. Resume from receipts rather than recreating prior work or guessing that a generated file proves success.

## Shared-file ownership and parallel work

Dependency-ready tickets may still conflict on files. Use one writer at a time for root package.json/bun.lock; project-model schemas and command contracts; SDK session/history/persistence; Studio App/EditorShell/provider state; Studio API adapter/types; and core composition/runtime contracts. Parallel agents may implement separate diagram adapters or tests only against an agreed versioned interface. Use isolated branches/worktrees in the new repo, not overlapping edits in the source folders. Integrate with a deliberate owner and run boundary/regression tests after merge.

## Prefer reuse, not broad rewrites

Refactor Archify's existing layout/schema/evidence code; keep HyperFrames' Studio/SDK/runtime/producer. Do not introduce a new full video engine, a second generic diagram library, another package manager, a separate unrelated backend, or wholesale TypeScript/package renames without a reviewed need. Existing interfaces must be verified from the pinned files. New interface names in this package are proposals that require code and tests.

## Quality and safety

Every write flows through source ownership and atomic revisions. Every animation uses actual relationships. Every render pins inputs and produces a real inspected artifact. Secrets, source folders and upstream publishing identities are not shortcuts. Never substitute mocked model/encoder outputs as end-to-end evidence. Paid calls, cloud provisioning, remote repository creation and publication need explicit authorization and valid configuration. If prerequisites are unavailable, finish dependency-independent work and report an exact blocker without marking dependent gates passed.
