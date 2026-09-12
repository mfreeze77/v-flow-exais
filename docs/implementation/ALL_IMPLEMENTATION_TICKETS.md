# ArchFrame Studio — complete unified-repository implementation tickets

Version 2.0.0 • 2026-09-10 • All 134 tickets are PLANNED / NOT IMPLEMENTED.

This specification replaces the earlier 24-ticket backlog. It delivers the full local-first product described in `docs/PRODUCT_SPEC.md`, not a standalone bridge.

# E01 — Raw-source intake, ownership and import

# AFM-001 — Preflight the two raw source folders

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** None

## Outcome

Accept downloaded folders or ZIPs without requiring either upstream Git history or installed global tools.

## Source files to inspect and reuse

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json`
- `hyperframes-main/bun.lock`
- `hyperframes-main/packages/cli/package.json`
- `hyperframes-main/packages/producer/package.json`
- `hyperframes-main/packages/sdk-playground/package.json`

## Proposed target files / areas

- `tools/import/preflight.ts`
- `provenance/upstream-lock.json`

## Implementation requirements

1. Resolve supplied roots by package/schema sentinels, not only folder names; reject a root nested inside the destination.
2. Calculate raw-byte SHA-256 inventories, detect symlinks and case collisions, and compare with the supplied baseline.
3. Preserve ZIP comment revision strings as unverified archive metadata; require independent verification before marking an upstream commit verified.

## Acceptance criteria

- [ ] Both unmodified uploads are recognized and hashed without modification.
- [ ] New downloads with changed content produce an explicit drift report and block automatic baseline substitution.
- [ ] No Git clone, npm install, hook execution, or remote write occurs during inspection.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-001.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test renamed folders, spaces, Unicode and Windows-style input paths on supported hosts.
- Test missing sentinel, malformed archive, source/destination overlap and changed lockfile.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-001/result.json`
- `evidence/tickets/AFM-001/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-002 — Create a complete source disposition and import ledger

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-001

## Outcome

Account for every source file before copying or retiring anything.

## Source files to inspect and reuse

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

### H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json`
- `hyperframes-main/bun.lock`
- `hyperframes-main/packages/cli/package.json`
- `hyperframes-main/packages/producer/package.json`
- `hyperframes-main/packages/sdk-playground/package.json`

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

## Proposed target files / areas

- `provenance/import-map.json`
- `tools/import/plan.ts`

## Implementation requirements

1. Assign every archive entry a retained, relocated, quarantined-generated, external-asset-review, or retired-with-reason disposition.
2. Map Archify runtime code to diagram-engine/viewer and HyperFrames packages to their existing package directories; account for root scripts, docs, fixtures and hidden agent configuration.
3. Record old path, target path, original hash, file mode and ticket owner; fail on duplicate destinations.

## Acceptance criteria

- [ ] No source file is silently dropped or overwritten.
- [ ] Runtime symlinks and fixture symlinks are distinguished and never followed outside authorized roots.
- [ ] Generated distributions and nested archify.zip are not treated as additional authoritative source trees.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-002.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test target collisions, unclassified hidden files and executable mode preservation.
- Roundtrip the ledger and assert inventory count equality.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-002/result.json`
- `evidence/tickets/AFM-002/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-003 — Initialize and populate the new owned monorepo

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-002

## Outcome

Produce one self-contained working repository from snapshots while keeping the input folders read-only.

## Source files to inspect and reuse

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

### H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json`
- `hyperframes-main/bun.lock`
- `hyperframes-main/packages/cli/package.json`
- `hyperframes-main/packages/producer/package.json`
- `hyperframes-main/packages/sdk-playground/package.json`

## Proposed target files / areas

- `tools/import/apply.ts`
- `provenance/import-receipt.json`
- `.gitignore`

## Implementation requirements

1. Use HyperFrames as the initial root layout and apply the reviewed Archify relocation ledger into owned workspace packages.
2. Write to an empty staging destination, verify copied hashes, then finalize; refuse an occupied destination unless a reviewed resume receipt matches.
3. Initialize new Git history only in the destination; keep temporary import material non-runtime and remove nested repositories.

## Acceptance criteria

- [ ] The repo builds without sibling raw folders, submodules or globally installed upstream CLIs once workspace reconciliation is complete.
- [ ] Inputs retain their original inventory hashes.
- [ ] The import is resumable and never fabricates upstream Git ancestry or pushes a remote.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-003.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Interrupt a copy and resume against the matching receipt.
- Repeat against a populated unrelated directory and verify a non-destructive failure.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-003/result.json`
- `evidence/tickets/AFM-003/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-004 — Retain licenses, notices and asset-rights provenance

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-002

## Outcome

Preserve original attribution while establishing a deliberate license policy for new code.

## Source files to inspect and reuse

### A-LICENSE — Attribution and third-party asset constraints

- `archify-main/LICENSE`
- `archify-main/THIRD_PARTY_NOTICES.md`
- `archify-main/archify/THIRD_PARTY_NOTICES.md`

### H-LICENSE — License, contribution and security records

- `hyperframes-main/LICENSE`
- `hyperframes-main/CREDITS.md`
- `hyperframes-main/SECURITY.md`
- `hyperframes-main/CONTRIBUTING.md`

### A-THEME — Brand registry, locale and presets

- `archify-main/archify/renderers/shared/brand-marks.mjs`
- `archify-main/archify/renderers/shared/generated-brand-marks.mjs`
- `archify-main/archify/renderers/shared/i18n.mjs`
- `archify-main/archify/test/preset-tryon.test.mjs`
- `archify-main/archify/test/i18n.test.mjs`

## Proposed target files / areas

- `licenses/`
- `THIRD_PARTY_NOTICES.md`
- `provenance/modification-ledger.json`
- `docs/legal/asset-policy.md`

## Implementation requirements

1. Retain MIT and Apache license texts, required copyright/notice records and applicable modification notices at their appropriate paths.
2. Inventory media, logos, generated icon sets, fonts, hosted catalogs and third-party dependencies separately from source-code permissions.
3. Record the new-code license decision and distribution review; do not strip original headers during rebranding.

## Acceptance criteria

- [ ] Every imported code area has traceable upstream license records.
- [ ] Release asset inclusion has a rights decision rather than assuming source licenses cover media.
- [ ] No implementation-ticket package or evidence bundle contains font binaries or embedded font payloads.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-004.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run a notice-preservation check across renamed files.
- Fail a release fixture containing an unreviewed third-party asset or missing license record.

## Risks and recovery

Licensing metadata is a release gate, not a legal clearance claim; unresolved rights remain excluded or blocked.

## Completion evidence

- `evidence/tickets/AFM-004/result.json`
- `evidence/tickets/AFM-004/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-005 — Quarantine inherited publication, hooks and deployment

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-002

## Outcome

Prevent a raw source import from executing or publishing under upstream identities.

## Source files to inspect and reuse

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

### H-SKILL — Coding agent instructions and bundled skills

- `hyperframes-main/AGENTS.md`
- `hyperframes-main/CLAUDE.md`
- `hyperframes-main/skills/pr-to-video/SKILL.md`
- `hyperframes-main/skills-manifest.json`
- `hyperframes-main/scripts/check-skill-mirror.mjs`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `tools/import/audit-automation.ts`
- `docs/upstream/disabled-automation.md`
- `.github/workflows/`

## Implementation requirements

1. Inventory workflow triggers, release registries, cloud buckets, npm scopes, telemetry keys and agent hooks.
2. Disable publishing, documentation deployment, registry upload, auto-update and inherited executable agent hooks before dependency installation.
3. Restore only explicitly reviewed local checks and create destination-owned CI; keep original workflow text in historical documentation when needed.

## Acceptance criteria

- [ ] No token or service account from upstream configuration is assumed available or reused.
- [ ] Push/tag events cannot publish packages or deploy infrastructure without a later approved release configuration.
- [ ] Local installation does not trigger unreviewed repository or agent automation.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-005.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Inspect all workflow triggers and package lifecycle scripts.
- Simulate a release tag with no secrets and confirm no publish/deploy job can run.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-005/result.json`
- `evidence/tickets/AFM-005/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-006 — Preserve source paths, modes and cross-platform filesystem behavior

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-003

## Outcome

Keep source movement safe across Windows, macOS and Linux.

## Source files to inspect and reuse

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

### H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts`
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts`
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts`
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts`

## Proposed target files / areas

- `tools/import/path-policy.ts`
- `.gitattributes`
- `tests/fixtures/import/`

## Implementation requirements

1. Retain executable scripts and normalize only documented source line-ending policy while preserving raw baseline hashes.
2. Detect case-insensitive collisions, reserved Windows names, escaping symlinks and path-length problems before applying moves.
3. Define safe handling for the producer symlink test fixture; skip with an explicit platform reason only when equivalent coverage exists elsewhere.

## Acceptance criteria

- [ ] Imported code never resolves runtime assets from a parent raw checkout.
- [ ] Cross-platform failures name the offending path and safe remediation.
- [ ] No recursive copy follows arbitrary symlink targets or overwrites input folders.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-006.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test CRLF/LF differences without silently accepting semantic drift.
- Run symlink escape, case collision and missing executable-bit fixtures.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-006/result.json`
- `evidence/tickets/AFM-006/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-007 — Record upstream baselines and selective-update procedure

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-001, AFM-002

## Outcome

Maintain two upstream ancestries as provenance without making them separate runtime applications.

## Source files to inspect and reuse

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

## Proposed target files / areas

- `provenance/upstream-lock.json`
- `docs/upstream/maintenance.md`
- `tools/upstream/diff.ts`

## Implementation requirements

1. Record archive hashes, observed package versions and optional independently verified commit references.
2. Compare a proposed upstream snapshot to the recorded baseline using the import map; generate a reviewable changed-file report.
3. Require selective patches, regression results and modification-ledger entries; never auto-merge main or overwrite owned product code.

## Acceptance criteria

- [ ] Unknown commit verification remains null rather than a guessed SHA.
- [ ] SDK playground version differences and package-specific versions are preserved in the baseline.
- [ ] Updating upstream metadata alone cannot replace source or advance completion status.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-007.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test a one-file upstream change and an upstream file moved into an owned package.
- Test a mismatched archive comment and explicit version conflict.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-007/result.json`
- `evidence/tickets/AFM-007/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-008 — Create feature-preservation and baseline-failure registers

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E01 — Raw-source intake, ownership and import  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-002

## Outcome

Make source retention, functionality and actual integration separately measurable.

## Source files to inspect and reuse

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

### A-REACH — Authored graph inspection and sharing

- `archify-main/archify/test/authored-reachability.test.mjs`
- `archify-main/archify/test/route-probe.test.mjs`
- `archify-main/archify/test/relationship-direct-explorer.test.mjs`
- `archify-main/archify/test/relationship-permalink.test.mjs`
- `archify-main/archify/test/reach-share-card.test.mjs`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-EXTERNAL — Existing optional capture, Figma and publishing commands

- `hyperframes-main/packages/cli/src/commands/capture.ts`
- `hyperframes-main/packages/cli/src/commands/figma.ts`
- `hyperframes-main/packages/cli/src/commands/publish.ts`
- `hyperframes-main/packages/cli/src/commands/remove-background.ts`

## Proposed target files / areas

- `docs/quality/capabilities.json`
- `docs/quality/baseline-failures.json`

## Implementation requirements

1. Enumerate all five diagram types, viewer functions, native video/editing/media functions, CLI commands and optional external adapters.
2. Track retained_source, baseline_verified, studio_integrated, render_verified and release_evidence independently.
3. Record existing failures with exact commands, environment and ownership; do not remove tests to manufacture a green baseline.

## Acceptance criteria

- [ ] Every retained capability has ticket owners and a planned acceptance scenario.
- [ ] Unsupported upstream assumptions discovered later become explicit scope amendments, not silent omissions.
- [ ] Optional cloud/provider tests distinguish contract-tested from live-verified.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-008.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Validate that each imported package and each diagram family maps to at least one capability.
- Reject a matrix row marked complete without evidence references.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-008/result.json`
- `evidence/tickets/AFM-008/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E02 — Unified workspace and verified baselines

# AFM-009 — Reconcile workspace manifests and package ownership

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-003, AFM-005

## Outcome

Build both inherited engines and the shared authoring system in one workspace.

## Source files to inspect and reuse

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json`
- `hyperframes-main/bun.lock`
- `hyperframes-main/packages/cli/package.json`
- `hyperframes-main/packages/producer/package.json`
- `hyperframes-main/packages/sdk-playground/package.json`

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

## Proposed target files / areas

- `package.json`
- `packages/diagram-engine/package.json`
- `packages/diagram-viewer/package.json`
- `packages/project-model/package.json`
- `packages/diagram-motion/package.json`

## Implementation requirements

1. Retain existing HyperFrames package directory names and internal scopes initially; introduce private owned packages for project-model, diagram-engine, diagram-viewer and diagram-motion.
2. Translate Archify dependencies and overrides deliberately into the workspace without losing fast-uri or React constraints.
3. Keep new packages private until a separately approved publishing policy exists; remove duplicate active package-manager roots.

## Acceptance criteria

- [ ] One root install resolves every production workspace dependency locally.
- [ ] Duplicate package names, hidden npm fallbacks and accidental published upstream package substitution fail validation.
- [ ] Native HyperFrames packages remain available; no package is removed merely because the diagram slice does not use it.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-009.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run workspace resolution checks with sibling input folders unavailable.
- Verify imports resolve to owned workspace paths, not global or downloaded upstream CLIs.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-009/result.json`
- `evidence/tickets/AFM-009/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-010 — Pin runtime, lockfile and installation prerequisites

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-009

## Outcome

Provide a tested installation contract rather than inheriting Archify's lower Node floor.

## Source files to inspect and reuse

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json`
- `hyperframes-main/bun.lock`
- `hyperframes-main/packages/cli/package.json`
- `hyperframes-main/packages/producer/package.json`
- `hyperframes-main/packages/sdk-playground/package.json`

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

## Proposed target files / areas

- `package.json`
- `bun.lock`
- `tools/doctor/runtime.ts`
- `docs/development/runtime.md`

## Implementation requirements

1. Use the actual HyperFrames Node >=22 requirements and supported CI versions to select exact tested Node and Bun versions.
2. Regenerate one Bun lockfile only after reviewed manifest changes; retain the previous locks as provenance rather than active competing installs.
3. Document browser/FFmpeg/system requirements and install-script approvals; distinguish initial downloads from offline runtime.

## Acceptance criteria

- [ ] A frozen-lockfile install succeeds on the declared test matrix.
- [ ] Missing runtimes or native dependencies are reported before attempting a render.
- [ ] No claim that any Node >=18 installation runs the combined product.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-010.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test clean install and a deliberately stale lockfile.
- Test missing browser/FFmpeg and unsupported runtime diagnostics.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-010/result.json`
- `evidence/tickets/AFM-010/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-011 — Repair build order, exports and asset relocation

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-009, AFM-010

## Outcome

Eliminate assumptions that Archify still lives next to its original scripts and assets.

## Source files to inspect and reuse

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

## Proposed target files / areas

- `package.json`
- `tools/build/workspace.ts`
- `packages/diagram-engine/src/resolveAssets.mjs`

## Implementation requirements

1. Create build ordering from inspected package dependencies, preserving reviewed upstream cycle allowances instead of inventing a blanket graph rewrite.
2. Remap schema, template, icon, example and test asset lookup to package-owned paths or explicit resolvers.
3. Update package exports and packed-file lists; prohibit cwd-dependent runtime discovery and imports of source outside the new repo.

## Acceptance criteria

- [ ] Build and packed-package smoke tests work from a clean directory.
- [ ] CLI, Studio and producer resolve the same owned diagram engine.
- [ ] Files required only at runtime are present in the package artifact.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-011.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Invoke the CLI from a directory with spaces unrelated to the repo.
- Run with original raw folders renamed and assert asset resolution still succeeds.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-011/result.json`
- `evidence/tickets/AFM-011/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-012 — Reconcile lint, types, tests and package boundaries

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-009, AFM-011

## Outcome

Keep existing .mjs implementations while enforcing explicit new module boundaries.

## Source files to inspect and reuse

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

### H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json`
- `hyperframes-main/bun.lock`
- `hyperframes-main/packages/cli/package.json`
- `hyperframes-main/packages/producer/package.json`
- `hyperframes-main/packages/sdk-playground/package.json`

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

## Proposed target files / areas

- `tools/quality/workspace.ts`
- `tsconfig.json`
- `package.json`
- `docs/development/package-boundaries.md`

## Implementation requirements

1. Add type declarations or JS checking at the engine boundary without rewriting all renderer code to TypeScript.
2. Extend existing package-cycle/export/lint checks for project-model and diagram packages.
3. Standardize test entry scripts with an honest unit/integration/browser/render classification; never replace expensive tests with no-op scripts.

## Acceptance criteria

- [ ] project-model imports neither Studio nor browser capture.
- [ ] diagram-engine imports no Studio UI; video compilation consumes its artifact contract.
- [ ] Root checks report selected, failed, skipped and unexecuted tests distinctly.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-012.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Inject a forbidden Studio import into project-model and assert failure.
- Verify existing .mjs schema and generation checks are still executed.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-012/result.json`
- `evidence/tickets/AFM-012/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-013 — Re-run and preserve the Archify source baseline

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-010, AFM-011, AFM-012

## Outcome

Characterize Archify behavior before extracting its engine.

## Source files to inspect and reuse

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

## Proposed target files / areas

- `tests/upstream/archify/`
- `evidence/baseline/archify/`

## Implementation requirements

1. Run its complete available source test entrypoints, generated-validator checks, golden examples and applicable browser/export tests.
2. Record command output, platform, dependencies, skipped prerequisites and input hashes; preserve failures unchanged for triage.
3. Establish sample artifacts for every diagram family, presets, source evidence and guided views.

## Acceptance criteria

- [ ] Baseline evidence belongs to this exact imported snapshot, not historical chat results.
- [ ] Any unavailable browser test is marked not-run, never passed.
- [ ] Subsequent refactors compare against artifacts and test assertions, not only file counts.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-013.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Validate and render the production-deployment example with real artifact checks.
- Exercise workflow migration and sequence/dataflow/lifecycle examples plus negative validation fixtures.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-013/result.json`
- `evidence/tickets/AFM-013/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-014 — Re-run the HyperFrames source baseline

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-010, AFM-011, AFM-012

## Outcome

Know what the inherited editor and renderer actually do before modifying them.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json`
- `hyperframes-main/bun.lock`
- `hyperframes-main/packages/cli/package.json`
- `hyperframes-main/packages/producer/package.json`
- `hyperframes-main/packages/sdk-playground/package.json`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

## Proposed target files / areas

- `tests/upstream/hyperframes/`
- `evidence/baseline/hyperframes/`

## Implementation requirements

1. Run root scripts, package unit suites and selected integration/runtime conformance suites with the imported versions.
2. Exercise an ordinary native project through Studio, SDK persistence and the actual producer.
3. Record platform limitations and external-service exclusions with evidence; prioritize regressions introduced by the merge separately.

## Acceptance criteria

- [ ] An actual native video artifact and probe report exist before claiming a working producer baseline.
- [ ] Build success alone is not interpreted as working Studio or rendering.
- [ ] Existing package version differences and test classifications remain visible.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-014.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run a native HTML scene with media and a seekable timeline.
- Save/reopen a native composition and compare source/preview/render behavior.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-014/result.json`
- `evidence/tickets/AFM-014/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-015 — Install destination-owned CI and evidence collection

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-005, AFM-012

## Outcome

Provide reproducible checks without consuming expensive render resources on every text change.

## Source files to inspect and reuse

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `.github/workflows/ci.yml`
- `tools/quality/write-receipt.ts`
- `docs/quality/test-tiers.md`

## Implementation requirements

1. Define quick unit/schema/lint gates, integration/browser gates and opt-in or scheduled real-render regression jobs.
2. Pin tool versions and artifacts; capture exact commands, hashes, exit statuses and skipped tests in machine-readable receipts.
3. Prevent untrusted PR code from receiving publish/cloud credentials; avoid upstream external deployment triggers.

## Acceptance criteria

- [ ] CI is runnable in the new repository without upstream secrets.
- [ ] A failing required test cannot be hidden by artifact upload success.
- [ ] Render-evidence jobs store actual outputs/probes and distinguish unavailable infrastructure.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-015.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Inject a unit failure and a render timeout and verify both fail their own gates.
- Verify change-based job selection still runs required release suites on release candidates.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-015/result.json`
- `evidence/tickets/AFM-015/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-016 — Remove transitional wrappers and certify one-repo baseline

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E02 — Unified workspace and verified baselines  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-013, AFM-014, AFM-015

## Outcome

Prove source integration is real before deeper product editing begins.

## Source files to inspect and reuse

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

## Proposed target files / areas

- `tools/quality/no-sibling-runtime.ts`
- `docs/quality/M0-baseline.md`

## Implementation requirements

1. Scan runtime imports, subprocess calls and scripts for references to raw source directories or global Archify/HyperFrames executables.
2. Keep compatibility commands as thin in-repo callers, not independent installations.
3. Produce a baseline report covering one install, build, local Studio launch and both original workflows.

## Acceptance criteria

- [ ] Both raw input directories can be removed from the execution environment without breaking the baseline.
- [ ] No nested Git repo, submodule or network checkout is required at runtime.
- [ ] Baseline failures remain open with no fabricated success claims.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-016.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run the built app from a clean copy containing only the new repository.
- Clear global executable paths and confirm owned CLI resolution.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-016/result.json`
- `evidence/tickets/AFM-016/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E03 — Shared project model and atomic authoring

# AFM-017 — Define the versioned unified project document

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-009

## Outcome

Model one project with typed diagrams, native compositions, stories and assets.

## Source files to inspect and reuse

### H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts`
- `hyperframes-main/packages/parsers/src/compositionContract.ts`
- `hyperframes-main/packages/parsers/src/composition.ts`
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts`

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

## Proposed target files / areas

- `packages/project-model/src/project.ts`
- `packages/project-model/schemas/project.schema.json`

## Implementation requirements

1. Define project identity, schema version, revision, relative document references, output settings and policies.
2. Use discriminated scene/document kinds without flattening workflow, sequence, dataflow or lifecycle semantics into architecture.
3. Validate local references and reject ambiguous manifest collisions during import; preserve native authored HTML as a source document.

## Acceptance criteria

- [ ] A mixed project validates without duplicating the authoritative diagram source.
- [ ] Unknown schema versions open read-only or fail with a migration diagnostic rather than being silently rewritten.
- [ ] Generated files are explicitly non-authoritative.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-017.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Validate one fixture containing all five diagram types and ordinary native HTML.
- Reject duplicate document IDs, escaping paths and malformed scene references.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-017/result.json`
- `evidence/tickets/AFM-017/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-018 — Implement durable document, object and scene-instance identities

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-017

## Outcome

Keep edits attached to the intended object across reorder, rename and repeated scene use.

## Source files to inspect and reuse

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

### H-PARSER — DOM identities, GSAP and roundtrip editing

- `hyperframes-main/packages/parsers/src/hfIds.ts`
- `hyperframes-main/packages/parsers/src/hfIdAssignment.ts`
- `hyperframes-main/packages/parsers/src/gsapParser.ts`
- `hyperframes-main/packages/parsers/src/gsapSerialize.ts`
- `hyperframes-main/packages/parsers/src/htmlParser.ts`

## Proposed target files / areas

- `packages/project-model/src/identity.ts`
- `packages/project-model/src/migrations/relationshipIds.ts`

## Implementation requirements

1. Mint persistent IDs for diagrams, scene instances and relationships lacking explicit IDs; write migration changes atomically with source backups.
2. Use type-specific schema support where available and a versioned identity sidecar only where schema extension is necessary and documented.
3. Treat parallel edges/repeated messages as different identities; never derive durable identity only from array index or endpoint pair.

## Acceptance criteria

- [ ] Reordering relationships does not redirect existing animation or overrides.
- [ ] Two copies of one diagram in a story have distinct presentation identities.
- [ ] Ambiguous legacy matching requires an explicit conflict resolution rather than guessed retargeting.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-018.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test identical parallel edges, repeated sequence messages and shuffled arrays.
- Rename a node label, save/reopen and confirm IDs remain stable.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-018/result.json`
- `evidence/tickets/AFM-018/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-019 — Specify shared commands, revision checks and idempotency

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-017, AFM-018

## Outcome

Use one validated mutation protocol from UI, CLI and agent tools.

## Source files to inspect and reuse

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

### H-SERVER — Existing API host and project resolution

- `hyperframes-main/packages/studio-server/src/createStudioApi.ts`
- `hyperframes-main/packages/studio-server/src/types.ts`
- `hyperframes-main/packages/studio-server/src/routes/projects.ts`
- `hyperframes-main/packages/cli/src/server/studioServer.ts`

## Proposed target files / areas

- `packages/project-model/src/commands.ts`
- `packages/project-model/schemas/command.schema.json`

## Implementation requirements

1. Define commandId, origin, projectId, expectedRevision, typed operation, target and payload.
2. Define success, validation failure, revision conflict and idempotent replay responses with diagnostics and changed-document identities.
3. Separate semantic edits, presentation edits, asset edits and detach operations; deny arbitrary compiler-owned DOM mutation.

## Acceptance criteria

- [ ] Retrying an identical command does not duplicate nodes or scenes.
- [ ] A stale command receives a conflict and never overwrites a newer edit.
- [ ] Type-invalid or unknown commands leave all documents unchanged.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-019.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test duplicate command IDs with same and different payloads.
- Race two expectedRevision writes and accept exactly one.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-019/result.json`
- `evidence/tickets/AFM-019/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-020 — Build atomic filesystem revisions and recovery

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-019

## Outcome

Persist multi-document edits as coherent revisions instead of unrelated file writes.

## Source files to inspect and reuse

### H-PERSIST — SDK persistence and project file writes

- `hyperframes-main/packages/sdk/src/persist-queue.ts`
- `hyperframes-main/packages/sdk/src/adapters/fs.ts`
- `hyperframes-main/packages/studio-server/src/helpers/backupJournal.ts`
- `hyperframes-main/packages/studio-server/src/helpers/fileVersion.ts`

### H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts`
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts`
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts`
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts`

## Proposed target files / areas

- `packages/project-model/src/storage/revisions.ts`
- `packages/project-model/src/storage/commit.ts`

## Implementation requirements

1. Write immutable revision content and hashes to staging, verify completeness, then atomically advance the committed revision pointer with platform-appropriate locking.
2. Define fsync/rename and Windows replacement behavior explicitly; pin readers to committed revisions.
3. Recover interrupted writes, keep previous revisions and avoid claiming that independent JSON/HTML writes form a transaction.

## Acceptance criteria

- [ ] A crash before commit retains the old complete revision; a successful commit exposes the new complete revision.
- [ ] Disk-full or permission errors produce a visible failed save with recovery information.
- [ ] No user media is garbage-collected while referenced by retained revisions or running jobs.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-020.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Fault-inject before/after staging writes and pointer replacement.
- Test concurrent saves, read-during-save and restart after a truncated staging directory.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-020/result.json`
- `evidence/tickets/AFM-020/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-021 — Implement one project undo/redo command journal

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-019, AFM-020

## Outcome

Restore semantic and presentation state together for each user action.

## Source files to inspect and reuse

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/project-model/src/history.ts`
- `packages/project-model/src/commandJournal.ts`

