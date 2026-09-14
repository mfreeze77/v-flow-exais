# Diagram-engine: owned-layout checks without changing rendered styles

Contribution base: `d5c9fa82d5a90a53f84232589a915389f6282c69`.
This is a development/test path migration and complete check dispatch, not a passing
root gate, renderer upgrade, publication approval, or shared-editor acceptance.

## Retain the tests; change where their inputs live

The old Archify layout separated `archify/` (the distributable skill) from root-level
`scripts/`, `docs/`, and `examples/`. The import deliberately split those resources
across owned packages and retained reference directories. Replacing every `../examples`
with the same directory would conflate packaged input examples with repository goldens.

`tools/upstream-archify/owned-layout.mjs` uses `provenance/import-map.json` for exact
file destinations. Declared directory boundaries are explicit. It rejects unknown
root files and split directory mappings instead of selecting the first candidate.
It never reads `_sources`, creates a compatibility checkout, or follows a generated
archive as product authority. The one post-import exception is the npm lock moved
by AFM-009 into retained documentation, not an active nested dependency root.

When an inherited contract accepts `--root` or constructs a temporary skill fixture,
that synthetic root keeps its own original layout. Only references rooted at the
real workspace/engine get translated. Thus deliberately broken release fixtures
remain broken rather than being substituted with the good current checkout.

The associated source migration uses the installed TypeScript parser to find static
imports/re-exports, literal dynamic imports, file URLs, recognized root declarations,
and repository/skill-relative path calls. It preserves test names, assertion methods/thresholds, timeouts and skip conditions.
Path expressions inside assertions are rebased along with other path references. Existing source bytes are read from the reviewed Git
base and must match the working files. The operator reviews the resulting full patch
and approves its content hash before application. Imported archive source is not used
as a replacement for the current, formatted source.

## Historical contracts are not fork publication approval

Rebased upstream release tests check the retained version/document/skill contracts.
They do not make the new private `@hyperframes/diagram-engine` an official upstream
release, activate quarantined automation, authorize network update/install actions,
or certify packing a historical skill as the new application. The current package
name, private flag, exports and bin identity are retained.

Some inherited tests go beyond filesystem location: Git pathspecs, archive staging,
package content and upstream publication assumptions can still require explicit
adaptation. No test is removed or silently exempted by this migration. Any remaining
failure must be inspected and recorded on the actual owned checkout.

## Every check gets its own execution result

`node scripts/test-owned.mjs [--output NEW-DIRECTORY]` attempts brand marks,
validators, artifact styles, retained release identity, goldens and retained tests
independently. A failure in the first command no longer prevents the later checks
from running. It still returns nonzero if any required stage fails.

With `--output`, each stage has separate stdout/stderr files, real exit/signal/error
fields and file hashes. The live receipt identifies work not yet attempted. Missing
process success or missing evidence cannot become a passing gate. These are stage
records, not an invented count of collected/executed test cases. Interrupted records
stay incomplete. The runner does not change test timeouts or global parallelism.

## Styles remain a rendering decision

The committed `src/styles.mjs` and the two restored generated modules are NOT changed.
`check:artifact-styles` remains an exact generated-module comparison and is now an
explicit stage of the complete test command. A known CSS difference therefore keeps
the package gate red until reviewed; the migration cannot claim to clear it.

The extraction implementation is import-safe and verifies its named boundaries.
For valid templates it preserves the former CRLF normalization, CSS sections, order,
suffix and serialized output. Later selectors outside a chosen section remain legal.
No generation occurs merely by importing its functions.

`node scripts/audit-artifact-styles.mjs --output NEW-REPORT.json` reads the committed
single-string module without evaluating it and compares its exported CSS with the
current template extraction. It reports byte/string lengths, hashes, changed-range
bounds and descriptive font/data-URL metadata. It emits no embedded font bytes and
writes no rendering assets. CSS differences return exit 1 (`rendering-review-required`).
Module formatting alone is reported separately from exported CSS equality. Token
counts and matching non-font portions would not establish visual/font equivalence.

The reported 112,766 vs 863,552 character difference has NOT been independently
recomputed by this contribution in the installed current workspace. Run the audit,
review the actual resource/semantics decision and visual results separately. Do not
regenerate or accept a larger font payload just to make the gate green.

## Verification boundary and remaining work

The contribution's delivery includes direct Node tests of the new helpers/runner,
TypeScript-AST migration tests, guarded Git application tests and a rehearsal against
archived source in its imported layout. The latter is NOT the current source tree:
it lacks subsequent production renderer corrections and installed dependencies.
Its passing retained contract cases are not a whole-package or pinned-container pass.

Run all actual diagram stages and root checks on one frozen checkout. CLI failures
remain unmodified: capture its native JSON report, exact file/case identities, process
status and fixed-worker scope before diagnosing them. Variable totals alone do not
establish load contention. No full Studio journey, image/video sign-off, upstream HDR
photograph recovery, or Vite stall-cause resolution is claimed here.
