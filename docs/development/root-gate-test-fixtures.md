# Root-unit catalog and UI test fixtures

Base: `b4bf276f8419bc954df7c68165de8bc08e762db8`.
This is a test-only repair/refactor, NOT a green root-gate receipt or closure of the managed editor journey.

## Retained catalog, not a missing generated directory

The import retained the upstream catalog at `docs/upstream/hyperframes/catalog/`.
`catalogGeneratorInstructions.test.ts` still enumerated `docs/catalog/` during collection,
which stopped the entire file before its tests ran. It now reads the committed retained
pages at the actual destination. It does not copy/regenerate them, reach into `_sources`,
catch a missing directory as an empty list, or skip this coverage. Both `blocks` and
`components` must independently be nonempty; every page must still end with `## Related topics`.
The texture-copy instruction and handwritten-section carry-forward checks are unchanged.
These are retained-page checks plus the existing generator behavior checks, not proof of a
new generated docs-site build.

## One PropertyPanel module graph

The input-coverage file formerly reset modules and dynamically imported the complete panel
inside each of its two full-panel test callbacks. Its already imported primitives, throttle
reset function and React root remained from the preceding module generation. Cold module
initialization also consumed the interaction test's existing five-second timeout.

A hoisted, mutable test-only mode getter now chooses classic or flat with the real panel
imported once during collection. Both variants still render the real panel and dispatch the
same native input, blur and click events. All original assertion expressions remain unchanged.
The actual environment-flag resolver is still covered by `manualEditingAvailability.test.ts`;
it is not being replaced in production. Each case resets the same player store and telemetry
throttle that the rendered panel uses. Cleanup unmounts every root even when one cleanup throws.

This removes a concrete fixture hazard. It is NOT a claim to have independently reproduced or
diagnosed the user's two currently failing PropertyPanel cases: the report did not include their
full stacks, and the installed React 19 / Vitest environment was unavailable to the contributor.
The pinned run must compare exact failure identities, including any PropertyPanel cases outside
this historically implicated input-coverage file.

## Deterministic layout scheduling, not a larger deadline

Timeline virtualization tests already replace geometry and ResizeObserver. They now explicitly
drive the timer/animation-frame scheduler used by that simulated layout. Existing 110/150ms
settle intervals retain their logical duration, and each driven frame advances 17ms. The DOM
readiness predicate remains bounded at 60 frames and now fails when exhausted instead of silently
returning. The two existing 30-second wall-clock test ceilings are unchanged.

The real Timeline, store, geometry, focus, selection, clip-shell and virtualization assertions
are retained. No expected row/clip count, identity, geometry bound or mode behavior is weakened.
A hoisted test-only flag getter covers both virtualization modes without rebuilding the editor
module graph inside the tests. The flag's independent environment-contract tests remain.

Every mounted React root is registered before rendering and disposed by afterEach, even after an
assertion fails. Timers, store state and DOM are reset, and an originally absent layout-property
descriptor is deleted during teardown rather than left patched. This prevents one failed case
from contaminating later cases in the same file. It does not assert that within-file contamination
caused all nine previously reported failures.

Fake time here proves scheduled state transitions, NOT real browser frame rate or latency.
`tests/e2e/timeline-virtualization.mjs`, performance budgets, production scheduling and root
workspace concurrency are unchanged. Real-browser performance and fixed-worker comparisons are
still required. Do not use these unit results to claim contention is the only possible cause.

## Verification boundary

The delivery records exact base-file Git blob hashes, before/after catalog callback results and
an AST audit preserving all 82 original UI assertion expressions. The catalog diagnostic used
uploaded-source catalog pages relocated to the owned layout, not freshly fetched current MDX
bytes. It used the exact current generator and test preimages. Its assertion adapter is NOT Vitest.

The two changed React test files have NOT run in the pinned environment here. TypeScript
transpilation is syntax evidence, not a package typecheck. Run both changed files, their primitive,
flag and viewport neighbors, full Studio, core and root `test:unit`, then lint/format/typecheck.
Preserve prior failures and distinguish framework skips from passes. No root-gate acceptance,
media export, visual sign-off or ticket closure is implied by this contribution.