## Implementation requirements

1. Record transaction boundaries, inverse state/patches and command origins across all affected documents.
2. Undo creates a new committed revision referencing restored authoring state rather than rewinding a mutable revision counter.
3. Collapse drag/text-edit gestures into meaningful history entries and define redo invalidation after a new edit.

## Acceptance criteria

- [ ] Undoing a semantic rename restores diagram labels and regenerated scene references coherently.
- [ ] A failed command creates no undo entry.
- [ ] History survives save/reopen without replaying network actions or provider charges.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-021.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test semantic edit, presentation edit, undo twice and redo once.
- Test batch rollback and history restoration after restart.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-021/result.json`
- `evidence/tickets/AFM-021/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-022 — Implement backup-first import and project migrations

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-017, AFM-018, AFM-020

## Outcome

Import raw diagram JSON and existing HyperFrames projects without destructive conversion.

## Source files to inspect and reuse

### A-WORK — Workflow compile, migrate, and branch semantics

- `archify-main/archify/renderers/workflow/render-workflow.mjs`
- `archify-main/archify/renderers/workflow/workflow-compiler.mjs`
- `archify-main/archify/migrations/workflow-v2.mjs`
- `archify-main/archify/schemas/workflow.schema.json`
- `archify-main/archify/examples/agent-tool-call.workflow.json`

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts`
- `hyperframes-main/packages/parsers/src/compositionContract.ts`
- `hyperframes-main/packages/parsers/src/composition.ts`
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts`

## Proposed target files / areas

- `packages/project-model/src/importers/`
- `packages/project-model/src/migrations/`
- `docs/migration/project-formats.md`

## Implementation requirements

1. Detect diagram type/schema and preserve original bytes in a migration receipt; reuse workflow-v2 migration where required.
2. Import native composition trees and assets with path rewrites and collision checks while preserving unsupported metadata.
3. Make migration atomic, repeatable and versioned; never overwrite an unrelated project.json.

## Acceptance criteria

- [ ] Re-running import does not duplicate documents or destroy authoring data.
- [ ] Legacy project and diagram fixtures reopen after migration and remain exportable.
- [ ] Unsupported formats produce actionable diagnostics and leave originals untouched.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-022.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test workflow v1/v2, a standalone architecture JSON and a nested native project.
- Test a destination manifest collision and failure halfway through media copying.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-022/result.json`
- `evidence/tickets/AFM-022/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-023 — Create a shared asset registry and reference contract

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-017, AFM-020

## Outcome

Give media, fonts, diagrams and native compositions stable local asset references.

## Source files to inspect and reuse

### H-ASSETS — Media validation, probing and asset resolution

- `hyperframes-main/packages/studio-server/src/routes/media.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaMetadata.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaValidation.ts`
- `hyperframes-main/packages/parsers/src/assetResolution.ts`
- `hyperframes-main/packages/parsers/src/assetPaths.ts`

### H-FONTS — Font readiness and localization code (not binary redistribution)

- `hyperframes-main/packages/producer/src/services/deterministicFonts.ts`
- `hyperframes-main/packages/cli/src/fontLocalize.ts`
- `hyperframes-main/packages/studio-server/src/routes/fonts.ts`
- `hyperframes-main/packages/cli/src/capture/captureFontValidation.ts`

## Proposed target files / areas

- `packages/project-model/src/assets.ts`
- `packages/project-model/schemas/assets.schema.json`

## Implementation requirements

1. Record asset ID, content hash, media type, measured dimensions/duration, origin, rights and explicit provider metadata.
2. Keep credentials and expiring signed URLs outside project records; import approved bytes into controlled asset storage.
3. Track reference counts through committed revisions, including placeholders that block rendering until resolved.

## Acceptance criteria

- [ ] Editing a filename does not break stable asset references.
- [ ] Missing or changed media is detectable before render and never silently substituted.
- [ ] Asset metadata distinguishes estimated from measured durations.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-023.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test duplicate content under two filenames and one filename with changed bytes.
- Reject a malicious path and detect a referenced missing asset.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-023/result.json`
- `evidence/tickets/AFM-023/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-024 — Define diagnostics, evidence and redaction contracts

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-017, AFM-019

## Outcome

Carry actionable errors and source provenance through every editing and export surface.

## Source files to inspect and reuse

### A-EVID — Source references and engineering metadata

- `archify-main/archify/renderers/shared/repository-evidence.mjs`
- `archify-main/archify/renderers/shared/repository-location.mjs`
- `archify-main/archify/renderers/shared/engineering-profiles.mjs`
- `archify-main/archify/test/repository-evidence.test.mjs`

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

### H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts`
- `hyperframes-main/packages/studio-server/src/routes/preview.ts`
- `hyperframes-main/packages/studio-server/src/routes/lint.ts`
- `hyperframes-main/packages/studio-server/src/routes/selection.ts`

## Proposed target files / areas

- `packages/project-model/src/diagnostics.ts`
- `packages/project-model/src/evidence.ts`

## Implementation requirements

1. Define stable diagnostic codes, severity, source JSON pointer, semantic target, scene and recovery action.
2. Preserve repository evidence with snapshot/revision provenance; distinguish verified source structure from inferred narrative.
3. Add public-export redaction flags and protected/private evidence policy without mutating internal source truth.

## Acceptance criteria

- [ ] UI, CLI and agent failures identify the same invalid source field.
- [ ] Redacted exports cannot leak repository paths through hidden metadata or captions.
- [ ] Schema validation is never labeled proof of runtime behavior or performance.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-024.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test unknown focus ID, bad edge endpoint and stale source evidence.
- Search a public export for deliberately planted private paths and tokens.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-024/result.json`
- `evidence/tickets/AFM-024/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-025 — Version story timing, animation intents and presentation overrides

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-017, AFM-018, AFM-023

## Outcome

Persist editable video intent separately from generated composition HTML.

## Source files to inspect and reuse

### H-TIME — Seek adapter and playback time

- `hyperframes-main/packages/core/src/adapters/gsap.ts`
- `hyperframes-main/packages/core/src/adapters/types.ts`
- `hyperframes-main/packages/player/src/direct-timeline-clock.ts`
- `hyperframes-main/packages/player/src/timeline-adapters.ts`

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

## Proposed target files / areas

- `packages/project-model/src/story.ts`
- `packages/project-model/src/presentation.ts`
- `packages/project-model/schemas/story.schema.json`

## Implementation requirements

1. Store integer frame starts/durations, rational frame rate, scene instance IDs, media trims and semantic animation targets.
2. Define supported intents such as frame-group, focus-object, reveal-authored-edge and show-callout with explicit finite timing.
3. Persist overrides against durable semantic/scene identities and a source/build version; define conflicts for missing or incompatible targets.

## Acceptance criteria

- [ ] No implicit inferred edge exists merely because two objects are adjacent in a focus list.
- [ ] Zero/negative/nonfinite timing and invalid media trims are rejected consistently.
- [ ] Presentation edits cannot silently become architecture facts.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-025.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test 30fps and 30000/1001 conversions at boundaries without cumulative float drift.
- Test a removed target and multiple appearances of one node.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-025/result.json`
- `evidence/tickets/AFM-025/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-026 — Implement build hashes, dependency graph and garbage collection policy

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E03 — Shared project model and atomic authoring  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-020, AFM-023, AFM-025

## Outcome

Know exactly which documents and assets produced each preview or video.

## Source files to inspect and reuse

### H-PRODUCER — Retained render pipeline

- `hyperframes-main/packages/producer/src/index.ts`
- `hyperframes-main/packages/producer/src/renderRequest.ts`
- `hyperframes-main/packages/producer/src/services/renderOrchestrator.ts`
- `hyperframes-main/packages/producer/src/services/compilationRunner.ts`

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

## Proposed target files / areas

- `packages/project-model/src/buildGraph.ts`
- `packages/project-model/src/buildReceipt.ts`

## Implementation requirements

1. Hash source bytes, compile options, dependency versions and approved asset bytes into build keys.
2. Track scene/document dependencies for incremental invalidation and pin render inputs to immutable revisions.
3. Define conservative cleanup excluding open revisions, active jobs, unsaved recoverable work and imported originals until user-approved retention expires.

## Acceptance criteria

- [ ] A render receipt references one coherent build and immutable assets.
- [ ] Changing a caption does not recompute unrelated diagram geometry; changing a diagram invalidates its scene instances.
- [ ] Stale build completion cannot replace a newer preview.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-026.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test edits during compilation and during rendering.
- Test cleanup with a running job and a referenced historical asset.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-026/result.json`
- `evidence/tickets/AFM-026/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E04 — Callable diagram engine and preserved viewer

# AFM-027 — Extract a side-effect-free diagram compilation API

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-011, AFM-017, AFM-024

## Outcome

Replace CLI-oriented imports with a real library shared by the CLI, Studio server and tests.

## Source files to inspect and reuse

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

## Proposed target files / areas

- `packages/diagram-engine/src/index.mjs`
- `packages/diagram-engine/src/contracts.d.ts`

## Implementation requirements

1. Define compileDiagram inputs with explicit source, kind, theme, asset/evidence resolvers and options; define artifact geometry, SVG, styles, semantic index and diagnostics.
2. Move argv parsing, process exits, file loading, output writing and global diagnostic handlers outside pure compilation.
3. Preserve existing algorithms; keep .mjs where useful and expose checked types at the boundary.

## Acceptance criteria

- [ ] Importing the engine neither reads argv nor writes files nor starts a server.
- [ ] Two parallel compiles cannot leak options, IDs or diagnostics into each other.
- [ ] Compilation returns structured errors without terminating the host process.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-027.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run an import-only side-effect test with forbidden filesystem/network adapters.
- Compile two different fixtures concurrently and compare with isolated results.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-027/result.json`
- `evidence/tickets/AFM-027/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-028 — Preserve schemas, generated validators and compatibility

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-013, AFM-027

## Outcome

Retain source validation as an enforceable engine contract, including legacy migration boundaries.

## Source files to inspect and reuse

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

### A-WORK — Workflow compile, migrate, and branch semantics

- `archify-main/archify/renderers/workflow/render-workflow.mjs`
- `archify-main/archify/renderers/workflow/workflow-compiler.mjs`
- `archify-main/archify/migrations/workflow-v2.mjs`
- `archify-main/archify/schemas/workflow.schema.json`
- `archify-main/archify/examples/agent-tool-call.workflow.json`

## Proposed target files / areas

- `packages/diagram-engine/schemas/`
- `packages/diagram-engine/scripts/generate-validators.mjs`

## Implementation requirements

1. Relocate all five type schemas and shared definitions with working relative refs.
2. Maintain generated validators with reproducible generation/check commands, including any deliberate identity extension.
3. Preserve authored schema versions and route migrations through project import rather than silently mutating input during render.

## Acceptance criteria

- [ ] Existing valid fixtures remain valid or have a reviewed migration receipt.
- [ ] Invalid endpoints, duplicate IDs and malformed schema versions fail with source locations.
- [ ] Generated validators cannot drift unnoticed from schemas.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-028.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run upstream validation/generation tests under the new paths.
- Corrupt a schema and assert check-generated fails until regeneration is reviewed.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-028/result.json`
- `evidence/tickets/AFM-028/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-029 — Refactor architecture layout and emit native geometry

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-028, AFM-018

## Outcome

Expose the real architecture drawing and relationships without scraping a completed viewer page.

## Source files to inspect and reuse

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

## Proposed target files / areas

- `packages/diagram-engine/src/architecture/compile.mjs`
- `packages/diagram-engine/src/architecture/artifact.mjs`

## Implementation requirements

1. Reuse architecture renderer/grid routing, labels, boundaries and engineering metadata.
2. Emit canonical SVG plus object/group bounds, edge paths, labels, source identities and guided views directly at the shared output boundary.
3. Preserve explicit authored relationship direction and validated layout/readability diagnostics.

## Acceptance criteria

- [ ] The deployment fixture retains its component/relationship set and authored branch topology.
- [ ] Library and compatibility CLI consume identical compiled geometry.
- [ ] No screenshot or secondary AI redraw becomes the semantic intermediate.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-029.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Compare geometry/artifact checks against the imported baseline.
- Test parallel connections, long labels, nested groups and missing endpoints.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-029/result.json`
- `evidence/tickets/AFM-029/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-030 — Refactor workflow layout and migration into the engine

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-028, AFM-018

## Outcome

Keep workflow-specific routing, lanes and branches intact in the shared engine.

## Source files to inspect and reuse

### A-WORK — Workflow compile, migrate, and branch semantics

- `archify-main/archify/renderers/workflow/render-workflow.mjs`
- `archify-main/archify/renderers/workflow/workflow-compiler.mjs`
- `archify-main/archify/migrations/workflow-v2.mjs`
- `archify-main/archify/schemas/workflow.schema.json`
- `archify-main/archify/examples/agent-tool-call.workflow.json`

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

## Proposed target files / areas

- `packages/diagram-engine/src/workflow/compile.mjs`
- `packages/diagram-engine/src/workflow/migrate.mjs`

## Implementation requirements

1. Extract the workflow compiler from CLI IO and preserve explicit routes, node dimensions, labels and lane/group semantics.
2. Reuse migration and geometry repair logic with before/after receipts rather than lossy generic graph conversion.
3. Emit durable node/edge identities, geometry and diagnostics through the common artifact envelope.

## Acceptance criteria

- [ ] Workflow v1/v2 inputs follow documented migration behavior.
- [ ] A branch remains multiple authored edges, never an invented linear sequence.
- [ ] Lane/group membership and route labels survive compilation.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-030.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run upstream workflow hard-contract, migration and issue-126 fixtures.
- Test invalid lane membership and a disconnected focus view.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-030/result.json`
- `evidence/tickets/AFM-030/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-031 — Refactor sequence compilation with ordered message identity

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-028, AFM-018

## Outcome

Preserve temporal ordering rather than interpreting a sequence diagram as an ordinary graph.

## Source files to inspect and reuse

### A-SEQ — Ordered messages and participants

- `archify-main/archify/renderers/sequence/render-sequence.mjs`
- `archify-main/archify/schemas/sequence.schema.json`
- `archify-main/archify/examples/cache-miss-request.sequence.json`
- `archify-main/archify/test/sequence-column-fit.test.mjs`

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

## Proposed target files / areas

- `packages/diagram-engine/src/sequence/compile.mjs`
- `packages/diagram-engine/src/sequence/artifact.mjs`

## Implementation requirements

1. Extract participant layout and ordered message rendering with type-specific metadata for returns and supported groups.
2. Give repeated from/to messages distinct stable IDs and retain authored message order.
3. Expose participant and message geometry separately so animation can target each correctly.

## Acceptance criteria

- [ ] Reordering participants does not silently reorder messages.
- [ ] Repeated endpoint pairs remain independently editable and animatable.
- [ ] Column/text fit matches baseline constraints.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-031.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run cache-miss and async-roundtrip fixtures plus column-fit tests.
- Test repeated messages, self-message, invalid participant and return-message direction.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-031/result.json`
- `evidence/tickets/AFM-031/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-032 — Refactor dataflow compilation and boundary semantics

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-028, AFM-018

## Outcome

Retain dataflow nodes, flows and supported boundaries as typed source.

## Source files to inspect and reuse

### A-DATA — Dataflow renderer, schema and examples

- `archify-main/archify/renderers/dataflow/render-dataflow.mjs`
- `archify-main/archify/schemas/dataflow.schema.json`
- `archify-main/archify/examples/product-analytics.dataflow.json`
- `archify-main/archify/examples/event-stream.dataflow.json`

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

## Proposed target files / areas

- `packages/diagram-engine/src/dataflow/compile.mjs`
- `packages/diagram-engine/src/dataflow/artifact.mjs`

## Implementation requirements

1. Extract dataflow rendering from process/file IO, preserving flow labels and direction.
2. Expose nodes, flows and container/boundary geometry with stable identities in the artifact.
3. Keep dataflow validation and authoring affordances distinct from architecture-specific metadata.

## Acceptance criteria

- [ ] Product-analytics and event-stream examples preserve all authored flow endpoints.
- [ ] Editing a flow label cannot retarget its identity.
- [ ] Unsupported architecture-only fields are rejected or explicitly modeled, not silently accepted.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-032.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Compare example artifacts to the baseline.
- Test parallel data flows, boundary crossing and missing endpoints.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-032/result.json`
- `evidence/tickets/AFM-032/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-033 — Refactor lifecycle compilation and transition semantics

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-028, AFM-018

## Outcome

Keep states, transition labels and supported lifecycle semantics intact.

## Source files to inspect and reuse

### A-LIFE — Lifecycle states and transitions

- `archify-main/archify/renderers/lifecycle/render-lifecycle.mjs`
- `archify-main/archify/schemas/lifecycle.schema.json`
- `archify-main/archify/examples/agent-run.lifecycle.json`
- `archify-main/archify/examples/deployment-release.lifecycle.json`

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

## Proposed target files / areas

- `packages/diagram-engine/src/lifecycle/compile.mjs`
- `packages/diagram-engine/src/lifecycle/artifact.mjs`

## Implementation requirements

1. Extract lifecycle layout and transition routing into explicit compile inputs/outputs.
2. Preserve type-specific state metadata, loops and terminal-state representation supported by the original schema.
3. Expose state/transition geometry and stable identity without inventing a single execution path.

## Acceptance criteria

- [ ] Agent-run and deployment-release examples compile with preserved authored transitions.
- [ ] A terminal presentation choice does not create a new factual transition.
- [ ] Loops and repeated transition endpoints retain separate identities.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-033.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test cycle, self-transition, unreachable state and invalid target fixtures.
- Compare artifact diagnostics and labels with baseline output.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-033/result.json`
- `evidence/tickets/AFM-033/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-034 — Extract reusable themes, presets, locale and brand resolution

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-028, AFM-004

## Outcome

Preserve visual identity without hidden network or global-document dependencies.

## Source files to inspect and reuse

### A-THEME — Brand registry, locale and presets

- `archify-main/archify/renderers/shared/brand-marks.mjs`
- `archify-main/archify/renderers/shared/generated-brand-marks.mjs`
- `archify-main/archify/renderers/shared/i18n.mjs`
- `archify-main/archify/test/preset-tryon.test.mjs`
- `archify-main/archify/test/i18n.test.mjs`

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

### H-STYLE — Existing themes and native animated graph reference

- `hyperframes-main/themes/CONTRACT.md`
- `hyperframes-main/themes/editorial.css`
- `hyperframes-main/registry/blocks/flowchart/flowchart.html`
- `hyperframes-main/registry/blocks/flowchart-vertical/flowchart-vertical.html`

## Proposed target files / areas

- `packages/diagram-engine/src/theme/`
- `packages/diagram-viewer/src/theme/`

## Implementation requirements

1. Extract theme variables, presets, locale strings, brand lookup and icon resolution behind explicit options/adapters.
2. Keep original light/dark and supported locale behavior while introducing product-level theme mappings.
3. Resolve reviewed assets before compilation and mark unavailable brand assets explicitly; do not silently fetch live websites.

## Acceptance criteria

- [ ] The same source can render in retained presets/locales through both standalone and video paths.
- [ ] Theme changes do not change semantic IDs or topology.
- [ ] Missing assets yield a documented fallback diagnostic or blocking error according to policy.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-034.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run preset, i18n and brand-mark baseline tests.
- Render two themes concurrently and verify no cross-instance style contamination.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-034/result.json`
- `evidence/tickets/AFM-034/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-035 — Extract the standalone diagram viewer as a product module

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-029, AFM-030, AFM-031, AFM-032, AFM-033, AFM-034

## Outcome

Preserve interactive diagram output without embedding a second authoritative editing application.

## Source files to inspect and reuse

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

## Proposed target files / areas

- `packages/diagram-viewer/src/index.mjs`
- `packages/diagram-viewer/src/template/`
- `packages/diagram-viewer/src/controller/`

## Implementation requirements

1. Split template rendering, viewer UI and live presentation controls from engine geometry.
2. Preserve search, details, themes, guided views, accessibility text and supported links through a viewer consuming compiled artifacts.
3. Keep interactive timers confined to viewer mode; video scenes import no viewer recorder or autonomous clock.

## Acceptance criteria

- [ ] All five diagram families export valid standalone HTML from the shared engine.
- [ ] Viewer state never overwrites project source without a project command.
- [ ] A video compile can exclude viewer scripts entirely.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-035.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run original viewer/search/guided-view artifact tests against relocated output.
- Static-scan and browser-test video scenes for leaked viewer loops.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-035/result.json`
- `evidence/tickets/AFM-035/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-036 — Retain authored reachability, route inspection and deep links

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-029, AFM-035, AFM-024

## Outcome

Preserve graph exploration while maintaining the distinction between authored connectivity and runtime causality.

## Source files to inspect and reuse

### A-REACH — Authored graph inspection and sharing

- `archify-main/archify/test/authored-reachability.test.mjs`
- `archify-main/archify/test/route-probe.test.mjs`
- `archify-main/archify/test/relationship-direct-explorer.test.mjs`
- `archify-main/archify/test/relationship-permalink.test.mjs`
- `archify-main/archify/test/reach-share-card.test.mjs`

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

## Proposed target files / areas

- `packages/diagram-viewer/src/graphInspection.mjs`
- `packages/diagram-engine/src/relationships.mjs`

## Implementation requirements

1. Extract supported route/reachability queries and relationship filtering with stable IDs.
2. Preserve node/relationship/view deep-link state in viewer exports and expose equivalent read APIs for Studio.
3. Label results as authored connectivity and cap traversal/cycle handling for large graphs.

## Acceptance criteria

- [ ] Branching and reverse edges are represented correctly.
- [ ] A disconnected focus pair is never reported as a direct connection.
- [ ] Shared links resolve the intended object or a clear missing-target state after revision changes.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-036.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run authored-reachability, route-probe and relationship-permalink tests.
- Test cycles, parallel edges, missing deep-link IDs and capped traversal.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-036/result.json`
- `evidence/tickets/AFM-036/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-037 — Integrate source evidence and exact architecture deltas

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-029, AFM-024, AFM-018

## Outcome

Expose validated source references and authored before/after changes as reusable services.

## Source files to inspect and reuse

### A-EVID — Source references and engineering metadata

- `archify-main/archify/renderers/shared/repository-evidence.mjs`
- `archify-main/archify/renderers/shared/repository-location.mjs`
- `archify-main/archify/renderers/shared/engineering-profiles.mjs`
- `archify-main/archify/test/repository-evidence.test.mjs`

### A-DELTA — Before/after receipts and geometry

- `archify-main/archify/delta/architecture-delta.mjs`
- `archify-main/archify/test/architecture-delta.test.mjs`
- `archify-main/archify/examples/checkout-platform.base.architecture.json`
- `archify-main/archify/examples/checkout-platform.head.architecture.json`

## Proposed target files / areas

- `packages/diagram-engine/src/evidence/`
- `packages/diagram-engine/src/delta/`

## Implementation requirements

1. Refactor evidence access behind an authorized repository resolver with pinned source identity and path controls.
2. Expose before/head diff computation, exact added/removed/changed relationships and receipt serialization.
3. Preserve disclaimers: a structural diff does not prove runtime risk, performance, security or causality.

## Acceptance criteria

- [ ] Delta output corresponds to the exact two supplied source revisions.
- [ ] Unreadable or stale evidence is distinguishable from verified evidence.
- [ ] Repeated/parallel relationships cannot be matched only by endpoints.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-037.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run architecture-delta and repository-evidence baseline suites.
- Test wrong repository revision, renamed labels, moved geometry and removed relationship identities.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-037/result.json`
- `evidence/tickets/AFM-037/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-038 — Expose artifact checks and thin compatibility commands

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E04 — Callable diagram engine and preserved viewer  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-029, AFM-030, AFM-031, AFM-032, AFM-033, AFM-035, AFM-037

