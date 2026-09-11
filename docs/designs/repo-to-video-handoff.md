# Repository-to-video checkpoint

The original 15 commits were pushed to `main` at
`37e2d0a28f282c40340723f65b156aab72f754ea`. This implementation is on
`feat/repo-to-video`. See the AFM-099 receipt for its code commit.

## Reproduce the demonstrated workflow

Follow the root README. Studio runs at `http://127.0.0.1:5190`. Select a public
GitHub URL or a local read-only source mount, review three plans, create editable
projects, change diagram labels/source or scene presentation, save/reopen, and
export the batch. The demo files are in `out/vflow-demo/`; saved projects and
revision histories are in `v-flow-exais_project-data`, not the Windows bind mount.

Intake now also captures implementation files and documentation and extracts
JavaScript/TypeScript syntax observations, local imports/calls, API registration
sites, model fields and declared entry points. Studio exposes searchable
findings, captured line excerpts and unresolved/unsupported analysis. See
`source-understanding.md` and the AFM-093 receipt for current proof and limits.

The current plan generator still uses package membership, explicitly declared
dependencies, script names and language inventory. Replacing those three fixed
templates with meaningful source-grounded stories is the next product step.
Intake analysis is not a configured AI provider, runtime trace or proof of
documentation claims. It never executes inspected repository scripts.

## Owned implementation boundaries

- `project-model`: strict authoring schema, semantic identities, commands,
  immutable source/manifest revisions, one kernel-locked commit pointer,
  idempotency and persisted undo/redo. Failed validation preserves the last state.
- `diagram-engine`: library compilation for all five families, with the original
  renderer algorithms extracted behind thin CLI wrappers; geometry is returned
  directly, not recovered from exported HTML.
- `diagram-motion`: per-scene SVG/CSS namespaces, camera framing and timelines
  that animate only selected authored relationships; standard native composition
  emission lets the existing inliner/player own the clocks.
- `studio-server`: local source inspection, reviewed intake, managed commands,
  content-hashed builds, preview and durable batch aggregation over the existing
  producer adapter. Cross-process batch ownership uses Linux `flock`.
- `studio`: managed project launcher/editor with the retained player and source
  editor. It does not instantiate a competing SDK history/persist queue. Existing
  unmanaged native projects retain the inherited Studio surface.
- `cli project`: the same service/command/batch ingress, plus verified output copy.

## Evidence and boundaries

The focused tests, browser scripts and real render/recovery receipts are under
`evidence/tickets/AFM-099/`. MP4s and screenshots are intentionally ignored by Git;
receipts retain their hashes. The three final films were inspected at multiple
points, including native title scenes, diagram chapters, relationship traces and
cuts. A fractional-FPS recovery file was separately probed and inspected.

The complete 134-ticket contract is not closed. In particular:

| Area | Remaining acceptance |
|---|---|
| Foundation / distribution | AFM-007/008/010/012–016; repair inherited diagram package command paths and prove a complete clean build. Root full-suite success is not claimed. |
| Project contracts | Full schema migrations, exact-byte legacy backups, override/rebase rules, GC and all crash/fault phases. |
| Geometry / motion | Immutable upstream golden comparisons and exhaustive routing/group/label/readability coverage for all five families; numeric seam evidence currently covers the demonstrated films. |
| Studio | Direct manipulation, full native/diagram capability parity, advanced history/regeneration and composition editing beyond the implemented source/scene controls. |
| Source / proposals | Before/head PR reviews and configured-agent proposed-command review. AFM-098 remains open; the deterministic plan cards do not satisfy it. |
| Production | Narration, captions, audio mixing and broader style/output presets. Current videos are silent. |
| Privacy / lifecycle | Complete E12 baseline, active native HTML policy, bounded Git clone storage, receipt/runtime/font pinning, user-facing retention cleanup and crash tests at every producer stage. The inherited font compiler can fetch Google Fonts during compilation. |

G0/G1 and final capability gates remain unpassed. Keep the seven historical
verified tickets separate from the newly exercised implementation slice.

The owner's full 28-area completion contract, excluding security work, is
tracked in `product-completion.md`. None of those areas is fully accepted yet.

## Recovery notes

An initial atomic save on the Windows bind mount failed with directory-rename
`EACCES`. Its data was preserved; active storage moved to the Linux named volume.
One development-server session stopped responding after backend HMR during
implementation. Restarting the owned server restored service; final browser
verification uses a fresh server. The source and prior committed revisions were
preserved. Do not treat these failed attempts as successful acceptance runs.

Original source-audit tests were not re-certified: a broad acceptance attempt
was interrupted after the source scan exceeded its timeout. Focused current
tests are recorded separately. Do not infer the old 153-test result still covers
the new application.
