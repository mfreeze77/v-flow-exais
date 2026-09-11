# Repository understanding checkpoint

This implements part of owner scope item 1 and AFM-093. AFM-093 remains
in progress: before/head pinning, PR deltas and finished change-review bundles
are not implemented. The full completion contract is `product-completion.md`.

## Current behavior

Local and GitHub intake preserve admitted source bytes with SHA-256 hashes.
Analysis consumes those captured bytes. The API and CLI intake response now
includes `facts.understanding`; Studio shows the same result in a searchable
source review panel, including line excerpts and relationships. Existing intake
records without this field still open without the panel.

The owned parser package uses its existing Babel parser for JS/TS/JSX/TSX.
It extracts top-level functions, class methods, interfaces/type-literal fields,
import/re-export sites and recognized Hono/Express/Fastify/Koa route registration
sites. Local named and namespace-imported function calls resolve only against
unambiguous declarations. Repeated call sites remain separate observations.
Shadowed, reassigned, dynamic, external and ambiguous targets remain unresolved.
Markdown heading excerpts are explicitly documentation claims. Manifest entry
declarations carry their own excerpts. Repository text never supplies agent policy.

Observation IDs identify findings within a captured snapshot. They are not a
migration or a cross-revision authoring identity contract. Before/head matching
must implement the exact-delta requirements rather than reuse line identities.

## Evidence and limits

`evidence/tickets/AFM-093/source-understanding/` contains current command logs,
browser results and screenshot hashes. The real Studio-server source review
captures 61 files, parses 58 implementation files and exposes 568 observations.
Desktop (1440px) and mobile (390px) screenshots were inspected; API filtering,
source selection and exact route excerpts were exercised in pinned Chromium.
No new video was generated or accepted as useful by this checkpoint.

Focused tests, package typechecks, lint and browser checks pass. The broader
`fallow audit --base origin/main --fail-on-issues` fails: the branch has dead-code,
complexity and duplication findings, including new complexity in the syntax
extractor, understanding assembler and review component. Its full output is
retained as `source-understanding/fallow.log`; this is not a clean-audit claim.
Split and simplify the new analysis collectors as part of continuing this work.

The syntax adapters do not yet resolve workspace package aliases, re-exported
call targets, dynamic dispatch, inline route-handler bodies or other languages.
Other recognized language files are captured and reported as unsupported.
Documentation truth and runtime availability are unverified. Capture excludes
generated/dependency/test/hidden inputs and is bounded to 10,000 paths, 512 KB
per file and 32 MB total. Local working-tree capture is per file, not an atomic
Git snapshot; intake still blocks the request while inspecting source.

The old manifest templates remain in `videoProposals.ts`. Next, feed reviewed
observations into typed factual claims, evidence-backed story candidates,
audience/purpose/length/count settings and proposal revisions. Keep all 28
product requirements open until their actual acceptance is proven.