## Outcome

Keep useful upstream validation/export commands while routing them through owned engine code.

## Source files to inspect and reuse

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `packages/diagram-engine/src/checks/`
- `packages/cli/src/commands/diagramCompatibility.ts`

## Implementation requirements

1. Reuse schema, geometry, artifact XML/HTML and visual-check routines with structured receipts.
2. Implement retained render/validate/check/compare/inspect compatibility behavior as thin workspace calls; deprecate incompatible flags explicitly.
3. Unify output-path safety and diagnostics without spawning an installed upstream CLI.

## Acceptance criteria

- [ ] CLI and API checks agree for the same source and artifact.
- [ ] A compatibility command can run outside the repo cwd.
- [ ] Invalid output and missing assets return nonzero exit status, not successful path-only output.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-038.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Exercise retained command fixtures and unsafe output path tests.
- Corrupt an SVG relationship or accessibility attribute and verify artifact checks catch it.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-038/result.json`
- `evidence/tickets/AFM-038/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E05 — Native diagram scenes and deterministic motion

# AFM-039 — Implement the native managed diagram-scene contract

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-025, AFM-029, AFM-026

## Outcome

Make a diagram a native scene in the standard composition pipeline.

## Source files to inspect and reuse

### H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts`
- `hyperframes-main/packages/parsers/src/compositionContract.ts`
- `hyperframes-main/packages/parsers/src/composition.ts`
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts`

### H-PARSER — DOM identities, GSAP and roundtrip editing

- `hyperframes-main/packages/parsers/src/hfIds.ts`
- `hyperframes-main/packages/parsers/src/hfIdAssignment.ts`
- `hyperframes-main/packages/parsers/src/gsapParser.ts`
- `hyperframes-main/packages/parsers/src/gsapSerialize.ts`
- `hyperframes-main/packages/parsers/src/htmlParser.ts`

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

## Proposed target files / areas

- `packages/diagram-motion/src/scene.ts`
- `packages/diagram-motion/src/compiler.ts`

## Implementation requirements

1. Compile a diagram artifact plus scene intent into regular HyperFrames HTML with metadata, duration, dimensions and registered animation timeline.
2. Mark geometry/diagram labels as compiler-owned and overlays as presentation-owned.
3. Emit semantic-to-render bindings and a build receipt; avoid replacing core with a second video renderer.

## Acceptance criteria

- [ ] Generated scenes pass retained composition parsing and lint contracts.
- [ ] A diagram scene and a native HTML scene can coexist in one story.
- [ ] Managed output contains recoverable source/build identity and no duplicate semantic authority.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-039.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Compile the deployment fixture plus a native title scene.
- Reject missing scene source, mismatched build hash and unsupported intent.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-039/result.json`
- `evidence/tickets/AFM-039/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-040 — Namespace SVG, CSS and composition-instance identities

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-039, AFM-018

## Outcome

Prevent repeated diagrams from corrupting one another's markers, filters, labels or animations.

## Source files to inspect and reuse

### H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts`
- `hyperframes-main/packages/parsers/src/compositionContract.ts`
- `hyperframes-main/packages/parsers/src/composition.ts`
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts`

### H-PARSER — DOM identities, GSAP and roundtrip editing

- `hyperframes-main/packages/parsers/src/hfIds.ts`
- `hyperframes-main/packages/parsers/src/hfIdAssignment.ts`
- `hyperframes-main/packages/parsers/src/gsapParser.ts`
- `hyperframes-main/packages/parsers/src/gsapSerialize.ts`
- `hyperframes-main/packages/parsers/src/htmlParser.ts`

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

## Proposed target files / areas

- `packages/diagram-motion/src/namespaceSvg.ts`
- `packages/diagram-motion/src/scopeStyles.ts`

## Implementation requirements

1. Rewrite IDs and references in SVG markers, masks, filters, gradients, href/xlink, style URLs and accessibility attributes using scene-instance namespaces.
2. Scope diagram styles and custom properties with the existing composition-scoping machinery; define safe handling for document-level selectors and keyframe names.
3. Preserve semantic IDs in binding metadata while making render IDs unique.

## Acceptance criteria

- [ ] Two overlapping instances of one diagram show correct arrows, colors and labels.
- [ ] No scene selector or CSS rule alters unrelated native content.
- [ ] Unsupported references produce an explicit compile diagnostic instead of broken output.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-040.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test duplicate marker/gradient IDs, aria references and url(#id) in style attributes.
- Render two differently themed instances simultaneously and inspect computed styles.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-040/result.json`
- `evidence/tickets/AFM-040/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-041 — Build scene framing and camera geometry

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-039, AFM-025

## Outcome

Turn semantic focus into readable scene framing rather than blind screenshot scaling.

## Source files to inspect and reuse

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

### H-TIME — Seek adapter and playback time

- `hyperframes-main/packages/core/src/adapters/gsap.ts`
- `hyperframes-main/packages/core/src/adapters/types.ts`
- `hyperframes-main/packages/player/src/direct-timeline-clock.ts`
- `hyperframes-main/packages/player/src/timeline-adapters.ts`

## Proposed target files / areas

- `packages/diagram-motion/src/camera.ts`
- `packages/diagram-motion/src/framing.ts`

## Implementation requirements

1. Calculate bounds for nodes, groups and authored relationships with padding and title/caption safe areas.
2. Persist camera keyframes as presentation intent, independent of source layout.
3. Define zoom limits, clipping diagnostics and deliberate widescreen/square/portrait reframing.

## Acceptance criteria

- [ ] Focused labels remain visible within the selected output frame and reserved caption area.
- [ ] Empty/missing focus targets fail with diagnostics.
- [ ] Camera motion between disconnected objects does not imply a relationship.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-041.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test long labels, tiny nodes, wide diagrams and portrait reframing.
- Verify node selection remains aligned after camera transforms.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-041/result.json`
- `evidence/tickets/AFM-041/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-042 — Compile paused seekable focus and reveal animations

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-039, AFM-040, AFM-041

## Outcome

Give HyperFrames sole control of video time.

## Source files to inspect and reuse

### H-TIME — Seek adapter and playback time

- `hyperframes-main/packages/core/src/adapters/gsap.ts`
- `hyperframes-main/packages/core/src/adapters/types.ts`
- `hyperframes-main/packages/player/src/direct-timeline-clock.ts`
- `hyperframes-main/packages/player/src/timeline-adapters.ts`

### H-STYLE — Existing themes and native animated graph reference

- `hyperframes-main/themes/CONTRACT.md`
- `hyperframes-main/themes/editorial.css`
- `hyperframes-main/registry/blocks/flowchart/flowchart.html`
- `hyperframes-main/registry/blocks/flowchart-vertical/flowchart-vertical.html`

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

## Proposed target files / areas

- `packages/diagram-motion/src/timeline.ts`
- `packages/diagram-motion/src/intents/`

## Implementation requirements

1. Generate finite paused GSAP timelines under the standard composition ID; define explicit initial and final states.
2. Implement node/group emphasis, reveals, callouts and camera transitions without wall-clock timers or random state.
3. Reuse only pure explicit-time math from Archify where tested; exclude MediaRecorder and viewer story loops.

## Acceptance criteria

- [ ] Repeated and reverse seeks produce the same visual state at a timestamp.
- [ ] Scenes remain valid when first evaluated halfway through their duration.
- [ ] Preview and producer consume the same timeline generation path.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-042.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Seek end, start, middle, middle again and compare captured pixels/state.
- Reject nonfinite duration and detect forbidden wall-clock behavior in generated scenes.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-042/result.json`
- `evidence/tickets/AFM-042/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-043 — Animate only authored relationships and valid routes

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-039, AFM-042, AFM-036

## Outcome

Prevent visually attractive but false connection animations.

## Source files to inspect and reuse

### A-REACH — Authored graph inspection and sharing

- `archify-main/archify/test/authored-reachability.test.mjs`
- `archify-main/archify/test/route-probe.test.mjs`
- `archify-main/archify/test/relationship-direct-explorer.test.mjs`
- `archify-main/archify/test/relationship-permalink.test.mjs`
- `archify-main/archify/test/reach-share-card.test.mjs`

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

## Proposed target files / areas

- `packages/diagram-motion/src/routeIntents.ts`
- `packages/diagram-motion/src/edgeMotion.ts`

## Implementation requirements

1. Resolve every edge reveal or signal to an explicit relationship ID and source direction.
2. Classify focus transitions as connected, reverse, parallel/ambiguous or unconnected; require explicit selection when more than one relationship matches.
3. Use camera moves/group emphasis for unconnected focus entries; never synthesize API-to-API traffic in the gateway branch example.

## Acceptance criteria

- [ ] Every animated flow has a matching authored relationship.
- [ ] Reverse edges retain arrow direction rather than silently reversing semantics.
- [ ] Parallel-edge ambiguity blocks route animation until resolved.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-043.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test gateway -> api_a and gateway -> api_b with no api_a -> api_b edge.
- Test reverse, self-loop and two parallel labeled edges.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-043/result.json`
- `evidence/tickets/AFM-043/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-044 — Map nested-scene time and overlapping composition windows

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-042, AFM-025

## Outcome

Keep local scene time, project time and media windows consistent.

## Source files to inspect and reuse

### H-TIME — Seek adapter and playback time

- `hyperframes-main/packages/core/src/adapters/gsap.ts`
- `hyperframes-main/packages/core/src/adapters/types.ts`
- `hyperframes-main/packages/player/src/direct-timeline-clock.ts`
- `hyperframes-main/packages/player/src/timeline-adapters.ts`

### H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts`
- `hyperframes-main/packages/parsers/src/compositionContract.ts`
- `hyperframes-main/packages/parsers/src/composition.ts`
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts`

### H-PLAYER — Player and slideshow compatibility

- `hyperframes-main/packages/player/src/hyperframes-player.ts`
- `hyperframes-main/packages/player/src/slideshow/hyperframes-slideshow.ts`
- `hyperframes-main/packages/player/src/runtime-message-handler.ts`
- `hyperframes-main/packages/player/src/media-element-guards.ts`

## Proposed target files / areas

- `packages/diagram-motion/src/timeMapping.ts`
- `packages/diagram-motion/src/sceneWindows.ts`

## Implementation requirements

1. Convert integer/rational story timing at the composition emission boundary with explicit half-open frame windows.
2. Respect runtime nesting instead of manually adding child timelines twice.
3. Handle trims, scene overlap and transitions with bounded local time and deterministic clamping.

## Acceptance criteria

- [ ] Frame N at a scene boundary belongs to the documented interval without duplicate or missing frames.
- [ ] Overlapping scenes seek independently and retain their own IDs/state.
- [ ] Long projects do not accumulate timing drift from repeated float conversion.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-044.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test 30 and 30000/1001 fps across nested scenes.
- Compare direct random seek with chronological playback at transition boundaries.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-044/result.json`
- `evidence/tickets/AFM-044/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-045 — Generate editable story drafts from guided views

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-025, AFM-039, AFM-043

## Outcome

Use existing guided views as story input while leaving timing and wording editable.

## Source files to inspect and reuse

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

### H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts`
- `hyperframes-main/packages/studio-server/src/routes/preview.ts`
- `hyperframes-main/packages/studio-server/src/routes/lint.ts`
- `hyperframes-main/packages/studio-server/src/routes/selection.ts`

## Proposed target files / areas

- `packages/diagram-motion/src/storyFromViews.ts`

## Implementation requirements

1. Translate view titles, descriptions and focus sets into scene drafts with documented default frame durations.
2. Validate every reference and use authored route classification rather than interpreting focus order as a chain.
3. Preserve deterministic scene identities for regeneration; mark proposed narration as draft and unsupported statements as unverified.

## Acceptance criteria

- [ ] The three deployment guided views generate valid editable scenes.
- [ ] Rebuilding unchanged input does not mint new scene IDs or erase deliberate timing edits.
- [ ] A missing view target produces a source diagnostic.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-045.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test no views, duplicate view IDs, changed view title and reordered views.
- Verify a branch is preserved when drafting camera and edge intents.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-045/result.json`
- `evidence/tickets/AFM-045/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-046 — Bind semantic animation intents to editable timeline tracks

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-039, AFM-042, AFM-025

## Outcome

Expose node, edge and camera motion as meaningful editable tracks.

## Source files to inspect and reuse

### H-ANIMUI — Animation, paths, easing and keyframe controls

- `hyperframes-main/packages/studio/src/components/editor/GsapAnimationSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/MotionPathOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/EaseCurveSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/KeyframeNavigation.tsx`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

## Proposed target files / areas

- `packages/diagram-motion/src/bindings.ts`
- `packages/diagram-motion/src/trackModel.ts`

## Implementation requirements

1. Persist track IDs, semantic targets, intent type, start/duration and editable property capabilities.
2. Route supported edits back to story intent; do not parse arbitrary generated DOM to guess ownership.
3. Reject unsupported easing/property edits explicitly and preserve native GSAP editing for unmanaged content.

## Acceptance criteria

- [ ] Editing an edge track changes the intended relationship only.
- [ ] A regenerated scene retains track identity when the semantic target survives.
- [ ] The UI can query edit capabilities before presenting controls.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-046.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test track rename, duration edit and an invalid semantic target.
- Test two scenes using the same node with different animations.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-046/result.json`
- `evidence/tickets/AFM-046/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-047 — Validate multi-instance scenes and mixed native compositions

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-040, AFM-044, AFM-046

## Outcome

Exercise interaction defects before the UI relies on managed scenes.

## Source files to inspect and reuse

### H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts`
- `hyperframes-main/packages/parsers/src/compositionContract.ts`
- `hyperframes-main/packages/parsers/src/composition.ts`
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts`

### H-PARSER — DOM identities, GSAP and roundtrip editing

- `hyperframes-main/packages/parsers/src/hfIds.ts`
- `hyperframes-main/packages/parsers/src/hfIdAssignment.ts`
- `hyperframes-main/packages/parsers/src/gsapParser.ts`
- `hyperframes-main/packages/parsers/src/gsapSerialize.ts`
- `hyperframes-main/packages/parsers/src/htmlParser.ts`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

## Proposed target files / areas

- `packages/diagram-motion/src/validateComposition.ts`
- `tests/fixtures/mixed-project/`

## Implementation requirements

1. Validate ownership metadata, unique IDs, scoped styles, nested timing and semantic bindings across the entire project.
2. Build a fixture containing two copies of the same diagram, a native title, media and a transition.
3. Preserve ordinary composition variables and metadata while treating generated regions as managed.

## Acceptance criteria

- [ ] All references resolve across mixed and nested scenes.
- [ ] Native title styles, selections and transitions still behave correctly.
- [ ] A duplicate render ID or stale binding fails compilation with scene context.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-047.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Inject a duplicate SVG ID and a cross-scene CSS leak.
- Render overlapping differently themed diagrams and inspect frames.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-047/result.json`
- `evidence/tickets/AFM-047/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-048 — Implement managed regeneration and binding conflict reports

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-026, AFM-039, AFM-046

## Outcome

Rebuild only owned output while preserving valid authoring intent.

## Source files to inspect and reuse

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/diagram-motion/src/regenerate.ts`
- `packages/diagram-motion/src/conflicts.ts`

## Implementation requirements

1. Recompile changed diagram documents and dependent scenes from immutable source revisions.
2. Reapply valid presentation settings by semantic identity and scene ID; collect missing targets, incompatible properties and stale-base conflicts.
3. Keep conflicting intent recoverable and block publishing a falsely complete regeneration.

## Acceptance criteria

- [ ] Label edits update all scene appearances without dropping unrelated overrides.
- [ ] Removing an animated edge produces a visible orphan conflict.
- [ ] Reordering arrays cannot silently move an override to a different object.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-048.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test rename, deletion, reordered parallel edges and two simultaneous regenerations.
- Test an invalid override and verify the last valid build remains available.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-048/result.json`
- `evidence/tickets/AFM-048/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-049 — Enforce asset readiness and offline frame capture

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-039, AFM-023, AFM-042

## Outcome

Prevent captures with missing fonts, late images or mid-render fetches.

## Source files to inspect and reuse

### H-FONTS — Font readiness and localization code (not binary redistribution)

- `hyperframes-main/packages/producer/src/services/deterministicFonts.ts`
- `hyperframes-main/packages/cli/src/fontLocalize.ts`
- `hyperframes-main/packages/studio-server/src/routes/fonts.ts`
- `hyperframes-main/packages/cli/src/capture/captureFontValidation.ts`

### H-ASSETS — Media validation, probing and asset resolution

- `hyperframes-main/packages/studio-server/src/routes/media.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaMetadata.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaValidation.ts`
- `hyperframes-main/packages/parsers/src/assetResolution.ts`
- `hyperframes-main/packages/parsers/src/assetPaths.ts`

### H-PRODUCER — Retained render pipeline

- `hyperframes-main/packages/producer/src/index.ts`
- `hyperframes-main/packages/producer/src/renderRequest.ts`
- `hyperframes-main/packages/producer/src/services/renderOrchestrator.ts`
- `hyperframes-main/packages/producer/src/services/compilationRunner.ts`

## Proposed target files / areas

- `packages/diagram-motion/src/readiness.ts`
- `packages/diagram-motion/src/assetManifest.ts`

## Implementation requirements

1. Resolve approved assets before frame zero and emit readiness metadata for the retained runtime/producer gates.
2. Verify content hashes, image decode and font readiness with finite timeouts.
3. Record unavailable assets as blocking errors unless an explicit approved fallback is persisted into the build.

## Acceptance criteria

- [ ] No frame captures while required assets are unresolved.
- [ ] Reopening an offline project uses approved local bytes, not expiring remote URLs.
- [ ] A readiness timeout reports the exact missing asset and does not return a successful render.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-049.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test delayed font/image load, rejected asset and network-disabled rendering.
- Verify two render workers use identical pinned asset hashes.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-049/result.json`
- `evidence/tickets/AFM-049/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-050 — Create an arbitrary-seek conformance harness

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E05 — Native diagram scenes and deterministic motion  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-042, AFM-043, AFM-044, AFM-047, AFM-049

## Outcome

Prove correctness beyond a single uninterrupted playback demonstration.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-CAPTURE — Frame capture and encoding

- `hyperframes-main/packages/engine/src/services/frameCapture.ts`
- `hyperframes-main/packages/engine/src/services/chunkEncoder.ts`
- `hyperframes-main/packages/engine/src/services/streamingEncoder.ts`
- `hyperframes-main/packages/engine/src/utils/renderProvenance.ts`

## Proposed target files / areas

- `tests/integration/diagram-motion-conformance.test.ts`
- `tools/quality/compareFrames.ts`

## Implementation requirements

1. Capture a canonical frame set and replay randomized, repeated, descending and boundary seeks in the same pinned environment.
2. Compare DOM state and images using explicit documented tolerances; use exact semantic state checks and pixel comparisons where stable.
3. Include branched paths, overlapping instances, captions and camera transitions without claiming byte-identical encoded video across machines.

## Acceptance criteria

- [ ] Every selected timestamp is independent of visit order.
- [ ] End-state cleanup does not destroy earlier-frame correctness.
- [ ] Report dimensions, frame rate, browser/encoder versions and any tolerance used.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-050.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run at least start/middle/end, all scene boundaries and a seeded random frame sample.
- Add a deliberately stateful animation and verify the harness fails.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-050/result.json`
- `evidence/tickets/AFM-050/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E06 — One API, preview and production job system

# AFM-051 — Extend the existing Studio API with project commands

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-019, AFM-020, AFM-024, AFM-027

## Outcome

Expose one service boundary for diagram, story and native-composition mutations.

## Source files to inspect and reuse

### H-SERVER — Existing API host and project resolution

- `hyperframes-main/packages/studio-server/src/createStudioApi.ts`
- `hyperframes-main/packages/studio-server/src/types.ts`
- `hyperframes-main/packages/studio-server/src/routes/projects.ts`
- `hyperframes-main/packages/cli/src/server/studioServer.ts`

### H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts`
- `hyperframes-main/packages/studio-server/src/routes/preview.ts`
- `hyperframes-main/packages/studio-server/src/routes/lint.ts`
- `hyperframes-main/packages/studio-server/src/routes/selection.ts`

## Proposed target files / areas

- `packages/studio-server/src/routes/projectCommands.ts`
- `packages/studio-server/src/types.ts`
- `packages/studio-server/src/createStudioApi.ts`

## Implementation requirements

1. Extend StudioApiAdapter and createStudioApi rather than starting a second application backend.
2. Mount revision-aware command endpoints with structured validation errors, idempotency and expectedRevision enforcement.
3. Resolve project IDs through authorized roots; keep engine/evidence execution on server/worker side.

## Acceptance criteria

- [ ] The same command validator serves UI, CLI and agent requests.
- [ ] Unknown project IDs cannot become arbitrary filesystem paths.
- [ ] Failed commands return no committed partial revision.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-051.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- HTTP-test valid rename, invalid edge and stale revision.
- Verify an attempted absolute-path project ID is rejected.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-051/result.json`
- `evidence/tickets/AFM-051/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-052 — Add diagram import, compile, inspect and compare endpoints

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-051, AFM-029, AFM-037, AFM-038, AFM-022

## Outcome

Make engine capabilities usable within the single application.

## Source files to inspect and reuse

### H-SERVER — Existing API host and project resolution

- `hyperframes-main/packages/studio-server/src/createStudioApi.ts`
- `hyperframes-main/packages/studio-server/src/types.ts`
- `hyperframes-main/packages/studio-server/src/routes/projects.ts`
- `hyperframes-main/packages/cli/src/server/studioServer.ts`

### H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts`
- `hyperframes-main/packages/studio-server/src/routes/preview.ts`
- `hyperframes-main/packages/studio-server/src/routes/lint.ts`
- `hyperframes-main/packages/studio-server/src/routes/selection.ts`

### A-DELTA — Before/after receipts and geometry

- `archify-main/archify/delta/architecture-delta.mjs`
- `archify-main/archify/test/architecture-delta.test.mjs`
- `archify-main/archify/examples/checkout-platform.base.architecture.json`
- `archify-main/archify/examples/checkout-platform.head.architecture.json`

## Proposed target files / areas

- `packages/studio-server/src/routes/diagrams.ts`

## Implementation requirements

1. Add authorized import/validate/compile/inspect/compare routes using owned library APIs.
2. Return source revision, semantic index, artifact URL/hash and diagnostics with each result.
3. Prevent long compile work from blocking unrelated requests using bounded job/execution limits and cancellation.

## Acceptance criteria

- [ ] No route shells out to a global upstream executable.
- [ ] Compare results pin both exact source revisions.
- [ ] Invalid JSON or unsupported kinds fail before creating a project document.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-052.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run architecture and all-family compile API fixtures.
- Test cancellation, oversized payload and missing evidence root.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-052/result.json`
- `evidence/tickets/AFM-052/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-053 — Integrate file watchers, external edits and revision events

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-020, AFM-026, AFM-051

## Outcome

Handle edits from coding tools without silently overwriting Studio work.

## Source files to inspect and reuse

### H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts`
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts`
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts`
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/studio-server/src/projectEvents.ts`
- `packages/cli/src/server/fileWatcher.ts`

## Implementation requirements

1. Detect authoring-file changes, validate them into a proposed revision and compare against current committed state.
2. Distinguish generated-output edits from source edits; surface generated-file conflicts or explicit detachment instead of importing them as architecture truth.
3. Emit revision/build/diagnostic events and debounce self-generated changes without suppressing external edits.

## Acceptance criteria

- [ ] An external edit during unsaved UI work produces a resolvable conflict.
- [ ] File-watch feedback loops do not produce repeated revisions.
- [ ] Event payloads include the exact revision used by the preview.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-053.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test editor save, atomic file replacement and rapid successive external writes.
- Test manual edits to generated SVG/HTML and confirm they cannot bypass ownership.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-053/result.json`
- `evidence/tickets/AFM-053/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-054 — Run immutable mixed-project renders through the producer

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-026, AFM-047, AFM-049, AFM-051

## Outcome

Render owned diagram scenes and ordinary video content using the retained production pipeline.

## Source files to inspect and reuse

### H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`

### H-PRODUCER — Retained render pipeline

- `hyperframes-main/packages/producer/src/index.ts`
- `hyperframes-main/packages/producer/src/renderRequest.ts`
- `hyperframes-main/packages/producer/src/services/renderOrchestrator.ts`
- `hyperframes-main/packages/producer/src/services/compilationRunner.ts`

### H-CAPTURE — Frame capture and encoding

- `hyperframes-main/packages/engine/src/services/frameCapture.ts`
- `hyperframes-main/packages/engine/src/services/chunkEncoder.ts`
- `hyperframes-main/packages/engine/src/services/streamingEncoder.ts`
- `hyperframes-main/packages/engine/src/utils/renderProvenance.ts`

## Proposed target files / areas

- `packages/studio-server/src/services/projectRender.ts`
- `packages/studio-server/src/routes/render.ts`

## Implementation requirements

1. Freeze project/build/asset hashes into a job input and emit a standard composition project in a bounded workspace.
2. Call the existing producer job APIs and track queued/running/failed/cancelled/succeeded states.
3. Probe and validate output files before declaring success; preserve render manifest and diagnostics.

## Acceptance criteria

