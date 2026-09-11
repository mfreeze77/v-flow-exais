# Source-supported story drafts

This AFM-093/083 checkpoint replaces the three manifest templates with a bounded
offline planner over captured implementation observations. It is partial product
work under all 28 areas in `product-completion.md`, not full-product acceptance.

The planner discovers connected implementation entries, API registrations,
declared data contracts and documentation claims. It ranks them for developers,
maintainers or new users, adjusts for explanation/onboarding/source review,
penalizes repeated subjects, evidence and families, and returns up to the requested
count. A manifest-only source produces no fabricated films. Requested duration
is a target; insufficient evidence produces a shorter draft with an explanation.

Every draft has a question, selection reason, opening, context when supported,
source-reading beats, payoff, integer frame durations and captured citations.
Call-site columns let long source lines be framed around the referenced call.
The stored evidence remains the original full line. Diagram arrows retain actual
captured relationship IDs and endpoints. They do not turn focus order into graph
connectivity or establish runtime execution order.

Studio exposes audience, purpose, seconds and count, then editable titles,
on-screen headings, scripts and beat durations. Source observations and their
excerpts remain visible alongside editorial limitations. Save validates the
story and compiles the proposed project before updating the draft. Existing
created projects retain their IDs and bytes; changed drafts receive new project
IDs. Concurrent saves merge with the latest other stories. Stale saves and stale
acceptance hashes fail. Unsaved card edits survive saving another card and block
replanning or acceptance until saved.

Creation requires review of the selected drafts and their current hashes. This
acknowledgement records an editorial action; it does not certify the film as
useful, prove every sentence, or invoke a model. Free script wording remains an
editorial draft. Typed factual model proposals use the separate proposal-review
workflow described in `proposal-review.md`.

Generated projects mix editable native title/source/model/takeaway compositions
with compiler-owned diagrams. Native text reveals use short staggered entries;
the existing master cut-the-curve seams and opaque stage ground are retained.
Generated films are currently silent. Full narration, captioning, footage,
portrait/square reframing and finished storytelling remain open.

## CLI workflow

All commands run in Docker. Start with a plan and inspect its complete JSON:

```sh
docker-compose run --rm -T workspace bun packages/cli/src/cli.ts project plan \
  --source packages/studio-server --home /var/lib/vflow \
  --audience maintainers --purpose explain --seconds 40 --count 3
```

`project plan-stories --intake <id> --file options.json` replans the same captured
snapshot. The options file accepts `audience`, `purpose`, `durationSeconds` and
`count`. `project revise-story --intake <id> --proposal <story-id> --file edit.json`
takes `{ "planHash": "<reviewed hash>", "story": <complete revised StoryPlan> }`.
`project accept-stories --intake <id> --file accept.json` takes:

```json
{
  "selected": ["<story-id>"],
  "review": {
    "acknowledged": true,
    "hashes": { "<story-id>": "<current planHash>" }
  }
}
```

Use the same `--home` for each command. `project from-source --reviewed-drafts`
supports an explicitly acknowledged headless draft workflow. It is not a
replacement for reviewing content. Existing `build`, `export`, `resume`,
`batch-status` and `download` commands operate on the created projects/batches.

## Evidence and remaining work

See `evidence/tickets/AFM-093/result.json` and its `story-planning/` artifacts for
exact commands, code SHA, browser results, probes, seam checks and failures.
Historical failed and stale-runtime attempts are retained separately. Repeated
fresh attempts stalled in font resolution and did not cooperatively cancel.
Tracing found unbounded local font fetches and an omitted cancellation signal
at the render orchestrator's compile call. Local requests now have an 8-second
attempt timeout within the existing 20-second shared font budget, and the
orchestrator forwards cancellation. The existing local fallback policy remains;
this does not establish complete font pinning or a passed crash/cancellation gate.

The heuristic selects source-reading subjects; it does not yet understand
product workflows well enough to write a finished explanation. The current
scripts often restate call relationships. The renderer still uses inherited
diagram framing, and complex parallel routes need further visual review.
Before/head/PR analysis, provider-generated story proposals, broader languages,
per-beat source selection in Studio, useful product footage, real narration,
all-family editing and explicit human film review remain required. Font
supplementation can still request Google Fonts before capture; this checkpoint
does not establish network-disabled production or complete asset pinning.