- [ ] An actual MP4 from a mixed native/architecture project is produced and viewed.
- [ ] Editing the project during rendering does not change the running job's inputs.
- [ ] A missing output file or failed probe cannot be reported as success.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-054.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Render a native title plus deployment scene and inspect first/middle/final frames.
- Mutate the authoring project during render and verify pinned input hashes stay fixed.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-054/result.json`
- `evidence/tickets/AFM-054/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-055 — Implement render cancellation, retries and artifact lifecycle

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-054

## Outcome

Keep long jobs recoverable without orphaned processes or misleading status.

## Source files to inspect and reuse

### H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`

### H-PROCESS — Worker lifecycle, resource and process tracking

- `hyperframes-main/packages/engine/src/utils/managedChildProcess.ts`
- `hyperframes-main/packages/engine/src/utils/processTracker.ts`
- `hyperframes-main/packages/engine/src/services/browserManager.ts`
- `hyperframes-main/packages/engine/src/services/systemMemory.ts`

## Proposed target files / areas

- `packages/studio-server/src/services/renderJobLifecycle.ts`
- `packages/studio-server/src/routes/render.ts`

## Implementation requirements

1. Cancel browser/encoder work and clean temporary artifacts while preserving completed receipts.
2. Retry only immutable inputs with bounded attempts and a new attempt identifier; avoid duplicate success artifacts.
3. Define restart recovery, progress semantics, output retention and user-triggered cleanup.

## Acceptance criteria

- [ ] Cancelled jobs reach a terminal cancelled state and release owned resources.
- [ ] A server restart marks abandoned work truthfully and offers retry, not fabricated completion.
- [ ] Progress cannot reach successful completion before final output validation.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-055.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test cancellation during compilation, frame capture and encoding.
- Test process crash, retry and repeated cancel requests.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-055/result.json`
- `evidence/tickets/AFM-055/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-056 — Serve revision-correct previews and thumbnails

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-026, AFM-049, AFM-051

## Outcome

Show the same compiled source in preview that the render job will use.

## Source files to inspect and reuse

### H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts`
- `hyperframes-main/packages/studio-server/src/routes/preview.ts`
- `hyperframes-main/packages/studio-server/src/routes/lint.ts`
- `hyperframes-main/packages/studio-server/src/routes/selection.ts`

### H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`

### H-PLAYER — Player and slideshow compatibility

- `hyperframes-main/packages/player/src/hyperframes-player.ts`
- `hyperframes-main/packages/player/src/slideshow/hyperframes-slideshow.ts`
- `hyperframes-main/packages/player/src/runtime-message-handler.ts`
- `hyperframes-main/packages/player/src/media-element-guards.ts`

## Proposed target files / areas

- `packages/studio-server/src/services/projectPreview.ts`
- `packages/studio-server/src/routes/preview.ts`
- `packages/studio-server/src/routes/thumbnail.ts`

## Implementation requirements

1. Key preview and thumbnail caches by build/scene/output settings instead of filename alone.
2. Publish validated builds atomically and discard out-of-date compilation completions.
3. Preserve the playhead and semantic selection when compatible while surfacing build conflicts and missing assets.

## Acceptance criteria

- [ ] A slow old compile cannot replace a newer scene in the editor.
- [ ] Thumbnail content matches its displayed source revision.
- [ ] Preview failures leave a clearly labeled last-valid view, not an apparently current stale scene.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-056.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test rapid diagram edits with reversed compile completion order.
- Compare a thumbnail frame with the same timestamp in actual producer output.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-056/result.json`
- `evidence/tickets/AFM-056/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-057 — Enforce managed ownership on every mutation ingress

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-019, AFM-051, AFM-053, AFM-039

## Outcome

Prevent raw APIs and SDK paths from bypassing semantic source validation.

## Source files to inspect and reuse

### H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts`
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts`
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts`
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts`

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

### H-TOOLS — Studio agent tool registration and write coordination

- `hyperframes-main/packages/studio/src/webmcp/StudioAgentTools.tsx`
- `hyperframes-main/packages/studio/src/webmcp/registrar.ts`
- `hyperframes-main/packages/studio/src/webmcp/writeCoordinator.ts`
- `hyperframes-main/packages/studio/src/webmcp/tools/contentTools.ts`

## Proposed target files / areas

- `packages/studio-server/src/services/mutationPolicy.ts`
- `packages/studio-server/src/helpers/sourceMutation.ts`

## Implementation requirements

1. Classify compiler-owned nodes, edges and labels versus presentation-owned and ordinary native elements.
2. Intercept file writes, storyboard edits, SDK patches and agent mutations; route supported semantic operations to project commands.
3. Permit explicit scene detachment with impact disclosure and preserved source snapshot; block untracked generated-file writes.

## Acceptance criteria

- [ ] A raw API edit to a generated node label cannot silently persist outside diagram source.
- [ ] Native HTML editing remains available and unchanged for unmanaged content.
- [ ] All rejected operations produce actionable capability/error responses.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-057.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Attempt equivalent unauthorized writes through UI, file API, SDK and agent tool.
- Detach one scene and verify only that scene becomes native editable content.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-057/result.json`
- `evidence/tickets/AFM-057/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-058 — Verify API consistency, errors and recovery contracts

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E06 — One API, preview and production job system  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-051, AFM-052, AFM-053, AFM-054, AFM-055, AFM-056, AFM-057

## Outcome

Lock the shared backend behavior before broad UI adoption.

## Source files to inspect and reuse

### H-SERVER — Existing API host and project resolution

- `hyperframes-main/packages/studio-server/src/createStudioApi.ts`
- `hyperframes-main/packages/studio-server/src/types.ts`
- `hyperframes-main/packages/studio-server/src/routes/projects.ts`
- `hyperframes-main/packages/cli/src/server/studioServer.ts`

### H-PERSIST — SDK persistence and project file writes

- `hyperframes-main/packages/sdk/src/persist-queue.ts`
- `hyperframes-main/packages/sdk/src/adapters/fs.ts`
- `hyperframes-main/packages/studio-server/src/helpers/backupJournal.ts`
- `hyperframes-main/packages/studio-server/src/helpers/fileVersion.ts`

### H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`

## Proposed target files / areas

- `tests/integration/project-api.test.ts`
- `docs/api/project-commands.md`

## Implementation requirements

1. Write route contracts and executable tests for command idempotency, validation, conflicts, event ordering and job state transitions.
2. Fault-inject storage, compile and encoder failures and prove the last committed state remains intact.
3. Document exact error codes/statuses and authorized-root behavior for local mode.

## Acceptance criteria

- [ ] No success response is emitted for an uncommitted edit or missing rendered artifact.
- [ ] CLI/UI clients can recover from revision conflicts without guessing.
- [ ] Logs redact private evidence and provider credentials.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-058.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run concurrent-client, crash-recovery and cancellation scenarios.
- Validate route responses against the shared schemas and inspect error logs for secrets.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-058/result.json`
- `evidence/tickets/AFM-058/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E07 — Fully integrated Studio editing experience

# AFM-059 — Add unified project onboarding and open/import flows

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-022, AFM-051, AFM-056

## Outcome

Open diagram and native-video work in one Studio project lifecycle.

## Source files to inspect and reuse

### H-SHELL — Application shell, project browser and panels

- `hyperframes-main/packages/studio/src/App.tsx`
- `hyperframes-main/packages/studio/src/components/EditorShell.tsx`
- `hyperframes-main/packages/studio/src/components/StudioLeftSidebar.tsx`
- `hyperframes-main/packages/studio/src/components/StudioRightPanel.tsx`
- `hyperframes-main/packages/studio/src/components/StudioHeader.tsx`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

## Proposed target files / areas

- `packages/studio/src/project/ProjectProvider.tsx`
- `packages/studio/src/project/ProjectLauncher.tsx`
- `packages/studio/src/App.tsx`

## Implementation requirements

1. Add create/open/import actions for raw diagram JSON, existing native projects and unified projects.
2. Display migration previews and resolve name/manifest collisions without replacing originals.
3. Introduce shared committed/draft/build revision state into the existing app shell, not a second embedded application.

## Acceptance criteria

- [ ] A user can create a mixed project without using a separate Archify app.
- [ ] Reopening restores project references, media and story order.
- [ ] Failed imports leave the existing project usable.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-059.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- UI-test blank creation, diagram import and native-project migration.
- Test permission denial, invalid JSON and an existing project name collision.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-059/result.json`
- `evidence/tickets/AFM-059/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-060 — Implement document outline and diagram-aware scene browser

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-059, AFM-018, AFM-056

## Outcome

Show source documents, semantic objects and their scene appearances together.

## Source files to inspect and reuse

### H-SHELL — Application shell, project browser and panels

- `hyperframes-main/packages/studio/src/App.tsx`
- `hyperframes-main/packages/studio/src/components/EditorShell.tsx`
- `hyperframes-main/packages/studio/src/components/StudioLeftSidebar.tsx`
- `hyperframes-main/packages/studio/src/components/StudioRightPanel.tsx`
- `hyperframes-main/packages/studio/src/components/StudioHeader.tsx`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/DiagramOutline.tsx`
- `packages/studio/src/diagrams/SceneBrowser.tsx`

## Implementation requirements

1. Extend the existing sidebar with typed diagrams, objects, groups, guided views and scene instances.
2. Show source/build revision, diagnostics, references and orphaned presentation targets.
3. Keep native file/layer browsing available; distinguish managed scene output from editable authoring source.

## Acceptance criteria

- [ ] The same node appearing in two scenes is shown as one semantic object with two appearances.
- [ ] Broken references are visible and navigable.
- [ ] Large outlines are searchable and do not freeze the editor.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-060.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test multiple scenes, removed object and filtered search.
- Verify keyboard navigation and stable expansion state after regeneration.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-060/result.json`
- `evidence/tickets/AFM-060/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-061 — Unify selection between canvas, inspector and timeline

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-060, AFM-046, AFM-056

## Outcome

Select the same underlying object consistently throughout the product.

## Source files to inspect and reuse

### H-GESTURE — Canvas transforms, hit-testing and DOM mutation

- `hyperframes-main/packages/studio/src/components/editor/DomEditOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/domEditing.ts`
- `hyperframes-main/packages/studio/src/components/editor/groupDragMove.ts`
- `hyperframes-main/packages/sdk/src/adapters/iframe.ts`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts`
- `hyperframes-main/packages/studio-server/src/routes/preview.ts`
- `hyperframes-main/packages/studio-server/src/routes/lint.ts`
- `hyperframes-main/packages/studio-server/src/routes/selection.ts`

## Proposed target files / areas

- `packages/studio/src/diagrams/selectionBridge.ts`
- `packages/studio/src/project/selection.ts`

## Implementation requirements

1. Translate preview render IDs into document/object/scene-instance identities using compiled bindings.
2. Synchronize selection into inspector, timeline and agent selection endpoint without recursive event loops.
3. Handle multi-selection, nested groups and a target removed by a later revision.

## Acceptance criteria

- [ ] Clicking an edge selects its actual relationship and corresponding animation tracks.
- [ ] Two appearances of a node retain scene-specific selection context.
- [ ] Camera/zoom transforms do not offset hit-testing.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-061.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test selection from all three surfaces and through deep links.
- Test zoomed/nested scene hit-testing and selection survival after a label edit.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-061/result.json`
- `evidence/tickets/AFM-061/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-062 — Add schema-aware semantic property editing

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-061, AFM-051, AFM-057, AFM-029

## Outcome

Edit real diagram data rather than mutating generated SVG text.

## Source files to inspect and reuse

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

## Proposed target files / areas

- `packages/studio/src/diagrams/SemanticInspector.tsx`
- `packages/studio/src/diagrams/fieldAdapters.ts`

## Implementation requirements

1. Provide type-aware forms for supported labels, metadata, groups, relationship labels and source references.
2. Submit validated project commands with expectedRevision and show field-level diagnostics.
3. Keep invalid in-progress drafts separate from committed source and regenerated previews.

## Acceptance criteria

- [ ] A renamed component updates every managed scene using its source document.
- [ ] Invalid field values cannot be saved through a direct generated-DOM edit.
- [ ] Inspector shows pending/failed/saved state accurately.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-062.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test label edit, invalid required value and stale revision.
- Save/reopen and compare source JSON with rendered labels.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-062/result.json`
- `evidence/tickets/AFM-062/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-063 — Create guided-view scenes and render the first vertical slice

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-059, AFM-062, AFM-045, AFM-054, AFM-042

## Outcome

Deliver a complete early workflow through the same application.

## Source files to inspect and reuse

### H-SHELL — Application shell, project browser and panels

- `hyperframes-main/packages/studio/src/App.tsx`
- `hyperframes-main/packages/studio/src/components/EditorShell.tsx`
- `hyperframes-main/packages/studio/src/components/StudioLeftSidebar.tsx`
- `hyperframes-main/packages/studio/src/components/StudioRightPanel.tsx`
- `hyperframes-main/packages/studio/src/components/StudioHeader.tsx`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

## Proposed target files / areas

- `packages/studio/src/diagrams/GuidedViewSceneAction.tsx`
- `tests/e2e/architecture-slice.spec.ts`

## Implementation requirements

1. Let a user create scenes from validated guided views and edit their duration in the timeline.
2. Add a native title, rename a source component, preview an authored edge reveal and save/reopen.
3. Export through the existing render UI and attach real artifact/probe/frame evidence.

## Acceptance criteria

- [ ] Import -> semantic edit -> scene creation -> backward scrub -> save/reopen -> real video works in one Studio.
- [ ] The gateway branch remains semantically correct.
- [ ] No screenshot importer or separate bridge application is used.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-063.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Automate the complete flow with the provided deployment example.
- Inspect the actual MP4 dimensions, fps, duration and nonblank diagram frames.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-063/result.json`
- `evidence/tickets/AFM-063/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-064 — Implement schema-valid node and relationship creation/deletion

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-062, AFM-018, AFM-019, AFM-057

## Outcome

Allow meaningful structural editing with explicit impact handling.

## Source files to inspect and reuse

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-GESTURE — Canvas transforms, hit-testing and DOM mutation

- `hyperframes-main/packages/studio/src/components/editor/DomEditOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/domEditing.ts`
- `hyperframes-main/packages/studio/src/components/editor/groupDragMove.ts`
- `hyperframes-main/packages/sdk/src/adapters/iframe.ts`

## Proposed target files / areas

- `packages/studio/src/diagrams/GraphActions.tsx`
- `packages/project-model/src/commands/diagramObjects.ts`

## Implementation requirements

1. Add object creation, duplication and deletion via type-specific factories with stable IDs.
2. Add relationship creation with endpoint validation and support for distinct parallel edges; preserve authored direction.
3. Before deletion, report affected edges, views, tracks and evidence; require an explicit remove/repair/cancel policy.

## Acceptance criteria

- [ ] Deletion cannot silently leave dangling references or retarget an animation.
- [ ] Duplicating an object creates a new identity and does not copy accidental external bindings.
- [ ] All structural edits participate in shared undo.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-064.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test add service/add edge/delete used node/cancel deletion.
- Test parallel edges, duplicate IDs and a stale impact report.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-064/result.json`
- `evidence/tickets/AFM-064/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-065 — Implement editable layout, grouping and drag gestures

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-062, AFM-064, AFM-029, AFM-030

## Outcome

Make diagram movement persistent without untracked SVG transforms.

## Source files to inspect and reuse

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

### H-GESTURE — Canvas transforms, hit-testing and DOM mutation

- `hyperframes-main/packages/studio/src/components/editor/DomEditOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/domEditing.ts`
- `hyperframes-main/packages/studio/src/components/editor/groupDragMove.ts`
- `hyperframes-main/packages/sdk/src/adapters/iframe.ts`

## Proposed target files / areas

- `packages/studio/src/diagrams/LayoutEditor.tsx`
- `packages/project-model/src/commands/layout.ts`

## Implementation requirements

1. Convert gestures into schema-supported positions/layout hints or an explicitly versioned layout sidecar where a type lacks direct coordinates.
2. Reuse route/layout validation and preserve group membership and edge clearance.
3. Separate source-layout changes from scene camera movement and collapse a gesture into one history action.

## Acceptance criteria

- [ ] Committed placement survives regenerate/reopen/render.
- [ ] Invalid overlap/routing is surfaced with a recoverable diagnostic instead of corrupt geometry.
- [ ] Canceling a drag restores the original source.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-065.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test group move, node resize/reflow and lane membership changes.
- Test escape/cancel, undo and concurrent source edit during a drag.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-065/result.json`
- `evidence/tickets/AFM-065/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-066 — Add guided-view, route and evidence authoring panels

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-062, AFM-036, AFM-037, AFM-045

## Outcome

Expose Archify explanatory features inside the unified Studio.

## Source files to inspect and reuse

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

### A-EVID — Source references and engineering metadata

- `archify-main/archify/renderers/shared/repository-evidence.mjs`
- `archify-main/archify/renderers/shared/repository-location.mjs`
- `archify-main/archify/renderers/shared/engineering-profiles.mjs`
- `archify-main/archify/test/repository-evidence.test.mjs`

### A-REACH — Authored graph inspection and sharing

- `archify-main/archify/test/authored-reachability.test.mjs`
- `archify-main/archify/test/route-probe.test.mjs`
- `archify-main/archify/test/relationship-direct-explorer.test.mjs`
- `archify-main/archify/test/relationship-permalink.test.mjs`
- `archify-main/archify/test/reach-share-card.test.mjs`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/GuidedViewEditor.tsx`
- `packages/studio/src/diagrams/EvidenceInspector.tsx`

## Implementation requirements

1. Edit view titles/focus lists with live ID validation and explicit route selection.
2. Show authored reach/relationship inspection and pinned source evidence in the same inspector.
3. Provide redaction controls for public presentation and distinguish inferred narration from verified source facts.

## Acceptance criteria

- [ ] View edits update scene draft options without overwriting unrelated timing choices.
- [ ] Disconnected focus objects never imply automatic traffic.
- [ ] Private evidence stays private after public export.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-066.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test view reorder, missing focus and parallel route choice.
- Test stale repository evidence and hidden private path redaction.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-066/result.json`
- `evidence/tickets/AFM-066/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-067 — Add diagram-aware timeline lanes and trim/reorder controls

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-061, AFM-046, AFM-025, AFM-051

## Outcome

Edit scene, camera, node and relationship timing using meaningful tracks.

## Source files to inspect and reuse

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

### H-ANIMUI — Animation, paths, easing and keyframe controls

- `hyperframes-main/packages/studio/src/components/editor/GsapAnimationSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/MotionPathOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/EaseCurveSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/KeyframeNavigation.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/DiagramTimelineTracks.tsx`
- `packages/studio/src/player/components/Timeline.tsx`

## Implementation requirements

1. Display semantic names/icons and scene-instance context over the existing timeline primitives.
2. Route trim/move/reorder operations through story commands with integer frame snapping and media-bound checks.
3. Preserve native clip editing and represent unsupported computed animation edits honestly.

## Acceptance criteria

- [ ] Moving a diagram clip shifts its supported local animations consistently.
- [ ] Invalid overlap/duration cannot silently produce out-of-range animation.
- [ ] Undo restores scene order and timing together.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-067.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test drag, trim, duplicate scene and track selection.
- Test fractional-rate snapping and nested scene boundaries.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-067/result.json`
- `evidence/tickets/AFM-067/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-068 — Expose camera, emphasis, edge and callout animation controls

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-067, AFM-042, AFM-043, AFM-046, AFM-057

## Outcome

Customize diagrams as video scenes without handing agents arbitrary semantic DOM writes.

## Source files to inspect and reuse

### H-ANIMUI — Animation, paths, easing and keyframe controls

- `hyperframes-main/packages/studio/src/components/editor/GsapAnimationSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/MotionPathOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/EaseCurveSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/KeyframeNavigation.tsx`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/MotionInspector.tsx`
- `packages/studio/src/diagrams/CameraControls.tsx`

## Implementation requirements

1. Add capability-driven controls for camera focus, fades, node emphasis, authored-edge reveal and presentation callouts.
2. Bind easing/duration edits to supported animation intents and preserve explicit local-time semantics.
3. Preview changes as draft intents and commit one project transaction on confirmation.

## Acceptance criteria

- [ ] An edge animation requires a real relationship ID.
- [ ] Presentation colors/callouts do not change diagram source facts.
- [ ] Unsupported GSAP operations are explained, not silently approximated.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-068.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test each supported intent with preview and actual frame capture.
- Attempt fabricated-edge and compiler-owned-label animation edits and verify rejection.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-068/result.json`
- `evidence/tickets/AFM-068/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-069 — Integrate source editing, diagnostics and safe scene detachment

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-057, AFM-053, AFM-062

## Outcome

Keep code editing powerful without creating a hidden second source of truth.

## Source files to inspect and reuse

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/ManagedSourceEditor.tsx`
- `packages/studio/src/diagrams/DetachSceneDialog.tsx`

## Implementation requirements

1. Open authoritative diagram/story JSON with schema diagnostics; show generated HTML/SVG as read-only managed output by default.
2. Route valid manual source changes through the same revision/command boundary.
3. Provide explicit detach-to-native operation with backup, identity remapping and warning that future diagram updates no longer propagate.

## Acceptance criteria

- [ ] Manual JSON edits are validated before becoming committed state.
- [ ] Detaching one scene leaves other instances managed.
- [ ] Raw generated-file modifications are detected and surfaced.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-069.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test invalid JSON draft, valid source edit and external generated-file change.
- Detach, freely edit, undo detachment and verify source/presentation consistency.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-069/result.json`
- `evidence/tickets/AFM-069/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-070 — Add truthful save, regeneration, conflict and job UX

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-059, AFM-053, AFM-055, AFM-048

## Outcome

Make failures and stale views visible instead of silently losing work.

## Source files to inspect and reuse

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

### H-SHELL — Application shell, project browser and panels

- `hyperframes-main/packages/studio/src/App.tsx`
- `hyperframes-main/packages/studio/src/components/EditorShell.tsx`
- `hyperframes-main/packages/studio/src/components/StudioLeftSidebar.tsx`
- `hyperframes-main/packages/studio/src/components/StudioRightPanel.tsx`
- `hyperframes-main/packages/studio/src/components/StudioHeader.tsx`

## Proposed target files / areas

- `packages/studio/src/project/SaveStatus.tsx`
- `packages/studio/src/project/ConflictPanel.tsx`
- `packages/studio/src/project/RenderJobs.tsx`

## Implementation requirements

1. Display draft, saving, saved, conflict, rebuilding and last-valid-preview states with exact revisions.
2. Surface orphan overrides, external edit conflicts and disk/permission errors with recoverable intent.
3. Add cancel/retry/open-output controls for render jobs and never equate progress with success.

## Acceptance criteria

- [ ] An unresolved conflict cannot be labeled fully synchronized or ready for release.
- [ ] A failed save leaves the user's draft recoverable.
- [ ] Rendering continues against its pinned revision while new edits are clearly separate.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-070.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test disk-full save, removed-target conflict and failed encoder.
- Restart the app with pending work and verify truthful recovery status.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-070/result.json`
- `evidence/tickets/AFM-070/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-071 — Complete Studio accessibility and keyboard interaction

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E07 — Fully integrated Studio editing experience  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-060, AFM-061, AFM-062, AFM-067, AFM-070

## Outcome

Make the unified editor usable without relying exclusively on mouse gestures or color.

## Source files to inspect and reuse

### H-SHELL — Application shell, project browser and panels

- `hyperframes-main/packages/studio/src/App.tsx`
- `hyperframes-main/packages/studio/src/components/EditorShell.tsx`
- `hyperframes-main/packages/studio/src/components/StudioLeftSidebar.tsx`
- `hyperframes-main/packages/studio/src/components/StudioRightPanel.tsx`
- `hyperframes-main/packages/studio/src/components/StudioHeader.tsx`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

### A-THEME — Brand registry, locale and presets

- `archify-main/archify/renderers/shared/brand-marks.mjs`
- `archify-main/archify/renderers/shared/generated-brand-marks.mjs`
- `archify-main/archify/renderers/shared/i18n.mjs`
- `archify-main/archify/test/preset-tryon.test.mjs`
- `archify-main/archify/test/i18n.test.mjs`

## Proposed target files / areas

- `packages/studio/src/diagrams/a11y.ts`
- `tests/e2e/diagram-keyboard.spec.ts`

## Implementation requirements

1. Add focus management, labeled controls, semantic outline navigation and keyboard selection/edit/undo operations.
2. Preserve locale strings and distinguish editor reduced-motion preferences from exported story timing.
3. Verify narrow-window panel behavior, readable diagnostics and non-color conflict indicators.

## Acceptance criteria

- [ ] Core import/select/edit/create-scene/export actions are keyboard accessible.
- [ ] A dialog restores focus to its invoking control.
- [ ] Diagram/video preview time is not altered by UI reduced-motion preference.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-071.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run automated accessibility checks plus manual keyboard walkthrough.
- Test screen-reader labels and clipped panels at supported minimum viewport.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-071/result.json`
- `evidence/tickets/AFM-071/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E08 — Shared history, regeneration and recovery

# AFM-072 — Connect the SDK to project-owned history and persistence

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E08 — Shared history, regeneration and recovery  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-021, AFM-057, AFM-062, AFM-067

## Outcome

Avoid two undo stacks or independent autosave queues mutating the same project.

## Source files to inspect and reuse

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

### H-PERSIST — SDK persistence and project file writes

- `hyperframes-main/packages/sdk/src/persist-queue.ts`
- `hyperframes-main/packages/sdk/src/adapters/fs.ts`
- `hyperframes-main/packages/studio-server/src/helpers/backupJournal.ts`
- `hyperframes-main/packages/studio-server/src/helpers/fileVersion.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/studio/src/project/sdkCommandAdapter.ts`
- `packages/studio/src/hooks/useStudioSdkSessions.ts`

## Implementation requirements

1. Use SDK embedded/host-owned history hooks and inverse patch replay without recursive patch events.
2. Disable autonomous SDK persistence as well as its history where project revisions own writes; history:false alone does not disable SDK persistence.
3. Translate supported SDK operations into project transactions and preserve ordinary native editing capability.

## Acceptance criteria

- [ ] One user edit creates one committed transaction and one undo entry.
- [ ] Undo/redo does not double-apply SDK patches.
- [ ] No SDK autosave can race a project atomic commit.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-072.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test interleaved semantic/native edits followed by undo/redo.
- Instrument write paths and assert a single authoritative persistence owner.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-072/result.json`
- `evidence/tickets/AFM-072/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-073 — Rebase presentation overrides by stable identity

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E08 — Shared history, regeneration and recovery  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-048, AFM-072, AFM-018

## Outcome

Preserve valid customizations after source changes without positional retargeting.

## Source files to inspect and reuse

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/project-model/src/overrideRebase.ts`
- `packages/diagram-motion/src/regenerate.ts`

## Implementation requirements

1. Match overrides by document/object/scene identities and base revisions, not DOM order.
2. Classify conflicts as missing target, incompatible property, identity ambiguity or stale authored baseline.
3. Keep original intent and offer explicit discard/reassign/repair actions with preview and transaction history.

## Acceptance criteria

- [ ] Label/layout edits preserve compatible scene emphasis and callouts.
- [ ] Removed/replaced objects produce conflicts rather than silent loss.
- [ ] User reassignments are recorded and undoable.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-073.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test rename, replacement, reordered parallel edges and a copied scene.
- Rebase conflicting overrides twice and verify no duplication or drift.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-073/result.json`
- `evidence/tickets/AFM-073/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-074 — Handle source deletion, duplication and cross-scene impact

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E08 — Shared history, regeneration and recovery  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-064, AFM-073, AFM-021

## Outcome

Keep references consistent when a semantic change affects many scenes.

## Source files to inspect and reuse

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/project-model/src/impactAnalysis.ts`
- `packages/studio/src/diagrams/ImpactResolution.tsx`

## Implementation requirements

1. Calculate affected relationships, views, tracks, callouts, assets and evidence before committing destructive commands.
2. Apply an explicitly chosen cascade or repair plan atomically, checking expectedRevision again at commit.
3. Preserve scene-local choices when duplicating scenes and mint new instance IDs.

## Acceptance criteria

- [ ] No dangling reference is silently accepted after deletion.
- [ ] Cancel leaves all source and presentation unchanged.
- [ ] Undo restores every affected document and binding.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-074.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test deleting a node used in three scenes and one guided view.
- Test duplicate-scene overrides and stale impact confirmation.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-074/result.json`
- `evidence/tickets/AFM-074/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-075 — Implement external-edit conflict reconciliation

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E08 — Shared history, regeneration and recovery  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-053, AFM-072, AFM-073

## Outcome

Let users and coding agents edit files without last-writer-wins data loss.

## Source files to inspect and reuse

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

### H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts`
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts`
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts`
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts`

## Proposed target files / areas

- `packages/project-model/src/mergeExternal.ts`
- `packages/studio/src/project/ExternalConflictResolver.tsx`

## Implementation requirements

1. Compare external changes with their base revision and local committed/draft state.
2. Auto-merge only disjoint schema-safe operations; present same-field or identity conflicts explicitly.
3. Validate a proposed merged revision before atomic commit and keep both originals recoverable.

## Acceptance criteria

- [ ] A conflicting label edit is not silently overwritten.
- [ ] Nonoverlapping valid changes can be reconciled without losing presentation bindings.
- [ ] Generated output never becomes an implicit merge source for diagram facts.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-075.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test disjoint fields, same field, object deletion versus animation edit.
- Test external file truncation and partial editor save.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-075/result.json`
- `evidence/tickets/AFM-075/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-076 — Add crash recovery, revision restore and retention controls

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E08 — Shared history, regeneration and recovery  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-020, AFM-021, AFM-072, AFM-026

## Outcome

Recover coherent user work after failures and support deliberate restoration.

## Source files to inspect and reuse

### H-PERSIST — SDK persistence and project file writes

- `hyperframes-main/packages/sdk/src/persist-queue.ts`
- `hyperframes-main/packages/sdk/src/adapters/fs.ts`
- `hyperframes-main/packages/studio-server/src/helpers/backupJournal.ts`
- `hyperframes-main/packages/studio-server/src/helpers/fileVersion.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `packages/project-model/src/recovery.ts`
- `packages/studio/src/project/RevisionHistory.tsx`

## Implementation requirements

1. Expose validated committed revision history and restore-as-new-revision operations.
2. Recover interrupted saves and separate recoverable draft data from committed truth.
3. Apply retention only to unreferenced builds/assets with explicit policy; protect active renders and pinned revisions.

## Acceptance criteria

- [ ] Restore never mutates history in place or reuses an old revision counter.
- [ ] Corrupt recovery data is quarantined with a diagnostic.
- [ ] Cleanup cannot delete the inputs of a running render.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-076.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Kill the app during save, reopen and restore a previous revision.
- Test cleanup while a long render references an older revision.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-076/result.json`
- `evidence/tickets/AFM-076/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-077 — Optimize incremental rebuild and stale result cancellation

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E08 — Shared history, regeneration and recovery  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-026, AFM-048, AFM-056, AFM-073

## Outcome

Keep interactive edits responsive while preserving correctness.

## Source files to inspect and reuse

### H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`

### H-PRODUCER — Retained render pipeline

- `hyperframes-main/packages/producer/src/index.ts`
- `hyperframes-main/packages/producer/src/renderRequest.ts`
- `hyperframes-main/packages/producer/src/services/renderOrchestrator.ts`
- `hyperframes-main/packages/producer/src/services/compilationRunner.ts`

## Proposed target files / areas

- `packages/diagram-motion/src/buildScheduler.ts`
- `packages/studio-server/src/services/projectBuilds.ts`

## Implementation requirements

1. Invalidate only affected geometry/scenes and reuse immutable cache entries by exact input hash.
2. Cancel or disregard superseded jobs and coalesce rapid text/gesture edits without losing the final intent.
3. Bound cache size and concurrency; expose instrumentation for compile duration, cache hits and abandoned results.

## Acceptance criteria

- [ ] A presentation headline edit does not rebuild every diagram.
- [ ] The final committed revision is eventually previewed even after a burst of edits.
- [ ] Cache misses and failures never return a stale artifact as current.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-077.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run edit bursts with deliberately reordered completion and cancellation.
- Compare cached and uncached builds for equal semantic output.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-077/result.json`
- `evidence/tickets/AFM-077/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-078 — Prove coherent undo, regeneration and reopen end to end

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E08 — Shared history, regeneration and recovery  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-072, AFM-073, AFM-074, AFM-075, AFM-076, AFM-077, AFM-070

## Outcome

Validate the hardest integration behavior through the actual application.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

## Proposed target files / areas

- `tests/e2e/regeneration-history.spec.ts`

## Implementation requirements

1. Build a mixed project, add scene overrides, rename/add/delete semantic objects, undo/redo and resolve orphan conflicts.
2. Save/reopen between operations and render the resulting revision.
3. Record source diffs, command journal, binding map and real output frames to establish consistency.

## Acceptance criteria

- [ ] Every completed action corresponds to one coherent source/presentation revision.
- [ ] No silent loss, positional retargeting or duplicate history occurs.
- [ ] Actual rendered labels/paths/overrides agree with the reopened source.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-078.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run the full scenario with parallel edges and two instances of one diagram.
- Repeat with an external file edit and a failed save.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-078/result.json`
- `evidence/tickets/AFM-078/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E09 — Assets, narration, captions and native video parity

# AFM-079 — Implement shared media ingestion, deduplication and probing

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-023, AFM-051, AFM-049

## Outcome

Import local media once and make it reliably available to diagram and native scenes.

## Source files to inspect and reuse

### H-ASSETS — Media validation, probing and asset resolution

- `hyperframes-main/packages/studio-server/src/routes/media.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaMetadata.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaValidation.ts`
- `hyperframes-main/packages/parsers/src/assetResolution.ts`
- `hyperframes-main/packages/parsers/src/assetPaths.ts`

### H-PRODUCER — Retained render pipeline

- `hyperframes-main/packages/producer/src/index.ts`
- `hyperframes-main/packages/producer/src/renderRequest.ts`
- `hyperframes-main/packages/producer/src/services/renderOrchestrator.ts`
- `hyperframes-main/packages/producer/src/services/compilationRunner.ts`

## Proposed target files / areas

- `packages/studio-server/src/services/projectAssets.ts`
- `packages/studio/src/project/AssetBrowser.tsx`

## Implementation requirements

1. Validate media bytes/types with bounded probing, hash content and record measured metadata in the asset registry.
2. Reuse existing upload/proxy/waveform facilities with stable asset IDs and safe local paths.
3. Deduplicate storage without conflating independently editable asset metadata or rights records.

## Acceptance criteria

- [ ] Imported assets survive save/reopen and offline playback/render.
- [ ] Unsupported codecs and invalid payloads fail with actionable diagnostics.
- [ ] Replacing media creates a new content revision rather than changing a pinned running job.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-079.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test image, audio and video imports plus false MIME/extension payloads.
- Test duplicate content, missing asset and interrupted ingestion.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-079/result.json`
- `evidence/tickets/AFM-079/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-080 — Integrate narration clips and optional synthesis providers

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-interface  
**Dependencies:** AFM-079, AFM-025, AFM-072

## Outcome

Add editable narration without making a paid upstream service mandatory.

## Source files to inspect and reuse

### H-PROVIDERS — Optional speech, transcription and local model adapters

- `hyperframes-main/packages/cli/src/audio/providers.ts`
- `hyperframes-main/packages/cli/src/commands/tts.ts`
- `hyperframes-main/packages/cli/src/commands/transcribe.ts`
- `hyperframes-main/packages/cli/src/tts/synthesize.ts`
- `hyperframes-main/packages/cli/src/whisper/transcribe.ts`

### H-AUDIO — Audio mixer, timing and effects

- `hyperframes-main/packages/producer/src/services/audioMixer.ts`
- `hyperframes-main/packages/engine/src/services/audioMixer.ts`
- `hyperframes-main/packages/core/src/audioFx.ts`
- `hyperframes-main/packages/engine/src/services/audioVolumeEnvelope.ts`

### H-AUTH — Optional hosted authentication and secret scrubbing

- `hyperframes-main/packages/cli/src/auth/resolver.ts`
- `hyperframes-main/packages/cli/src/auth/store.ts`
- `hyperframes-main/packages/cli/src/auth/scrub.ts`
- `hyperframes-main/packages/cli/src/cloud/auth.ts`

## Proposed target files / areas

- `packages/studio/src/project/NarrationPanel.tsx`
- `packages/studio-server/src/services/narration.ts`

## Implementation requirements

1. Allow local recorded audio first; expose existing supported synthesis adapters only through explicit configuration.
2. Measure generated/recorded output duration and map clips/trims into story timing; show any proposed auto-retiming before commit.
3. Store provider provenance and request identifiers without secrets; prevent retry from causing unbounded duplicate paid jobs.

## Acceptance criteria

- [ ] A local audio narration workflow works with no provider login.
- [ ] Timings use actual audio measurements, not only word-count estimates.
- [ ] Unconfigured providers are reported as unavailable, never silently substituted.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-080.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Render narrated diagram scenes and verify audio duration/trim.
- Test synthesis error, duplicate request and missing credentials without making a network call.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-080/result.json`
- `evidence/tickets/AFM-080/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-081 — Unify caption import, editing and frame-accurate export

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-079, AFM-080, AFM-025

## Outcome

Keep captions synchronized with story and media edits in the shared project.

## Source files to inspect and reuse

### H-CAPTIONS — Caption parse, display and timeline

- `hyperframes-main/packages/studio/src/captions/parser.ts`
- `hyperframes-main/packages/studio/src/captions/generator.ts`
- `hyperframes-main/packages/studio/src/captions/components/CaptionTimeline.tsx`
- `hyperframes-main/packages/studio/src/captions/hooks/useCaptionSync.ts`

### H-PROVIDERS — Optional speech, transcription and local model adapters

- `hyperframes-main/packages/cli/src/audio/providers.ts`
- `hyperframes-main/packages/cli/src/commands/tts.ts`
- `hyperframes-main/packages/cli/src/commands/transcribe.ts`
- `hyperframes-main/packages/cli/src/tts/synthesize.ts`
- `hyperframes-main/packages/cli/src/whisper/transcribe.ts`

## Proposed target files / areas

- `packages/studio/src/captions/`
- `packages/project-model/src/captions.ts`

## Implementation requirements

1. Reuse caption parsing/generation/editor facilities with local SRT/VTT or supported transcript inputs.
2. Store caption timing against measured audio/scene time and provide deterministic frame-bound conversion.
3. Persist caption style separately from diagram semantics and regenerate supported rendered/sidecar outputs.

## Acceptance criteria

- [ ] Scene moves and media trims follow a documented caption retiming policy.
- [ ] Captions do not cover essential diagram content when safe-area checks pass.
- [ ] Imported transcripts are preserved and corrected text survives regeneration.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-081.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test caption overlaps, non-ASCII text, fractional fps and scene trims.
- Render and inspect start/end words plus an exported subtitle sidecar.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-081/result.json`
- `evidence/tickets/AFM-081/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-082 — Preserve native media transforms, audio effects and color controls

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-079, AFM-072, AFM-047

## Outcome

Ensure diagram integration expands rather than removes native editing capabilities.

## Source files to inspect and reuse

### H-AUDIO — Audio mixer, timing and effects

- `hyperframes-main/packages/producer/src/services/audioMixer.ts`
- `hyperframes-main/packages/engine/src/services/audioMixer.ts`
- `hyperframes-main/packages/core/src/audioFx.ts`
- `hyperframes-main/packages/engine/src/services/audioVolumeEnvelope.ts`

### H-GESTURE — Canvas transforms, hit-testing and DOM mutation

- `hyperframes-main/packages/studio/src/components/editor/DomEditOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/domEditing.ts`
- `hyperframes-main/packages/studio/src/components/editor/groupDragMove.ts`
- `hyperframes-main/packages/sdk/src/adapters/iframe.ts`

### H-ANIMUI — Animation, paths, easing and keyframe controls

- `hyperframes-main/packages/studio/src/components/editor/GsapAnimationSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/MotionPathOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/EaseCurveSection.tsx`
- `hyperframes-main/packages/studio/src/components/editor/KeyframeNavigation.tsx`

### H-PLAYER — Player and slideshow compatibility

- `hyperframes-main/packages/player/src/hyperframes-player.ts`
- `hyperframes-main/packages/player/src/slideshow/hyperframes-slideshow.ts`
- `hyperframes-main/packages/player/src/runtime-message-handler.ts`
- `hyperframes-main/packages/player/src/media-element-guards.ts`

## Proposed target files / areas

- `tests/regression/native-media-capabilities.test.ts`
- `docs/quality/native-media-matrix.md`

## Implementation requirements

1. Inventory and exercise supported trim/crop/transform, audio gain/effects, color grading and existing transition operations.
2. Route native mutations through shared history while preserving their source formats and edit capability checks.
3. Keep unsupported source expressions visible/read-only instead of lossy normalization.

## Acceptance criteria

- [ ] Ordinary native projects retain working edit, save, preview and render paths.
- [ ] Diagram styles and history integration do not alter unrelated media properties.
- [ ] Existing specialized output options remain available only with tested support declarations.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-082.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run representative native media/FX regression fixtures and compare rendered frames/audio.
- Test mixed diagram/native undo and variable-driven properties.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-082/result.json`
- `evidence/tickets/AFM-082/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-083 — Unify templates, local catalog and asset provenance

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-079, AFM-034, AFM-045, AFM-005

## Outcome

Provide reusable starting projects while keeping remote catalogs optional.

## Source files to inspect and reuse

### H-CATALOG — Registry install, local resolution and template access

- `hyperframes-main/packages/cli/src/registry/installer.ts`
- `hyperframes-main/packages/cli/src/registry/remote.ts`
- `hyperframes-main/packages/cli/src/registry/resolver.ts`
- `hyperframes-main/packages/studio-server/src/routes/registry.ts`
- `hyperframes-main/packages/cli/src/templates/remote.ts`

### H-STYLE — Existing themes and native animated graph reference

- `hyperframes-main/themes/CONTRACT.md`
- `hyperframes-main/themes/editorial.css`
- `hyperframes-main/registry/blocks/flowchart/flowchart.html`
- `hyperframes-main/registry/blocks/flowchart-vertical/flowchart-vertical.html`

### A-THEME — Brand registry, locale and presets

- `archify-main/archify/renderers/shared/brand-marks.mjs`
- `archify-main/archify/renderers/shared/generated-brand-marks.mjs`
- `archify-main/archify/renderers/shared/i18n.mjs`
- `archify-main/archify/test/preset-tryon.test.mjs`
- `archify-main/archify/test/i18n.test.mjs`

## Proposed target files / areas

- `packages/cli/src/registry/`
- `templates/architecture-explainer/`
- `templates/diagram-walkthrough/`
- `templates/architecture-change-review/`

## Implementation requirements

1. Create owned mixed-content templates using valid diagram sources and local approved assets.
2. Preserve existing registry/template capabilities with explicit remote enablement and cached/local resolution.
3. Record template versions, license/asset requirements and compatibility with project/engine schemas.

## Acceptance criteria

- [ ] Bundled local templates create projects without an upstream account.
- [ ] Remote catalog failures cannot break local template selection.
- [ ] Template regeneration never overwrites a user-modified project without an explicit migration action.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-083.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Instantiate each owned template and render one real example.
- Test unavailable catalog, incompatible template version and unreviewed remote asset.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-083/result.json`
- `evidence/tickets/AFM-083/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-084 — Support readable output presets and theme customization

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-041, AFM-034, AFM-079, AFM-081

## Outcome

Produce deliberate widescreen, square and portrait compositions.

## Source files to inspect and reuse

### H-STYLE — Existing themes and native animated graph reference

- `hyperframes-main/themes/CONTRACT.md`
- `hyperframes-main/themes/editorial.css`
- `hyperframes-main/registry/blocks/flowchart/flowchart.html`
- `hyperframes-main/registry/blocks/flowchart-vertical/flowchart-vertical.html`

### H-FONTS — Font readiness and localization code (not binary redistribution)

- `hyperframes-main/packages/producer/src/services/deterministicFonts.ts`
- `hyperframes-main/packages/cli/src/fontLocalize.ts`
- `hyperframes-main/packages/studio-server/src/routes/fonts.ts`
- `hyperframes-main/packages/cli/src/capture/captureFontValidation.ts`

### H-CAPTURE — Frame capture and encoding

- `hyperframes-main/packages/engine/src/services/frameCapture.ts`
- `hyperframes-main/packages/engine/src/services/chunkEncoder.ts`
- `hyperframes-main/packages/engine/src/services/streamingEncoder.ts`
- `hyperframes-main/packages/engine/src/utils/renderProvenance.ts`

## Proposed target files / areas

- `packages/studio/src/project/OutputPresetPanel.tsx`
- `packages/diagram-motion/src/outputPresets.ts`

## Implementation requirements

1. Define output presets with dimensions, frame rate, safe areas and caption/text readability constraints.
2. Reframe camera intent for each aspect ratio instead of blindly scaling the full map.
3. Reuse approved theme/branding controls while preserving font readiness and source identities.

## Acceptance criteria

- [ ] 16:9, 1:1 and 9:16 sample outputs have visible unclipped key labels and captions.
- [ ] A readability failure is reported rather than silently exporting tiny text.
- [ ] Changing output presets does not mutate diagram topology.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-084.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Render the same guided-view project in all three aspect ratios.
- Test long labels, large caption blocks and a missing requested font.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-084/result.json`
- `evidence/tickets/AFM-084/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-085 — Preserve player, slideshow and external native-project compatibility

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-022, AFM-047, AFM-072, AFM-082

## Outcome

Keep the inherited composition ecosystem usable in the custom repo.

## Source files to inspect and reuse

### H-PLAYER — Player and slideshow compatibility

- `hyperframes-main/packages/player/src/hyperframes-player.ts`
- `hyperframes-main/packages/player/src/slideshow/hyperframes-slideshow.ts`
- `hyperframes-main/packages/player/src/runtime-message-handler.ts`
- `hyperframes-main/packages/player/src/media-element-guards.ts`

### H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts`
- `hyperframes-main/packages/parsers/src/compositionContract.ts`
- `hyperframes-main/packages/parsers/src/composition.ts`
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts`

### H-PARSER — DOM identities, GSAP and roundtrip editing

- `hyperframes-main/packages/parsers/src/hfIds.ts`
- `hyperframes-main/packages/parsers/src/hfIdAssignment.ts`
- `hyperframes-main/packages/parsers/src/gsapParser.ts`
- `hyperframes-main/packages/parsers/src/gsapSerialize.ts`
- `hyperframes-main/packages/parsers/src/htmlParser.ts`

## Proposed target files / areas

- `tests/regression/native-project-compatibility.test.ts`
- `docs/migration/native-hyperframes.md`

## Implementation requirements

1. Inventory plain/nested HTML, variables, player embedding and slideshow workflows supported by the snapshot.
2. Import/export native projects with deterministic path/asset rewrites and no mandatory diagram conversion.
3. Run compatibility fixtures and document explicit unsupported upstream constructs before releasing.

## Acceptance criteria

- [ ] A native-only project opens, edits and renders without an artificial diagram requirement.
- [ ] Existing variable and nested composition identity survives roundtrip.
- [ ] Unsupported constructs are not silently removed during save.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-085.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test native-only, nested variable and slideshow fixtures.
- Compare source serialization and actual playback/render after migration.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-085/result.json`
- `evidence/tickets/AFM-085/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-086 — Provide one export surface for project, diagram, still and video

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E09 — Assets, narration, captions and native video parity  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-038, AFM-054, AFM-081, AFM-084, AFM-085

## Outcome

Export all supported outputs from one authoritative project revision.

## Source files to inspect and reuse

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`

## Proposed target files / areas

- `packages/studio/src/project/ExportPanel.tsx`
- `packages/studio-server/src/services/projectExport.ts`

## Implementation requirements

1. Offer standalone diagram HTML/SVG, supported still/share-card formats, editable project bundles and retained MP4/WebM paths.
2. Apply source redaction, asset review and immutable build manifests consistently across export types.
3. Preserve animation semantics for editable exports; do not replace managed source with a video as the sole deliverable.

## Acceptance criteria

- [ ] Each export identifies source revision, output settings and asset dependencies.
- [ ] Imported editable bundles reopen correctly in a clean destination.
- [ ] Missing assets or unresolved critical conflicts block release-quality export.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-086.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Export/reimport a mixed project and compare bindings.
- Inspect HTML/still/video outputs and test private evidence exclusion.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-086/result.json`
- `evidence/tickets/AFM-086/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E10 — All diagram families and architecture-change reviews

# AFM-087 — Complete workflow authoring and video scene integration

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-030, AFM-064, AFM-065, AFM-068, AFM-073

## Outcome

Make workflow diagrams fully editable and animatable inside the unified product.

## Source files to inspect and reuse

### A-WORK — Workflow compile, migrate, and branch semantics

- `archify-main/archify/renderers/workflow/render-workflow.mjs`
- `archify-main/archify/renderers/workflow/workflow-compiler.mjs`
- `archify-main/archify/migrations/workflow-v2.mjs`
- `archify-main/archify/schemas/workflow.schema.json`
- `archify-main/archify/examples/agent-tool-call.workflow.json`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/adapters/workflow.ts`
- `packages/diagram-motion/src/adapters/workflow.ts`

## Implementation requirements

1. Provide type-specific node/edge/lane/group inspectors and validated layout changes.
2. Compile workflow scenes with explicit branch/route selection, preserving migration semantics and readable labels.
3. Integrate guided views, history, overrides, save/reopen and all supported exports.

## Acceptance criteria

- [ ] A branched workflow can be structurally edited, animated and rendered without linearizing branches.
- [ ] Migrated workflow fixtures remain consistent with their receipts.
- [ ] Lane and route edits survive regeneration.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-087.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run agent-tool-call, incident-response and release-delivery end-to-end fixtures.
- Test branch ambiguity, explicit routing and cancellation of invalid migration.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-087/result.json`
- `evidence/tickets/AFM-087/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-088 — Complete sequence authoring and ordered message motion

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-031, AFM-064, AFM-068, AFM-073

## Outcome

Expose sequence-specific editing and timing rather than generic graph traversal.

## Source files to inspect and reuse

### A-SEQ — Ordered messages and participants

- `archify-main/archify/renderers/sequence/render-sequence.mjs`
- `archify-main/archify/schemas/sequence.schema.json`
- `archify-main/archify/examples/cache-miss-request.sequence.json`
- `archify-main/archify/test/sequence-column-fit.test.mjs`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/adapters/sequence.ts`
- `packages/diagram-motion/src/adapters/sequence.ts`

## Implementation requirements

1. Provide participant/message inspectors, message reorder operations and distinct repeated-message identities.
2. Animate authored message order, supported returns and grouping with deterministic local time.
3. Keep source order separate from the video pace chosen for each message.

## Acceptance criteria

- [ ] Editing one repeated endpoint message never modifies another.
- [ ] Reordering source messages explicitly changes the sequence and regenerates affected scenes.
- [ ] Random/backward seeks show the correct message state.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-088.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run cache-miss and async-job-roundtrip edit/reopen/render scenarios.
- Test duplicate endpoints, return direction and simultaneous presentation emphasis.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-088/result.json`
- `evidence/tickets/AFM-088/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-089 — Complete dataflow authoring and flow-motion integration

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-032, AFM-064, AFM-065, AFM-068, AFM-073

## Outcome

Integrate typed dataflow semantics into Studio and exports.

## Source files to inspect and reuse

### A-DATA — Dataflow renderer, schema and examples

- `archify-main/archify/renderers/dataflow/render-dataflow.mjs`
- `archify-main/archify/schemas/dataflow.schema.json`
- `archify-main/archify/examples/product-analytics.dataflow.json`
- `archify-main/archify/examples/event-stream.dataflow.json`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/adapters/dataflow.ts`
- `packages/diagram-motion/src/adapters/dataflow.ts`

## Implementation requirements

1. Add dataflow node/flow/boundary fields with schema-aware commands.
2. Animate only real flows and retain direction/labels across boundary crossings.
3. Support shared selection, history, guided views, overrides and aspect-ratio reframing.

## Acceptance criteria

- [ ] Dataflow edits persist through regeneration and actual video output.
- [ ] Boundary/flow metadata is not replaced by architecture-specific assumptions.
- [ ] Missing/removed flow targets produce explicit conflicts.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-089.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run product-analytics and event-stream end-to-end cases.
- Test parallel flows, long labels and direction-preserving animation.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-089/result.json`
- `evidence/tickets/AFM-089/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-090 — Complete lifecycle authoring and transition-motion integration

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-033, AFM-064, AFM-068, AFM-073

## Outcome

Integrate states and transitions while avoiding invented execution histories.

## Source files to inspect and reuse

### A-LIFE — Lifecycle states and transitions

- `archify-main/archify/renderers/lifecycle/render-lifecycle.mjs`
- `archify-main/archify/schemas/lifecycle.schema.json`
- `archify-main/archify/examples/agent-run.lifecycle.json`
- `archify-main/archify/examples/deployment-release.lifecycle.json`

### H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx`
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx`
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx`

### H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx`
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts`
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx`

## Proposed target files / areas

- `packages/studio/src/diagrams/adapters/lifecycle.ts`
- `packages/diagram-motion/src/adapters/lifecycle.ts`

## Implementation requirements

1. Add state/transition editing and supported lifecycle metadata controls.
2. Let users author explicit walkthrough routes; distinguish possible transitions from a recorded execution trace.
3. Integrate loops/terminal presentation, history, override rebasing and video/interactive exports.

## Acceptance criteria

- [ ] An authored route follows only real transitions.
- [ ] Showing a possible transition does not assert that it actually occurred.
- [ ] All state/transition edits survive reopen and render with stable IDs.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-090.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run agent-run and deployment-release end-to-end scenarios.
- Test loops, self-transitions, removed terminal states and invalid routes.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-090/result.json`
- `evidence/tickets/AFM-090/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-091 — Complete viewer features and deep-link continuity in Studio

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-035, AFM-036, AFM-066, AFM-087, AFM-088, AFM-089, AFM-090

## Outcome

Preserve diagram exploration capabilities as part of the custom product.

## Source files to inspect and reuse

### A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html`
- `archify-main/archify/test/guided-views.test.mjs`
- `archify-main/archify/test/story-follow-camera.test.mjs`
- `archify-main/archify/test/semantic-camera.test.mjs`

### A-REACH — Authored graph inspection and sharing

- `archify-main/archify/test/authored-reachability.test.mjs`
- `archify-main/archify/test/route-probe.test.mjs`
- `archify-main/archify/test/relationship-direct-explorer.test.mjs`
- `archify-main/archify/test/relationship-permalink.test.mjs`
- `archify-main/archify/test/reach-share-card.test.mjs`

### A-THEME — Brand registry, locale and presets

- `archify-main/archify/renderers/shared/brand-marks.mjs`
- `archify-main/archify/renderers/shared/generated-brand-marks.mjs`
- `archify-main/archify/renderers/shared/i18n.mjs`
- `archify-main/archify/test/preset-tryon.test.mjs`
- `archify-main/archify/test/i18n.test.mjs`

## Proposed target files / areas

- `packages/studio/src/diagrams/ExplorePanel.tsx`
- `packages/diagram-viewer/src/links.mjs`

## Implementation requirements

1. Map original search, details, chapter/view navigation, route/reach inspection and supported semantic links to Studio panels and standalone viewer controls.
2. Preserve applicable locale/theme/preset/share-card behavior with a capability-by-capability regression ledger.
3. Keep live viewer presentation controls outside video render time ownership.

## Acceptance criteria

- [ ] Each original local viewer capability is retained or has an explicitly approved replacement with tests.
- [ ] Deep links resolve correct stable identities in exported viewers.
- [ ] Live viewer navigation cannot alter an in-progress video render.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-091.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run the original viewer capability suites plus browser interaction tests.
- Test removed/deep-linked objects, repeated scenes and locale switching.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-091/result.json`
- `evidence/tickets/AFM-091/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-092 — Build exact before/delta/after review scenes

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-037, AFM-073, AFM-045, AFM-068

## Outcome

Turn validated structural diffs into editable change-review videos.

## Source files to inspect and reuse

### A-DELTA — Before/after receipts and geometry

- `archify-main/archify/delta/architecture-delta.mjs`
- `archify-main/archify/test/architecture-delta.test.mjs`
- `archify-main/archify/examples/checkout-platform.base.architecture.json`
- `archify-main/archify/examples/checkout-platform.head.architecture.json`

### H-STYLE — Existing themes and native animated graph reference

- `hyperframes-main/themes/CONTRACT.md`
- `hyperframes-main/themes/editorial.css`
- `hyperframes-main/registry/blocks/flowchart/flowchart.html`
- `hyperframes-main/registry/blocks/flowchart-vertical/flowchart-vertical.html`

## Proposed target files / areas

- `packages/diagram-motion/src/deltaScenes.ts`
- `templates/architecture-change-review/`

## Implementation requirements

1. Pin before/head diagram revisions and expose exact additions, removals, attribute changes and supported geometry changes.
2. Generate deterministic review scenes bound to the delta receipt and allow user-controlled timing/callouts.
3. Keep removed objects available from the before snapshot and preserve distinct before/after render namespaces.

## Acceptance criteria

- [ ] Every highlighted change can be traced to the receipt.
- [ ] No false runtime improvement or security claim is automatically generated as fact.
- [ ] Repeated relationships and renamed labels are matched by stable IDs.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-092.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Use checkout-platform before/head fixtures in a real render.
- Test an unchanged diagram, deletion, reroute, label-only change and parallel edges.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-092/result.json`
- `evidence/tickets/AFM-092/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-093 — Integrate repository/PR evidence into review workflows

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-interface  
**Dependencies:** AFM-092, AFM-024, AFM-051

## Outcome

Reuse source-change storytelling while keeping architecture evidence explicit.

## Source files to inspect and reuse

### H-SKILL — Coding agent instructions and bundled skills

- `hyperframes-main/AGENTS.md`
- `hyperframes-main/CLAUDE.md`
- `hyperframes-main/skills/pr-to-video/SKILL.md`
- `hyperframes-main/skills-manifest.json`
- `hyperframes-main/scripts/check-skill-mirror.mjs`

### A-EVID — Source references and engineering metadata

- `archify-main/archify/renderers/shared/repository-evidence.mjs`
- `archify-main/archify/renderers/shared/repository-location.mjs`
- `archify-main/archify/renderers/shared/engineering-profiles.mjs`
- `archify-main/archify/test/repository-evidence.test.mjs`

### A-DELTA — Before/after receipts and geometry

- `archify-main/archify/delta/architecture-delta.mjs`
- `archify-main/archify/test/architecture-delta.test.mjs`
- `archify-main/archify/examples/checkout-platform.base.architecture.json`
- `archify-main/archify/examples/checkout-platform.head.architecture.json`

## Proposed target files / areas

- `packages/studio-server/src/services/changeReview.ts`
- `skills/archframe/change-review.md`

## Implementation requirements

1. Accept local before/head snapshots or explicitly authorized Git/PR inputs; pin revisions before analysis.
2. Reuse the upstream PR-to-video orchestration pattern but route all diagram/story mutations through validated project commands.
3. Require citations for factual source claims and mark model inferences/draft narration separately; reject unsupported causal promises.

## Acceptance criteria

- [ ] A local review works without a hosted media provider.
- [ ] Changes in code are not automatically asserted to prove deployed architecture changes.
- [ ] The final review bundle includes source/delta/build receipts and evidence links.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-093.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test a local source diff with approved diagrams and a contradictory inferred narration proposal.
- Test stale revision, missing source access and injected instructions inside repository text.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-093/result.json`
- `evidence/tickets/AFM-093/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-094 — Certify all five diagram families and native scenes together

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E10 — All diagram families and architecture-change reviews  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-087, AFM-088, AFM-089, AFM-090, AFM-091, AFM-092, AFM-086, AFM-078

## Outcome

Prevent the architecture-only milestone from being mislabeled as the finished product.

## Source files to inspect and reuse

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

## Proposed target files / areas

- `tests/e2e/all-diagram-families.spec.ts`
- `docs/quality/all-family-acceptance.md`

## Implementation requirements

1. For each family run create/import, semantic edit, scene edit, undo, regenerate, reopen and real render.
2. Assemble a single mixed project containing all families and native media/title content.
3. Record per-family supported features, regressions and exact artifact evidence rather than one aggregate green checkbox.

## Acceptance criteria

- [ ] All five families have actual Studio and producer evidence.
- [ ] Native-only and mixed projects both remain usable.
- [ ] No family is counted integrated solely because its source files exist.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-094.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run one branch/repetition/loop-specific fixture per family.
- Verify mixed-project frame boundaries, IDs, styles and caption alignment.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-094/result.json`
- `evidence/tickets/AFM-094/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E11 — Unified CLI, skills and agent tools

# AFM-095 — Expose one product CLI with native and diagram commands

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-051, AFM-052, AFM-057, AFM-022, AFM-086

## Outcome

Provide a single local command surface for the merged application.

## Source files to inspect and reuse

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

## Proposed target files / areas

- `packages/cli/src/cli.ts`
- `packages/cli/src/commands/project.ts`
- `packages/cli/src/commands/diagram.ts`

## Implementation requirements

1. Add project init/import/open/validate/build/export and diagram inspect/compare commands under the chosen product binary.
2. Preserve compatible native preview/render/media commands and document deprecated upstream aliases.
3. Use the shared command service/library with revision checks; add JSON output and stable exit codes.

## Acceptance criteria

- [ ] All commands resolve workspace-owned code without global upstream installs.
- [ ] CLI and Studio generate equivalent authoring revisions for the same operation.
- [ ] Invalid input returns nonzero status and structured diagnostics.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-095.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run commands from outside the repo with paths containing spaces.
- Test missing input, stale revision, cancelled render and native compatibility aliases.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-095/result.json`
- `evidence/tickets/AFM-095/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-096 — Expose revision-aware diagram and story agent tools

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-051, AFM-057, AFM-061, AFM-095

## Outcome

Allow coding/browser agents to operate on semantic identities instead of fragile DOM guesses.

## Source files to inspect and reuse

### H-TOOLS — Studio agent tool registration and write coordination

- `hyperframes-main/packages/studio/src/webmcp/StudioAgentTools.tsx`
- `hyperframes-main/packages/studio/src/webmcp/registrar.ts`
- `hyperframes-main/packages/studio/src/webmcp/writeCoordinator.ts`
- `hyperframes-main/packages/studio/src/webmcp/tools/contentTools.ts`

### H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts`
- `hyperframes-main/packages/sdk/src/history.ts`
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts`
- `hyperframes-main/packages/sdk/src/editing/affordances.ts`
- `hyperframes-main/packages/sdk/src/types.ts`

## Proposed target files / areas

- `packages/studio/src/webmcp/tools/diagramTools.ts`
- `packages/studio/src/webmcp/tools/projectTools.ts`

## Implementation requirements

1. Add inspectProject, inspectDiagram, propose/applyCommand, createScene, inspectConflicts and render-status tools using the existing registrar.
2. Include expectedRevision, capability queries, input schemas and structured diagnostic responses.
3. Prevent tools from writing generated geometry directly or inventing relationships through arbitrary animation code.

## Acceptance criteria

- [ ] Agent operations use the same validator and persistence path as UI edits.
- [ ] Unsupported operations fail explicitly with available alternatives.
- [ ] Tool registration does not require an upstream hosted account for local operations.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-096.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test valid label edit, fabricated edge, stale revision and orphan resolution.
- Verify a repeated tool call with the same commandId is idempotent.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-096/result.json`
- `evidence/tickets/AFM-096/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-097 — Create one combined skill and reconcile agent instructions

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-095, AFM-096, AFM-005

## Outcome

Make the coding-agent workflow describe one product rather than two competing toolchains.

## Source files to inspect and reuse

### A-SKILL — Agent guidance and recipes

- `archify-main/archify/SKILL.md`
- `archify-main/archify/recipes/scenarios.mjs`
- `archify-main/archify/scripts/check-update.mjs`
- `archify-main/archify/scripts/update-contract.mjs`

### H-SKILL — Coding agent instructions and bundled skills

- `hyperframes-main/AGENTS.md`
- `hyperframes-main/CLAUDE.md`
- `hyperframes-main/skills/pr-to-video/SKILL.md`
- `hyperframes-main/skills-manifest.json`
- `hyperframes-main/scripts/check-skill-mirror.mjs`

## Proposed target files / areas

- `skills/archframe/SKILL.md`
- `AGENTS.md`
- `CLAUDE.md`
- `skills-manifest.json`

## Implementation requirements

1. Write a combined entry skill covering source-backed diagram authoring, scene editing, validation and rendering.
2. Retain useful upstream specialized skills with updated workspace command paths and explicit optional provider policies.
3. Audit instruction mirrors, hooks and install recipes; remove automatic upstream upgrades or commands targeting original repositories.

## Acceptance criteria

- [ ] Agent instructions lead to owned CLI and project commands.
- [ ] Diagram and video instructions agree on source ownership and time semantics.
- [ ] The skill never treats placeholder artifacts or mocked renders as finished work.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-097.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run skill-manifest/mirror checks and example command validation.
- Audit all bundled agent files for obsolete upstream executable paths.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-097/result.json`
- `evidence/tickets/AFM-097/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-098 — Implement source-grounded AI proposal review

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-interface  
**Dependencies:** AFM-096, AFM-024, AFM-037

## Outcome

Let AI propose useful changes without bypassing architecture validation or user intent.

## Source files to inspect and reuse

### A-EVID — Source references and engineering metadata

- `archify-main/archify/renderers/shared/repository-evidence.mjs`
- `archify-main/archify/renderers/shared/repository-location.mjs`
- `archify-main/archify/renderers/shared/engineering-profiles.mjs`
- `archify-main/archify/test/repository-evidence.test.mjs`

### H-SKILL — Coding agent instructions and bundled skills

- `hyperframes-main/AGENTS.md`
- `hyperframes-main/CLAUDE.md`
- `hyperframes-main/skills/pr-to-video/SKILL.md`
- `hyperframes-main/skills-manifest.json`
- `hyperframes-main/scripts/check-skill-mirror.mjs`

### H-TOOLS — Studio agent tool registration and write coordination

- `hyperframes-main/packages/studio/src/webmcp/StudioAgentTools.tsx`
- `hyperframes-main/packages/studio/src/webmcp/registrar.ts`
- `hyperframes-main/packages/studio/src/webmcp/writeCoordinator.ts`
- `hyperframes-main/packages/studio/src/webmcp/tools/contentTools.ts`

## Proposed target files / areas

- `packages/studio-server/src/services/proposals.ts`
- `packages/studio/src/project/ProposalReview.tsx`

## Implementation requirements

1. Accept configured-agent output as typed proposed commands plus evidence references; do not bake a mandatory model vendor into the diagram engine.
2. Preview changed objects, routes, story wording and validation diagnostics before applying a batch.
3. Treat repository text and external content as untrusted data; require source grounding for factual claims and mark uncertain inference.

## Acceptance criteria

- [ ] A rejected proposal leaves the project unchanged.
- [ ] An accepted proposal is a validated, undoable atomic transaction.
- [ ] A plausible-sounding but unsupported relationship cannot enter through narration or motion generation as a verified fact.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-098.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test valid sourced proposal, invented connection and instruction injection in a README.
- Test provider unavailable and partial invalid command batch.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-098/result.json`
- `evidence/tickets/AFM-098/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-099 — Support headless batch generation and resumable jobs

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-095, AFM-026, AFM-055

## Outcome

Generate multiple outputs reliably from the same owned repo.

## Source files to inspect and reuse

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### H-PRODUCER — Retained render pipeline

- `hyperframes-main/packages/producer/src/index.ts`
- `hyperframes-main/packages/producer/src/renderRequest.ts`
- `hyperframes-main/packages/producer/src/services/renderOrchestrator.ts`
- `hyperframes-main/packages/producer/src/services/compilationRunner.ts`

## Proposed target files / areas

- `packages/cli/src/commands/projectBatch.ts`
- `packages/project-model/src/batchReceipt.ts`

## Implementation requirements

1. Accept explicit project inputs/output presets with bounded concurrency and immutable per-job receipts.
2. Resume only matching completed hashes and retry failed work without recharging optional providers unnecessarily.
3. Support cancellation and partial-success reporting with individual artifact paths and diagnostics.

## Acceptance criteria

- [ ] One failed project does not cause other successful jobs to be mislabeled failed or complete.
- [ ] Repeated batch execution can reuse verified unchanged outputs.
- [ ] Input folders are never overwritten by generated artifacts.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-099.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run a batch with two valid projects and one invalid diagram.
- Cancel/restart a batch and verify no output collision or duplicate finished job.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-099/result.json`
- `evidence/tickets/AFM-099/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-100 — Preserve optional capture, Figma, cloud and publishing interfaces

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-interface  
**Dependencies:** AFM-005, AFM-095, AFM-079

## Outcome

Retain existing external capabilities without making them required for local authoring.

## Source files to inspect and reuse

### H-EXTERNAL — Existing optional capture, Figma and publishing commands

- `hyperframes-main/packages/cli/src/commands/capture.ts`
- `hyperframes-main/packages/cli/src/commands/figma.ts`
- `hyperframes-main/packages/cli/src/commands/publish.ts`
- `hyperframes-main/packages/cli/src/commands/remove-background.ts`

### H-CLOUD — Optional deployment adapters and container packaging

- `hyperframes-main/packages/aws-lambda/src/index.ts`
- `hyperframes-main/packages/gcp-cloud-run/package.json`
- `hyperframes-main/packages/cli/src/docker/Dockerfile.render`
- `hyperframes-main/packages/cli/src/commands/cloudrun.ts`
- `hyperframes-main/packages/cli/src/commands/lambda.ts`

### H-AUTH — Optional hosted authentication and secret scrubbing

- `hyperframes-main/packages/cli/src/auth/resolver.ts`
- `hyperframes-main/packages/cli/src/auth/store.ts`
- `hyperframes-main/packages/cli/src/auth/scrub.ts`
- `hyperframes-main/packages/cli/src/cloud/auth.ts`

## Proposed target files / areas

- `docs/integrations/compatibility.md`
- `tests/contracts/optional-integrations.test.ts`

## Implementation requirements

1. Inventory inherited commands and configuration requirements; update them for the owned project paths, branding and asset registry.
2. Keep network/account features opt-in, label hosted costs/requirements and avoid assuming forked source makes hosted services free.
3. Provide contract tests and separately gated live smoke tests with user-owned credentials; record unverified external modes accurately.

## Acceptance criteria

- [ ] Local project creation/edit/preview/render remains usable with every provider disabled.
- [ ] Existing external adapters are retained or have an approved documented replacement, not silently deleted.
- [ ] Contract-tested is never reported as live cloud-verified.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-100.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test disabled integration errors and secret redaction.
- In authorized environments, run distinct live tests and attach provider-specific receipts.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-100/result.json`
- `evidence/tickets/AFM-100/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-101 — Add project, media and runtime diagnostics to doctor

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-095, AFM-010, AFM-024, AFM-049

## Outcome

Give users actionable local setup and project health feedback.

## Source files to inspect and reuse

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

### H-NET — Update, telemetry and outbound network controls

- `hyperframes-main/packages/cli/src/telemetry/policy.ts`
- `hyperframes-main/packages/cli/src/telemetry/transport.ts`
- `hyperframes-main/packages/cli/src/utils/autoUpdate.ts`
- `hyperframes-main/packages/cli/src/utils/updateCheck.ts`
- `hyperframes-main/packages/engine/src/utils/urlDownloader.ts`

## Proposed target files / areas

- `packages/cli/src/commands/doctor.ts`
- `packages/studio/src/project/DiagnosticsPanel.tsx`

## Implementation requirements

1. Check runtime/browser/encoder versions, package linkage, write permissions, assets, stale builds and project schema consistency.
2. Surface configured versus unavailable optional providers without probing paid services unexpectedly.
3. Produce shareable redacted diagnostics and targeted remediation commands.

## Acceptance criteria

- [ ] Doctor reports the actual new product packages rather than upstream registry versions.
- [ ] Missing prerequisites are diagnosed before a lengthy render attempt.
- [ ] Shared diagnostic output excludes secrets and private repository contents.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-101.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test absent browser, invalid schema, missing asset and offline mode.
- Search exported diagnostics for seeded sensitive values.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-101/result.json`
- `evidence/tickets/AFM-101/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-102 — Run real agent and CLI end-to-end acceptance

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E11 — Unified CLI, skills and agent tools  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-interface  
**Dependencies:** AFM-096, AFM-097, AFM-098, AFM-099, AFM-101, AFM-094

## Outcome

Prove tool-driven authoring reaches the same product result as the UI.

## Source files to inspect and reuse

### H-TOOLS — Studio agent tool registration and write coordination

- `hyperframes-main/packages/studio/src/webmcp/StudioAgentTools.tsx`
- `hyperframes-main/packages/studio/src/webmcp/registrar.ts`
- `hyperframes-main/packages/studio/src/webmcp/writeCoordinator.ts`
- `hyperframes-main/packages/studio/src/webmcp/tools/contentTools.ts`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### A-SKILL — Agent guidance and recipes

- `archify-main/archify/SKILL.md`
- `archify-main/archify/recipes/scenarios.mjs`
- `archify-main/archify/scripts/check-update.mjs`
- `archify-main/archify/scripts/update-contract.mjs`

## Proposed target files / areas

- `tests/e2e/agent-authoring.spec.ts`
- `evidence/agent-acceptance/`

## Implementation requirements

1. Use a configured coding agent or an explicitly recorded manual tool invocation sequence to create and edit a mixed project.
2. Validate semantic changes, generate scenes, add narration/captions where configured, render and inspect results.
3. Separate deterministic tool-contract tests from actual model evidence; never label scripted fixtures as agent reasoning success.

## Acceptance criteria

- [ ] Agent-created artifacts validate and reopen in the same Studio.
- [ ] Invalid proposed relationships are rejected at the shared boundary.
- [ ] Evidence names the actual runner/model where used or clearly states no model was executed.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-102.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test one successful source-grounded project and one deliberately invalid proposal.
- Compare CLI/tool and UI output revisions for equivalent commands.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-102/result.json`
- `evidence/tickets/AFM-102/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E12 — Local-first security and resilient execution

# AFM-103 — Audit and gate all outbound network behavior

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-005, AFM-010, AFM-079, AFM-100

## Outcome

Make local-first behavior real rather than assuming both upstream repos are offline.

## Source files to inspect and reuse

### A-SKILL — Agent guidance and recipes

- `archify-main/archify/SKILL.md`
- `archify-main/archify/recipes/scenarios.mjs`
- `archify-main/archify/scripts/check-update.mjs`
- `archify-main/archify/scripts/update-contract.mjs`

### H-NET — Update, telemetry and outbound network controls

- `hyperframes-main/packages/cli/src/telemetry/policy.ts`
- `hyperframes-main/packages/cli/src/telemetry/transport.ts`
- `hyperframes-main/packages/cli/src/utils/autoUpdate.ts`
- `hyperframes-main/packages/cli/src/utils/updateCheck.ts`
- `hyperframes-main/packages/engine/src/utils/urlDownloader.ts`

### H-CATALOG — Registry install, local resolution and template access

- `hyperframes-main/packages/cli/src/registry/installer.ts`
- `hyperframes-main/packages/cli/src/registry/remote.ts`
- `hyperframes-main/packages/cli/src/registry/resolver.ts`
- `hyperframes-main/packages/studio-server/src/routes/registry.ts`
- `hyperframes-main/packages/cli/src/templates/remote.ts`

### H-AUTH — Optional hosted authentication and secret scrubbing

- `hyperframes-main/packages/cli/src/auth/resolver.ts`
- `hyperframes-main/packages/cli/src/auth/store.ts`
- `hyperframes-main/packages/cli/src/auth/scrub.ts`
- `hyperframes-main/packages/cli/src/cloud/auth.ts`

## Proposed target files / areas

- `packages/project-model/src/networkPolicy.ts`
- `docs/security/network-inventory.json`

## Implementation requirements

1. Inventory telemetry, update checks, remote scripts, catalogs, asset downloads, browser/model installs and provider APIs.
2. Disable unsolicited telemetry/updating and require explicit opt-in for optional providers/catalogs; route approved fetches through one policy layer.
3. Distinguish initial dependency/tool installation from offline editing/preview/render with preloaded assets.

## Acceptance criteria

- [ ] A configured local fixture performs no unexpected outbound request.
- [ ] Failed optional network features cannot break local workflows.
- [ ] The UI/CLI shows missing downloads or providers before starting work.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-103.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Observe/block egress during local create/edit/reopen/render.
- Test inherited auto-update/telemetry code paths and denied catalog requests.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-103/result.json`
- `evidence/tickets/AFM-103/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-104 — Harden project paths, archives and file operations

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-006, AFM-020, AFM-051, AFM-079

## Outcome

Protect local files even when imported projects or media are malicious.

## Source files to inspect and reuse

### H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts`
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts`
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts`
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts`

### A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs`
- `archify-main/archify/renderers/shared/output-path.mjs`
- `archify-main/archify/renderers/shared/diagnostics.mjs`

### H-CATALOG — Registry install, local resolution and template access

- `hyperframes-main/packages/cli/src/registry/installer.ts`
- `hyperframes-main/packages/cli/src/registry/remote.ts`
- `hyperframes-main/packages/cli/src/registry/resolver.ts`
- `hyperframes-main/packages/studio-server/src/routes/registry.ts`
- `hyperframes-main/packages/cli/src/templates/remote.ts`

## Proposed target files / areas

- `packages/studio-server/src/security/projectPaths.ts`
- `tools/import/archivePolicy.ts`

## Implementation requirements

1. Enforce authorized realpath roots, path traversal checks, symlink policies and bounded archive extraction.
2. Reject device paths, absolute paths, case-colliding entries, ZIP bombs and duplicate output destinations.
3. Apply the same policy to project import/export, evidence reads, asset ingestion and render staging with race-resistant checks.

## Acceptance criteria

- [ ] No project operation can read or overwrite unrelated user files.
- [ ] Archive/symlink failures are explicit and non-destructive.
- [ ] Imported archives cannot execute scripts during inspection.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-104.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test ../ traversal, absolute and Windows device paths, symlink escape and hard cases with case folding.
- Test oversized/deep archives and duplicate normalized paths.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-104/result.json`
- `evidence/tickets/AFM-104/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-105 — Isolate imported HTML and preview messaging

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-057, AFM-056, AFM-104

## Outcome

Treat native HTML compositions as active untrusted content.

## Source files to inspect and reuse

### H-PLAYER — Player and slideshow compatibility

- `hyperframes-main/packages/player/src/hyperframes-player.ts`
- `hyperframes-main/packages/player/src/slideshow/hyperframes-slideshow.ts`
- `hyperframes-main/packages/player/src/runtime-message-handler.ts`
- `hyperframes-main/packages/player/src/media-element-guards.ts`

### H-GESTURE — Canvas transforms, hit-testing and DOM mutation

- `hyperframes-main/packages/studio/src/components/editor/DomEditOverlay.tsx`
- `hyperframes-main/packages/studio/src/components/editor/domEditing.ts`
- `hyperframes-main/packages/studio/src/components/editor/groupDragMove.ts`
- `hyperframes-main/packages/sdk/src/adapters/iframe.ts`

### H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts`
- `hyperframes-main/packages/studio-server/src/routes/preview.ts`
- `hyperframes-main/packages/studio-server/src/routes/lint.ts`
- `hyperframes-main/packages/studio-server/src/routes/selection.ts`

## Proposed target files / areas

- `packages/studio-server/src/security/previewIsolation.ts`
- `packages/studio/src/project/previewBridge.ts`

## Implementation requirements

1. Define trust modes for authored local content versus imported/untrusted HTML and serve previews from an isolated origin where practical.
2. Use strict message origin/source validation and a capability-limited preview bridge; do not expose project filesystem or application secrets to the composition frame.
3. Preserve required animation/runtime functionality while applying sandbox/CSP policy and explicit trust prompts for unsupported behaviors.

## Acceptance criteria

- [ ] A composition script cannot call project mutation endpoints using editor authority.
- [ ] Spoofed postMessage events cannot change selection, files or commands.
- [ ] Isolation failures block preview or require an explicit documented trusted-local mode.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-105.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test token exfiltration, parent-frame access and forged message events.
- Verify legitimate runtime seeking and SDK selection still work through the approved bridge.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-105/result.json`
- `evidence/tickets/AFM-105/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-106 — Constrain asset fetching and prevent internal-network access

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-103, AFM-104, AFM-049

## Outcome

Keep remote asset resolution from becoming an unrestricted network proxy.

## Source files to inspect and reuse

### H-ASSETS — Media validation, probing and asset resolution

- `hyperframes-main/packages/studio-server/src/routes/media.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaMetadata.ts`
- `hyperframes-main/packages/studio-server/src/helpers/mediaValidation.ts`
- `hyperframes-main/packages/parsers/src/assetResolution.ts`
- `hyperframes-main/packages/parsers/src/assetPaths.ts`

### H-NET — Update, telemetry and outbound network controls

- `hyperframes-main/packages/cli/src/telemetry/policy.ts`
- `hyperframes-main/packages/cli/src/telemetry/transport.ts`
- `hyperframes-main/packages/cli/src/utils/autoUpdate.ts`
- `hyperframes-main/packages/cli/src/utils/updateCheck.ts`
- `hyperframes-main/packages/engine/src/utils/urlDownloader.ts`

### H-CATALOG — Registry install, local resolution and template access

- `hyperframes-main/packages/cli/src/registry/installer.ts`
- `hyperframes-main/packages/cli/src/registry/remote.ts`
- `hyperframes-main/packages/cli/src/registry/resolver.ts`
- `hyperframes-main/packages/studio-server/src/routes/registry.ts`
- `hyperframes-main/packages/cli/src/templates/remote.ts`

## Proposed target files / areas

- `packages/studio-server/src/security/assetFetch.ts`
- `packages/engine/src/utils/urlDownloader.ts`

## Implementation requirements

1. Apply protocol/host policy, redirect revalidation, DNS/IP controls, size/time limits and MIME/decode validation.
2. Deny private/loopback/link-local destinations for untrusted remote fetches; explicitly configure any required local resource adapter.
3. Cache approved bytes by hash before rendering and deny surprise egress during capture.

## Acceptance criteria

- [ ] An external asset URL cannot reach internal metadata services or local admin endpoints.
- [ ] Redirects and DNS changes cannot bypass the allow/deny policy.
- [ ] Rejected or oversized assets fail with diagnostics and no partial successful build.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-106.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test localhost, IPv6 local, redirects, DNS-rebinding fixture and oversized response.
- Render offline from an approved cached asset set.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-106/result.json`
- `evidence/tickets/AFM-106/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-107 — Protect secrets, source privacy and exported evidence

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-024, AFM-004, AFM-080, AFM-098

## Outcome

Keep source-backed authoring useful without leaking private repository or provider data.

## Source files to inspect and reuse

### H-AUTH — Optional hosted authentication and secret scrubbing

- `hyperframes-main/packages/cli/src/auth/resolver.ts`
- `hyperframes-main/packages/cli/src/auth/store.ts`
- `hyperframes-main/packages/cli/src/auth/scrub.ts`
- `hyperframes-main/packages/cli/src/cloud/auth.ts`

### A-EVID — Source references and engineering metadata

- `archify-main/archify/renderers/shared/repository-evidence.mjs`
- `archify-main/archify/renderers/shared/repository-location.mjs`
- `archify-main/archify/renderers/shared/engineering-profiles.mjs`
- `archify-main/archify/test/repository-evidence.test.mjs`

### H-NET — Update, telemetry and outbound network controls

- `hyperframes-main/packages/cli/src/telemetry/policy.ts`
- `hyperframes-main/packages/cli/src/telemetry/transport.ts`
- `hyperframes-main/packages/cli/src/utils/autoUpdate.ts`
- `hyperframes-main/packages/cli/src/utils/updateCheck.ts`
- `hyperframes-main/packages/engine/src/utils/urlDownloader.ts`

## Proposed target files / areas

- `packages/studio-server/src/security/secrets.ts`
- `packages/project-model/src/redaction.ts`

## Implementation requirements

1. Store credentials in an appropriate local secret/config boundary outside project/export documents.
2. Redact sensitive values from logs, diagnostics, prompts and public artifacts; preserve auditability without exposing private contents.
3. Require explicit source-sharing policy before external model/provider submission and keep public narration grounded in approved evidence.

## Acceptance criteria

- [ ] No secrets appear in compiled HTML, receipts, ZIP exports or crash reports.
- [ ] Public artifacts remove private paths from hidden metadata as well as visible labels.
- [ ] External AI access cannot silently upload an entire repository.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-107.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Seed test tokens/paths and scan every export/log surface.
- Test provider failure exceptions and denied source-sharing policy.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-107/result.json`
- `evidence/tickets/AFM-107/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-108 — Enforce render worker and process isolation

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-055, AFM-104, AFM-105, AFM-106

## Outcome

Bound browser/encoder jobs without granting them the application's privileges.

## Source files to inspect and reuse

### H-PROCESS — Worker lifecycle, resource and process tracking

- `hyperframes-main/packages/engine/src/utils/managedChildProcess.ts`
- `hyperframes-main/packages/engine/src/utils/processTracker.ts`
- `hyperframes-main/packages/engine/src/services/browserManager.ts`
- `hyperframes-main/packages/engine/src/services/systemMemory.ts`

### H-CAPTURE — Frame capture and encoding

- `hyperframes-main/packages/engine/src/services/frameCapture.ts`
- `hyperframes-main/packages/engine/src/services/chunkEncoder.ts`
- `hyperframes-main/packages/engine/src/services/streamingEncoder.ts`
- `hyperframes-main/packages/engine/src/utils/renderProvenance.ts`

### H-CLOUD — Optional deployment adapters and container packaging

- `hyperframes-main/packages/aws-lambda/src/index.ts`
- `hyperframes-main/packages/gcp-cloud-run/package.json`
- `hyperframes-main/packages/cli/src/docker/Dockerfile.render`
- `hyperframes-main/packages/cli/src/commands/cloudrun.ts`
- `hyperframes-main/packages/cli/src/commands/lambda.ts`

## Proposed target files / areas

- `packages/studio-server/src/security/renderWorker.ts`
- `packages/cli/src/docker/Dockerfile.render`

## Implementation requirements

1. Run jobs with controlled workspace/output mounts, resource/time limits, restricted egress and no provider/application secrets.
2. Retain process ownership tracking and ensure cleanup only targets processes belonging to the job.
3. Document browser sandbox/container requirements and distinguish local trusted use from a hardened multi-user deployment.

## Acceptance criteria

- [ ] A hostile composition cannot read unrelated projects or keep unbounded child processes alive.
- [ ] Timeout/cancellation reclaims owned resources.
- [ ] Hosted multi-user support is not claimed solely because local Docker rendering works.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-108.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test infinite script, memory pressure, encoder hang and process escape attempts in a bounded test environment.
- Verify no secret environment variables reach the render child.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-108/result.json`
- `evidence/tickets/AFM-108/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-109 — Secure the local API and deny accidental public hosting

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-051, AFM-105, AFM-107

## Outcome

Protect the default local application from browser-origin and network misuse.

## Source files to inspect and reuse

### H-SERVER — Existing API host and project resolution

- `hyperframes-main/packages/studio-server/src/createStudioApi.ts`
- `hyperframes-main/packages/studio-server/src/types.ts`
- `hyperframes-main/packages/studio-server/src/routes/projects.ts`
- `hyperframes-main/packages/cli/src/server/studioServer.ts`

### H-AUTH — Optional hosted authentication and secret scrubbing

- `hyperframes-main/packages/cli/src/auth/resolver.ts`
- `hyperframes-main/packages/cli/src/auth/store.ts`
- `hyperframes-main/packages/cli/src/auth/scrub.ts`
- `hyperframes-main/packages/cli/src/cloud/auth.ts`

## Proposed target files / areas

- `packages/studio-server/src/security/localAccess.ts`
- `docs/security/deployment-modes.md`

## Implementation requirements

1. Bind loopback by default, validate Host/Origin and protect state-changing routes against cross-site requests.
2. Add session/capability authorization for editor-to-API operations without requiring an upstream account.
3. Require explicit hardened configuration before non-loopback binding; do not ship implied tenant security or collaboration.

## Acceptance criteria

- [ ] An unrelated webpage cannot mutate or read a local project through the API.
- [ ] Remote binding fails closed without explicit configured protection.
- [ ] Native preview trust cannot be used as an API authentication bypass.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-109.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test cross-origin requests, DNS-rebinding host headers and invalid local capability tokens.
- Verify the ordinary local editor still opens and renders without upstream login.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-109/result.json`
- `evidence/tickets/AFM-109/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-110 — Handle concurrency, quotas and filesystem exhaustion

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-020, AFM-055, AFM-077, AFM-108

## Outcome

Keep one overloaded project from making the application lose work.

## Source files to inspect and reuse

### H-PROCESS — Worker lifecycle, resource and process tracking

- `hyperframes-main/packages/engine/src/utils/managedChildProcess.ts`
- `hyperframes-main/packages/engine/src/utils/processTracker.ts`
- `hyperframes-main/packages/engine/src/services/browserManager.ts`
- `hyperframes-main/packages/engine/src/services/systemMemory.ts`

### H-PERSIST — SDK persistence and project file writes

- `hyperframes-main/packages/sdk/src/persist-queue.ts`
- `hyperframes-main/packages/sdk/src/adapters/fs.ts`
- `hyperframes-main/packages/studio-server/src/helpers/backupJournal.ts`
- `hyperframes-main/packages/studio-server/src/helpers/fileVersion.ts`

### H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts`
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`

## Proposed target files / areas

- `packages/studio-server/src/services/resourcePolicy.ts`
- `packages/project-model/src/storage/spaceBudget.ts`

## Implementation requirements

1. Bound compile/render concurrency and asset/upload/output storage usage with clear admission errors.
2. Check disk headroom before large jobs and handle mid-job exhaustion without publishing partial outputs.
3. Schedule cleanup under immutable-reference rules and preserve recoverable drafts and running jobs.

## Acceptance criteria

- [ ] Quota rejection does not corrupt the current project.
- [ ] Concurrent jobs use disjoint staging paths and do not overwrite outputs.
- [ ] Disk-full errors remain actionable and retryable after cleanup.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-110.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test concurrent output-name collisions, low disk and cancellation while cleanup runs.
- Load a large diagram and oversized media within bounded test limits.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-110/result.json`
- `evidence/tickets/AFM-110/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-111 — Produce software and asset provenance/security inventories

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-004, AFM-009, AFM-103, AFM-107

## Outcome

Make release composition and dependency risk auditable.

## Source files to inspect and reuse

### H-LICENSE — License, contribution and security records

- `hyperframes-main/LICENSE`
- `hyperframes-main/CREDITS.md`
- `hyperframes-main/SECURITY.md`
- `hyperframes-main/CONTRIBUTING.md`

### A-LICENSE — Attribution and third-party asset constraints

- `archify-main/LICENSE`
- `archify-main/THIRD_PARTY_NOTICES.md`
- `archify-main/archify/THIRD_PARTY_NOTICES.md`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

## Proposed target files / areas

- `tools/quality/sbom.ts`
- `docs/security/dependency-review.json`
- `provenance/asset-rights.json`

## Implementation requirements

1. Generate an SBOM from the committed lockfile and record licenses/security findings with explicit dispositions.
2. Include source relocation/modification history and separately reviewed third-party assets.
3. Scan shipped artifacts for secrets, unexpected executable hooks and unapproved external endpoint defaults.

## Acceptance criteria

- [ ] Release manifests match the actual built artifact contents and dependency lock.
- [ ] Critical unresolved dependency or secret findings block release under the written policy.
- [ ] Asset/source license review is not conflated with trademark or hosted-service rights.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-111.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Inject a fake secret and a disallowed packaged asset and verify failure.
- Compare SBOM dependency identities against the lockfile and packed manifests.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-111/result.json`
- `evidence/tickets/AFM-111/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-112 — Run adversarial and offline security acceptance

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E12 — Local-first security and resilient execution  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-103, AFM-104, AFM-105, AFM-106, AFM-107, AFM-108, AFM-109, AFM-110, AFM-111

## Outcome

Validate the actual cross-system security boundaries.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts`
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts`
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts`
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts`

### H-NET — Update, telemetry and outbound network controls

- `hyperframes-main/packages/cli/src/telemetry/policy.ts`
- `hyperframes-main/packages/cli/src/telemetry/transport.ts`
- `hyperframes-main/packages/cli/src/utils/autoUpdate.ts`
- `hyperframes-main/packages/cli/src/utils/updateCheck.ts`
- `hyperframes-main/packages/engine/src/utils/urlDownloader.ts`

## Proposed target files / areas

- `tests/security/`
- `docs/security/threat-model.md`
- `evidence/security/`

## Implementation requirements

1. Execute traversal/archive, HTML isolation, local API, SSRF, secrets, worker resource and offline-network tests.
2. Document trust assumptions, residual risks and explicitly unsupported hosted modes.
3. Preserve proof of denied operations and inspect outputs for leakage rather than relying only on code review.

## Acceptance criteria

- [ ] No critical security acceptance test is skipped under a claim of production readiness.
- [ ] Offline baseline passes with preinstalled dependencies and approved assets.
- [ ] Optional external/cloud evidence is labeled separately from local security.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-112.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run the full hostile-project corpus and network-observed local workflow.
- Repeat at least path/API/render isolation scenarios on the release platform matrix.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-112/result.json`
- `evidence/tickets/AFM-112/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E13 — Regression, performance and platform certification

# AFM-113 — Build a traceable integration fixture corpus

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-008, AFM-013, AFM-014, AFM-018

## Outcome

Cover semantic and presentation edge cases without relying on only one happy-path example.

## Source files to inspect and reuse

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

### A-WORK — Workflow compile, migrate, and branch semantics

- `archify-main/archify/renderers/workflow/render-workflow.mjs`
- `archify-main/archify/renderers/workflow/workflow-compiler.mjs`
- `archify-main/archify/migrations/workflow-v2.mjs`
- `archify-main/archify/schemas/workflow.schema.json`
- `archify-main/archify/examples/agent-tool-call.workflow.json`

### A-SEQ — Ordered messages and participants

- `archify-main/archify/renderers/sequence/render-sequence.mjs`
- `archify-main/archify/schemas/sequence.schema.json`
- `archify-main/archify/examples/cache-miss-request.sequence.json`
- `archify-main/archify/test/sequence-column-fit.test.mjs`

### A-DATA — Dataflow renderer, schema and examples

- `archify-main/archify/renderers/dataflow/render-dataflow.mjs`
- `archify-main/archify/schemas/dataflow.schema.json`
- `archify-main/archify/examples/product-analytics.dataflow.json`
- `archify-main/archify/examples/event-stream.dataflow.json`

### A-LIFE — Lifecycle states and transitions

- `archify-main/archify/renderers/lifecycle/render-lifecycle.mjs`
- `archify-main/archify/schemas/lifecycle.schema.json`
- `archify-main/archify/examples/agent-run.lifecycle.json`
- `archify-main/archify/examples/deployment-release.lifecycle.json`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

## Proposed target files / areas

- `tests/fixtures/unified/`
- `docs/quality/fixtures.json`

## Implementation requirements

1. Create fixtures for branches, parallel/reverse edges, loops, repeated messages, long labels, multiple instances and mixed native media.
2. Record source/provenance and expected facts separately from generated image baselines.
3. Add invalid fixtures for reference, timing, asset, migration and privacy failures.

## Acceptance criteria

- [ ] Every critical acceptance invariant maps to one or more fixtures.
- [ ] Golden images cannot overwrite expected topology facts.
- [ ] Fixture assets are reviewed and locally available where offline tests require them.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-113.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Validate every fixture and expected-failure reason.
- Verify baseline updates require an explicit reviewed command and diff.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-113/result.json`
- `evidence/tickets/AFM-113/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-114 — Add schema, identity and property-based semantic tests

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-028, AFM-018, AFM-025, AFM-043, AFM-113

## Outcome

Find relationship and timing corruption beyond hand-authored examples.

## Source files to inspect and reuse

### A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json`
- `archify-main/archify/renderers/shared/validator.mjs`
- `archify-main/archify/renderers/shared/generated-validators.mjs`
- `archify-main/archify/scripts/generate-validators.mjs`

### A-REACH — Authored graph inspection and sharing

- `archify-main/archify/test/authored-reachability.test.mjs`
- `archify-main/archify/test/route-probe.test.mjs`
- `archify-main/archify/test/relationship-direct-explorer.test.mjs`
- `archify-main/archify/test/relationship-permalink.test.mjs`
- `archify-main/archify/test/reach-share-card.test.mjs`

### H-PARSER — DOM identities, GSAP and roundtrip editing

- `hyperframes-main/packages/parsers/src/hfIds.ts`
- `hyperframes-main/packages/parsers/src/hfIdAssignment.ts`
- `hyperframes-main/packages/parsers/src/gsapParser.ts`
- `hyperframes-main/packages/parsers/src/gsapSerialize.ts`
- `hyperframes-main/packages/parsers/src/htmlParser.ts`

## Proposed target files / areas

- `tests/properties/diagram-identities.test.ts`
- `tests/properties/story-topology.test.ts`

## Implementation requirements

1. Generate bounded random valid/invalid diagrams for each supported identity/relationship contract.
2. Apply reorder/rename/duplicate/delete transformations and verify identity preservation or explicit conflicts.
3. Check timing conversion and authored-edge animation invariants across generated stories with repeatable seeds.

## Acceptance criteria

- [ ] Every animated relationship exists in the authored source.
- [ ] Permuting unrelated array order never retargets an override.
- [ ] Failing seeds are recorded and reproducible.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-114.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run seeded property suites with parallel edges and repeated messages.
- Introduce positional-ID and float-drift mutations and verify detection.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-114/result.json`
- `evidence/tickets/AFM-114/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-115 — Gate visual correctness and preview/render parity

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-050, AFM-084, AFM-094, AFM-113

## Outcome

Catch blank/clipped/wrong-state frames in real output.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-CAPTURE — Frame capture and encoding

- `hyperframes-main/packages/engine/src/services/frameCapture.ts`
- `hyperframes-main/packages/engine/src/services/chunkEncoder.ts`
- `hyperframes-main/packages/engine/src/services/streamingEncoder.ts`
- `hyperframes-main/packages/engine/src/utils/renderProvenance.ts`

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

## Proposed target files / areas

- `tests/regression/unified-visual.test.ts`
- `tools/quality/visualReceipt.ts`

## Implementation requirements

1. Capture selected frames from preview and producer under pinned browser/assets/output settings.
2. Compare semantic state exactly and images with documented tolerances; inspect labels, arrows, captions, clipping and scene transitions.
3. Store contact sheets/probe metadata and review visual baseline changes independently from source test success.

## Acceptance criteria

- [ ] First/middle/final and every transition boundary have meaningful content.
- [ ] No missing marker/font/asset is hidden by a broad pixel tolerance.
- [ ] Reproducibility claims state the exact tested environment.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-115.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run all-family and native-only visual suites.
- Inject missing font, CSS leakage and a stateful animation to prove the gate fails.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-115/result.json`
- `evidence/tickets/AFM-115/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-116 — Define and enforce realistic performance budgets

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-077, AFM-110, AFM-113

## Outcome

Keep the unified editor usable on documented hardware without invented benchmarks.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-PROCESS — Worker lifecycle, resource and process tracking

- `hyperframes-main/packages/engine/src/utils/managedChildProcess.ts`
- `hyperframes-main/packages/engine/src/utils/processTracker.ts`
- `hyperframes-main/packages/engine/src/services/browserManager.ts`
- `hyperframes-main/packages/engine/src/services/systemMemory.ts`

### A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs`
- `archify-main/archify/renderers/shared/text-fit.mjs`
- `archify-main/archify/renderers/shared/desktop-readability.mjs`
- `archify-main/archify/renderers/shared/layout-report.mjs`
- `archify-main/archify/test/geometry.test.mjs`

## Proposed target files / areas

- `tools/quality/performance.ts`
- `docs/quality/performance-budgets.json`

## Implementation requirements

1. Measure initial compile, incremental edit latency, selection/outline response, memory and render throughput across small/medium/large fixtures.
2. Establish reviewed budgets from real baseline measurements and publish hardware/environment metadata.
3. Optimize bottlenecks using caches, bounded concurrency and virtualization without weakening validation or changing semantics.

## Acceptance criteria

- [ ] Performance results are measurements, not guessed promises.
- [ ] Budget regressions fail the agreed release/performance tier.
- [ ] Large inputs fail gracefully when resource limits are reached.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-116.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run repeated cold/warm builds and burst edits with median/tail metrics.
- Compare correctness before/after each optimization and test constrained-memory behavior.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-116/result.json`
- `evidence/tickets/AFM-116/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-117 — Certify Windows, macOS and Linux developer workflows

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-010, AFM-016, AFM-086, AFM-104, AFM-113

## Outcome

Ensure the user can move between Windows and Mac without relying on Unix-only assumptions.

## Source files to inspect and reuse

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### H-CLOUD — Optional deployment adapters and container packaging

- `hyperframes-main/packages/aws-lambda/src/index.ts`
- `hyperframes-main/packages/gcp-cloud-run/package.json`
- `hyperframes-main/packages/cli/src/docker/Dockerfile.render`
- `hyperframes-main/packages/cli/src/commands/cloudrun.ts`
- `hyperframes-main/packages/cli/src/commands/lambda.ts`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `.github/workflows/platform-smoke.yml`
- `docs/quality/platform-support.md`

## Implementation requirements

1. Test supported Node/Bun versions, path quoting, line endings, file watching, safe saves and local browser/FFmpeg discovery on each declared platform.
2. Define Linux container rendering as the pinned reference when native GPU/font parity differs.
3. Record native versus container-supported capabilities and unverified modes explicitly.

## Acceptance criteria

- [ ] A clean checkout installs, launches and opens a project on the declared editor platforms.
- [ ] At least the declared production render target produces a real inspected artifact.
- [ ] Unsupported platform features are not silently hidden under a universal support claim.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-117.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run paths-with-spaces/Unicode and save/reopen/watch tests across the matrix.
- Run native or explicitly documented container render smoke tests and record which actually ran.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-117/result.json`
- `evidence/tickets/AFM-117/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-118 — Test long-session durability and resource cleanup

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-076, AFM-077, AFM-110, AFM-117

## Outcome

Catch leaks and state corruption from repeated editing and rendering.

## Source files to inspect and reuse

### H-PROCESS — Worker lifecycle, resource and process tracking

- `hyperframes-main/packages/engine/src/utils/managedChildProcess.ts`
- `hyperframes-main/packages/engine/src/utils/processTracker.ts`
- `hyperframes-main/packages/engine/src/services/browserManager.ts`
- `hyperframes-main/packages/engine/src/services/systemMemory.ts`

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

## Proposed target files / areas

- `tests/soak/unified-session.test.ts`
- `docs/quality/soak-results.json`

## Implementation requirements

1. Exercise many edit/undo/regenerate/open/close/render/cancel cycles with a seeded operation log.
2. Track process, file handle, memory, temporary-directory and cache growth.
3. Verify periodic saves and recovery yield the exact expected committed state.

## Acceptance criteria

- [ ] No unbounded owned browser/encoder process accumulation remains.
- [ ] Repeated reopen/recovery preserves source and presentation hashes.
- [ ] Performance/memory growth is compared to measured baselines with explicit tolerances.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-118.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run mixed-project cycles with occasional injected save/render failures.
- Verify resource cleanup and last-valid state after termination.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-118/result.json`
- `evidence/tickets/AFM-118/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-119 — Automate capability evidence and no-drift validation

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-008, AFM-094, AFM-102, AFM-112, AFM-115, AFM-117, AFM-118

## Outcome

Prevent file counts, mocks or retained source from being mistaken for integrated functionality.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

## Proposed target files / areas

- `tools/quality/capabilityGate.ts`
- `docs/quality/capabilities.json`

## Implementation requirements

1. Join capabilities to tickets, test receipts, actual artifact hashes and declared support modes.
2. Require independent status fields for baseline, UI, renderer and external live verification.
3. Reject forbidden end states: runtime sibling apps, screenshot-only diagrams, permanent HTML scraping API, dual save/undo ownership or fabricated render evidence.

## Acceptance criteria

- [ ] Every required local capability has passing release-candidate evidence.
- [ ] Optional live services remain visibly unverified until real tests run.
- [ ] Any missing release-critical artifact makes the gate fail, even if unit tests pass.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-119.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Delete a video artifact, mark a skipped test passed and inject a sibling CLI dependency; verify each fails.
- Validate a legitimately blocked optional live integration without falsely claiming cloud support.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-119/result.json`
- `evidence/tickets/AFM-119/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-120 — Run final end-to-end product acceptance scenarios

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E13 — Regression, performance and platform certification  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-078, AFM-094, AFM-102, AFM-112, AFM-115, AFM-116, AFM-117, AFM-119

## Outcome

Prove the fully unified product from clean source to deliverable outputs.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs`
- `archify-main/archify/bin/visual-check.mjs`
- `archify-main/archify/test/share-card-export.test.mjs`
- `archify-main/archify/test/webm-artifact.smoke.mjs`
- `archify-main/archify/test/golden.mjs`

## Proposed target files / areas

- `tests/e2e/release-acceptance.spec.ts`
- `docs/quality/release-acceptance.md`

## Implementation requirements

1. Run diagram semantic edit -> scene edit -> undo -> regenerate -> reopen -> actual render in one Studio for all five types.
2. Include a native-only project, all-family mixed project, architecture delta review and local narration/captions.
3. Verify security, provenance, asset readiness, cross-platform declarations and known limitations against the release matrix.

## Acceptance criteria

- [ ] All required local end-to-end scenarios pass without original raw folders or upstream service accounts.
- [ ] Real artifacts match reopened source and output settings.
- [ ] No production/full-local-scope claim until missing required evidence is resolved.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-120.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Execute on a clean release-candidate checkout and pinned render environment.
- Independently inspect emitted project bundles, videos, subtitles and redaction behavior.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-120/result.json`
- `evidence/tickets/AFM-120/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E14 — Custom-product release and complete repo handoff

# AFM-121 — Apply product branding, CLI identity and optional scope rename

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-095, AFM-097, AFM-004, AFM-016

## Outcome

Present a genuinely custom product without destroying provenance or compatibility.

## Source files to inspect and reuse

### H-SHELL — Application shell, project browser and panels

- `hyperframes-main/packages/studio/src/App.tsx`
- `hyperframes-main/packages/studio/src/components/EditorShell.tsx`
- `hyperframes-main/packages/studio/src/components/StudioLeftSidebar.tsx`
- `hyperframes-main/packages/studio/src/components/StudioRightPanel.tsx`
- `hyperframes-main/packages/studio/src/components/StudioHeader.tsx`

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

### A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json`
- `archify-main/archify/package-lock.json`
- `archify-main/archify/bin/archify.mjs`
- `archify-main/archify/skill-release.json`

## Proposed target files / areas

- `packages/studio/src/components/StudioHeader.tsx`
- `packages/cli/package.json`
- `package.json`
- `docs/branding.md`

## Implementation requirements

1. Use ArchFrame Studio only as a working name until the owner chooses final branding; centralize visible product strings and command name.
2. Retain upstream notices and deliberate compatibility aliases.
3. Keep internal @hyperframes package scopes initially unless a single tested atomic rename of imports/build/export/tooling is authorized.

## Acceptance criteria

- [ ] UI/help/errors/templates identify the custom product consistently.
- [ ] Original copyright/license attribution remains intact.
- [ ] Package rename cannot cause resolution to public upstream packages accidentally.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-121.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Scan visible strings and run CLI/help/packed-package tests.
- Test compatibility aliases and startup after any approved scope rename.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-121/result.json`
- `evidence/tickets/AFM-121/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-122 — Package local development and self-hosted single-user deployment

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-117, AFM-108, AFM-109, AFM-121

## Outcome

Ship one repo with a clear local and controlled self-hosted execution path.

## Source files to inspect and reuse

### H-CLOUD — Optional deployment adapters and container packaging

- `hyperframes-main/packages/aws-lambda/src/index.ts`
- `hyperframes-main/packages/gcp-cloud-run/package.json`
- `hyperframes-main/packages/cli/src/docker/Dockerfile.render`
- `hyperframes-main/packages/cli/src/commands/cloudrun.ts`
- `hyperframes-main/packages/cli/src/commands/lambda.ts`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

### H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts`
- `hyperframes-main/packages/cli/src/commands/init.ts`
- `hyperframes-main/packages/cli/src/commands/preview.ts`
- `hyperframes-main/packages/cli/src/commands/doctor.ts`
- `hyperframes-main/packages/cli/src/help.ts`

## Proposed target files / areas

- `Dockerfile`
- `compose.yaml`
- `docs/deployment/local.md`
- `docs/deployment/single-user.md`

## Implementation requirements

1. Provide root install/build/dev/test commands and a pinned single-user container deployment with persistent project storage and bounded render workers.
2. Keep application and render processes separable inside one repository/release; avoid adding an unrelated backend stack.
3. Document TLS/reverse-proxy/auth requirements for remote use and leave multi-tenant collaboration explicitly out of the local release claim.

## Acceptance criteria

- [ ] A clean environment can build and launch from the new repo alone.
- [ ] Container restart preserves projects and does not expose secrets to render workers.
- [ ] No upstream publish/hosted account is required for the local path.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-122.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run clean-machine and container persistence/render smoke tests.
- Test permissions, restart and rejected unauthenticated remote access.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-122/result.json`
- `evidence/tickets/AFM-122/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-123 — Write developer contracts and migration/runbook documentation

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-027, AFM-051, AFM-072, AFM-095, AFM-122

## Outcome

Enable another engineer or coding agent to maintain the merged product without rediscovering ownership rules.

## Source files to inspect and reuse

### H-SKILL — Coding agent instructions and bundled skills

- `hyperframes-main/AGENTS.md`
- `hyperframes-main/CLAUDE.md`
- `hyperframes-main/skills/pr-to-video/SKILL.md`
- `hyperframes-main/skills-manifest.json`
- `hyperframes-main/scripts/check-skill-mirror.mjs`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

## Proposed target files / areas

- `docs/development/`
- `docs/api/`
- `docs/migration/`
- `docs/operations/`

## Implementation requirements

1. Document package boundaries, source-to-artifact compilation, project commands/history, revision storage and render time contracts.
2. Provide migration examples for raw diagrams and native projects, recovery procedures and platform prerequisites.
3. Include verified command transcripts and exact optional provider requirements; label proposed versus implemented interfaces.

## Acceptance criteria

- [ ] Examples execute against the release candidate without guessed command flags.
- [ ] Recovery and migration instructions preserve user data.
- [ ] No documentation suggests separate upstream apps as the normal runtime.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-123.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run doc command smoke tests in a temporary checkout.
- Follow migration and crash-recovery runbooks using a fresh fixture project.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-123/result.json`
- `evidence/tickets/AFM-123/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-124 — Create demo projects and human-verifiable acceptance evidence

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-086, AFM-094, AFM-120, AFM-123

## Outcome

Make the finished product demonstrable beyond screenshots of copied source.

## Source files to inspect and reuse

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

### A-DELTA — Before/after receipts and geometry

- `archify-main/archify/delta/architecture-delta.mjs`
- `archify-main/archify/test/architecture-delta.test.mjs`
- `archify-main/archify/examples/checkout-platform.base.architecture.json`
- `archify-main/archify/examples/checkout-platform.head.architecture.json`

### H-STYLE — Existing themes and native animated graph reference

- `hyperframes-main/themes/CONTRACT.md`
- `hyperframes-main/themes/editorial.css`
- `hyperframes-main/registry/blocks/flowchart/flowchart.html`
- `hyperframes-main/registry/blocks/flowchart-vertical/flowchart-vertical.html`

## Proposed target files / areas

- `examples/unified/`
- `docs/demos/`
- `evidence/demo-manifest.json`

## Implementation requirements

1. Ship source projects for architecture, workflow, sequence, dataflow, lifecycle, mixed media and architecture-change review.
2. Provide generation scripts and rendered evidence with exact input/build hashes; keep large media outside source history when appropriate.
3. Include short workflows showing semantic edits and regeneration-safe presentation customization.

## Acceptance criteria

- [ ] Every demo rebuilds from approved source/assets on the declared environment.
- [ ] A reviewer can inspect actual outputs and the underlying project.
- [ ] Demos do not claim unverified model reasoning, cloud behavior or runtime impact.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-124.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Rebuild all demos from a clean checkout.
- Verify provenance and compare visible labels/paths with their source diagrams.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-124/result.json`
- `evidence/tickets/AFM-124/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-125 — Finalize upstream update and patch maintenance tooling

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-007, AFM-011, AFM-111, AFM-123

## Outcome

Keep ownership sustainable after both upstream forks evolve.

## Source files to inspect and reuse

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `tools/upstream/`
- `docs/upstream/maintenance.md`
- `provenance/modification-ledger.json`

## Implementation requirements

1. Implement read-only snapshot diff and import-map-aware patch review helpers.
2. Record intentional divergence and prohibit automatic overwrite of project-model/diagram-motion/Studio integration.
3. Require full affected baseline/integration suites for any imported upstream change, with safe rollback commits.

## Acceptance criteria

- [ ] Updating an upstream snapshot is a reviewable change with hashes and provenance.
- [ ] Owned modifications cannot disappear through a bulk copy.
- [ ] Fresh upstream versions never alter production at job runtime.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-125.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Test a hypothetical upstream renderer change and an SDK API change against the mapping.
- Verify rollback restores the previous build and lockfile.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-125/result.json`
- `evidence/tickets/AFM-125/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-126 — Prepare source and runnable release artifacts

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-111, AFM-120, AFM-121, AFM-122, AFM-123, AFM-124

## Outcome

Deliver a complete new repository plus verifiable build outputs.

## Source files to inspect and reuse

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `tools/release/package.ts`
- `tools/release/verify.ts`
- `docs/releases/1.0.0.md`

## Implementation requirements

1. Package source, lockfile, schemas, tests, docs, notices, provenance and approved examples without node_modules, secrets or raw sibling repositories.
2. Generate file manifest, SHA-256 checksums, release notes, SBOM and optional Git bundle of the actual new history.
3. Verify required runtime assets and safe links; large rendered demo artifacts may be separate but must have stable manifest references.

## Acceptance criteria

- [ ] The source archive unpacks and builds independently.
- [ ] Checksums match real artifact bytes and missing-file errors fail packaging.
- [ ] No false claim of upstream Git history or a remotely created fork is made.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-126.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Unpack the release archive into a clean directory and rerun smoke gates.
- Corrupt one file and assert manifest verification fails.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-126/result.json`
- `evidence/tickets/AFM-126/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-127 — Run an independent release-candidate review and defect closure

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-126, AFM-119, AFM-112

## Outcome

Challenge the merged product against the specification before final delivery.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

## Proposed target files / areas

- `docs/quality/release-review.md`
- `docs/quality/open-defects.json`

## Implementation requirements

1. Review code, capability matrix, migration paths, actual artifacts and unverified modes with a separate reviewer process or clearly documented independent pass.
2. Classify defects by data loss/security/semantic fidelity/render correctness/UX and fix release blockers without weakening tests.
3. Re-run affected suites and retain both failing and corrected evidence.

## Acceptance criteria

- [ ] No unresolved release-blocking defect remains hidden by a broad completion claim.
- [ ] Optional unverified hosted/model modes are explicitly stated.
- [ ] Review checks that the result is one custom product, not an external bridge renamed.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-127.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Repeat the decisive end-to-end workflow from the packaged source.
- Verify claimed ticket completion against commits, tests and actual artifacts.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-127/result.json`
- `evidence/tickets/AFM-127/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-128 — Finalize the new repository and handoff without unauthorized publication

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E14 — Custom-product release and complete repo handoff  
**Priority:** P1 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-127, AFM-126, AFM-125

## Outcome

Hand over the complete owned repo with truthful completion and deployment status.

## Source files to inspect and reuse

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

## Proposed target files / areas

- `README.md`
- `DELIVERY_MANIFEST.json`
- `docs/releases/1.0.0.md`

## Implementation requirements

1. Finalize product version metadata, source history, clean working tree, build instructions and known limitations.
2. Include all required code/tests/docs/assets-by-policy and remove dead transitional copies and wrapper-only execution paths.
3. Prepare local release artifacts and explicit remote setup guidance; create/push a GitHub repository only when owner/destination/authorization are known.

## Acceptance criteria

- [ ] One delivered repository contains the implementation and does not depend on raw input folders.
- [ ] Final report lists tested platforms, real outputs, optional unverified modes and all remaining nonblocking issues.
- [ ] No remote fork/repository/publication is claimed unless a real authorized action succeeded.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-128.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Verify clean-checkout build, provenance manifests and release hashes one last time.
- Check no unresolved required ticket or missing delivery file remains.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-128/result.json`
- `evidence/tickets/AFM-128/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# E15 — Milestone acceptance gates

# AFM-129 — G0: Accept the single-workspace source baseline

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E15 — Milestone acceptance gates  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-001, AFM-002, AFM-003, AFM-004, AFM-005, AFM-006, AFM-007, AFM-008, AFM-009, AFM-010, AFM-011, AFM-012, AFM-013, AFM-014, AFM-015, AFM-016

## Outcome

Block deeper integration claims until raw folder import and baseline evidence are trustworthy.

## Source files to inspect and reuse

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `evidence/gates/G0.json`

## Implementation requirements

1. Check intake/relocation notices, one lockfile, disabled upstream publishing and baseline source hashes.
2. Run both original local workflows from the new repo with sibling folders unavailable.
3. Record inherited failures separately; critical local baseline failures prevent gate acceptance.

## Acceptance criteria

- [ ] All required import/workspace acceptance criteria pass.
- [ ] No raw input mutation or runtime sibling dependency exists.
- [ ] Gate receipt references exact commands/artifacts and unresolved failures.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-129.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Re-run clean install/build/launch and baseline fixture checks.
- Deliberately remove original input folders before executing smoke tests.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-129/result.json`
- `evidence/tickets/AFM-129/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-130 — G1: Accept the first native architecture vertical slice

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E15 — Milestone acceptance gates  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-129, AFM-020, AFM-027, AFM-029, AFM-039, AFM-040, AFM-042, AFM-043, AFM-049, AFM-051, AFM-054, AFM-057, AFM-063

## Outcome

Prove one real integrated workflow early without calling it full parity.

## Source files to inspect and reuse

### A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs`
- `archify-main/archify/renderers/architecture/grid.mjs`
- `archify-main/archify/schemas/architecture.schema.json`
- `archify-main/archify/examples/production-deployment.architecture.json`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

## Proposed target files / areas

- `evidence/gates/G1.json`

## Implementation requirements

1. Import deployment architecture, edit a component in Studio and create guided-view scenes plus a native title.
2. Save/reopen, seek backward and render a real MP4 with pinned source/asset hashes.
3. Inspect labels, branch topology, dimensions, frame rate and visible frame content.

## Acceptance criteria

- [ ] All actions use one app/project/command path.
- [ ] No fabricated relationship or flattened screenshot intermediate exists.
- [ ] The report explicitly states remaining families/features are not yet complete.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-130.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Execute the complete UI scenario and retain source/video/probe evidence.
- Verify rendered gateway branches against the authored model.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-130/result.json`
- `evidence/tickets/AFM-130/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-131 — G2: Accept regeneration-safe mixed-content editing

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E15 — Milestone acceptance gates  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-130, AFM-072, AFM-073, AFM-074, AFM-075, AFM-076, AFM-078, AFM-079, AFM-080, AFM-081, AFM-082, AFM-085

## Outcome

Prove shared history and media integration do not lose source or presentation work.

## Source files to inspect and reuse

### H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts`
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts`
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts`
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx`
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

## Proposed target files / areas

- `evidence/gates/G2.json`

## Implementation requirements

1. Edit source plus native media/captions, undo/redo, regenerate and reopen.
2. Delete a referenced relationship and resolve the visible orphaned override.
3. Render with measured local narration and inspect output/audio/captions.

## Acceptance criteria

- [ ] No double history, independent autosave race or silent override loss occurs.
- [ ] Native-only projects remain editable and renderable.
- [ ] Failed saves/external conflicts leave recoverable work.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-131.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run the full regeneration/history and mixed-media scenarios.
- Reopen between operations and compare source/binding hashes.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-131/result.json`
- `evidence/tickets/AFM-131/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-132 — G3: Accept all diagram families and exact change reviews

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E15 — Milestone acceptance gates  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-131, AFM-087, AFM-088, AFM-089, AFM-090, AFM-091, AFM-092, AFM-093, AFM-094

## Outcome

Prevent release scope from quietly stopping at architecture diagrams.

## Source files to inspect and reuse

### A-DELTA — Before/after receipts and geometry

- `archify-main/archify/delta/architecture-delta.mjs`
- `archify-main/archify/test/architecture-delta.test.mjs`
- `archify-main/archify/examples/checkout-platform.base.architecture.json`
- `archify-main/archify/examples/checkout-platform.head.architecture.json`

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

## Proposed target files / areas

- `evidence/gates/G3.json`

## Implementation requirements

1. Run UI/source/history/render acceptance separately for all five diagram kinds.
2. Verify standalone viewer capabilities and exact before/delta/after review output.
3. Update capability rows with real evidence and distinguish optional live integrations.

## Acceptance criteria

- [ ] All five families pass local integration gates.
- [ ] Ordered messages, branches, flows and transitions retain type-specific semantics.
- [ ] Every highlighted architecture change is backed by its receipt.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-132.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run all-family mixed project and per-family edge-case fixtures.
- Inspect change-review video against before/head sources.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-132/result.json`
- `evidence/tickets/AFM-132/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-133 — G4: Accept security, platform and release-candidate quality

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E15 — Milestone acceptance gates  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** AFM-132, AFM-102, AFM-112, AFM-115, AFM-116, AFM-117, AFM-118, AFM-119, AFM-120, AFM-122, AFM-123

## Outcome

Establish the declared local product quality envelope before packaging.

## Source files to inspect and reuse

### H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts`
- `hyperframes-main/packages/producer/src/parity-harness.ts`
- `hyperframes-main/packages/producer/src/regression-harness.ts`
- `hyperframes-main/packages/producer/src/perf-gate.ts`

### H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml`
- `hyperframes-main/.github/workflows/publish.yml`
- `hyperframes-main/.github/workflows/windows-render.yml`
- `hyperframes-main/scripts/check-workspace-contracts.mjs`
- `hyperframes-main/scripts/check-package-cycles.mjs`

## Proposed target files / areas

- `evidence/gates/G4.json`

## Implementation requirements

1. Run offline/security, platform, performance and end-to-end suites with exact environment metadata.
2. Confirm optional provider/cloud/model claims match executed evidence.
3. Check all agreed local capabilities, privacy and recovery paths; reject outstanding critical blockers.

## Acceptance criteria

- [ ] No critical required test is silently skipped.
- [ ] Offline baseline works after prerequisites are installed.
- [ ] Local single-user quality is not mislabeled as multi-tenant/cloud certification.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-133.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run clean-platform and pinned-container smoke/regression tests.
- Inspect actual artifacts and security redaction outputs independently.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-133/result.json`
- `evidence/tickets/AFM-133/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# AFM-134 — G5: Accept and verify the complete new repository

**Status:** PLANNED / NOT IMPLEMENTED

**Epic:** E15 — Milestone acceptance gates  
**Priority:** P0 (ordering, not permission to omit P1)  
**Scope:** required-local  
**Dependencies:** All preceding tickets

## Outcome

Authorize the final completion claim only for a complete tested local product.

## Source files to inspect and reuse

### H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts`
- `hyperframes-main/scripts/set-version.ts`
- `hyperframes-main/scripts/verify-packed-manifests.mjs`
- `hyperframes-main/scripts/studio-runtime-smoke.mjs`
- `hyperframes-main/scripts/package-subpaths.mjs`

### A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs`
- `archify-main/scripts/check-release-identity.mjs`
- `archify-main/scripts/stage-clean-skill.mjs`
- `archify-main/scripts/write-deterministic-zip.mjs`
- `archify-main/scripts/package-smoke.mjs`

## Proposed target files / areas

- `evidence/gates/G5.json`
- `DELIVERY_MANIFEST.json`

## Implementation requirements

1. Check every required ticket, predecessor gate and capability evidence reference.
2. Unpack the final source artifact, build it, reopen demos and render without raw upstream folders.
3. Verify checksums, notices, provenance, known limitations and remote-publication status before handoff.

## Acceptance criteria

- [ ] The deliverable is one custom source repository plus verified release artifacts, not just tickets or a wrapper.
- [ ] All agreed local functionality has actual passing evidence; conditional external features are labeled accurately.
- [ ] Any missing required test/artifact leaves this gate blocked.

## Required tests and failure cases

Proposed acceptance-test entry: `tests/acceptance/AFM-134.test.ts`. Integrate into the existing runner; reuse adjacent upstream tests as well. Documentation-only/gate tickets may use an executable validation script instead of an artificial TypeScript wrapper, recorded in the receipt.

- Run the clean-archive acceptance command set and checksum verifier.
- Compare final delivery manifest against actual filesystem contents.

## Risks and recovery

Source and presentation must remain coherent; failed changes must preserve the last valid revision.

## Completion evidence

- `evidence/tickets/AFM-134/result.json`
- `evidence/tickets/AFM-134/test.log`
- Commit SHA, exact commands/exit codes, source/build versions, actual/expected results, remaining blockers and output hashes where applicable.

---

# Shared execution protocol

## Execution and evidence rules

All work in this ticket is **planned**, not implemented in this package. Listed source files exist in the inspected snapshots; target paths are proposed destinations/new work, not a claim they already exist. Read the exact source and its nearest tests before editing. Reuse inherited implementations rather than rebuilding equivalent systems. Follow `docs/CONTRACTS.md` and `docs/DEFINITION_OF_DONE.md`.

Implement real behavior, regression and failure tests, documentation and a reviewable commit. Do not complete a ticket with stubs, mocks standing in for real integration, skipped required tests, or a passing build alone. For non-UI/data plumbing tickets, a narrow integration test is sufficient; rendering tickets must produce and inspect real video. A missing prerequisite is a blocker recorded in the ticket receipt, not an excuse to mark success.

On failure retain the last valid committed revision and the original source folders. Roll back code through a normal revert/checkpoint rather than deleting user data or imported originals. No automatic push, package publication, infrastructure creation or paid provider use is authorized by this ticket.
