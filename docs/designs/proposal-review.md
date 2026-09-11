# Source-backed proposal review checkpoint

AFM-098, AFM-096 and AFM-095 remain in progress. This adds a real review and
command workflow to the managed project editor. It does not complete configured
model integration, story planning, the agent tool catalog or product acceptance.
All 28 areas in `product-completion.md` remain active.

## Current behavior

Open a managed project and select **Proposals**. Import a typed JSON proposal,
inspect canonical source excerpts, claim classifications, command diagnostics and
before/proposed field changes. Revise the JSON, reject the proposal, or accept the
reviewed version as one project command. Rejection does not change the project.
Acceptance uses the existing revision validator, compiler and project journal;
one Undo restores the authoring documents. Review version and content hash stop
a stale review from accepting different content. The accepted revision remains
historical when later edits or undo change the project.

Claims project exact names/summaries from captured source observations or exact
kind/descriptions from observed relationships. Custom wording must be labeled
interpretation or editorial. Documentation, interpretation and editorial wording
each require explicit review. These classifications describe the evidence basis;
even syntax observations do not prove deployment or runtime behavior. Repository
prose is input data, never an instruction to the agent. Captured file bytes are
rehash-checked and source observations are recomputed when reviewing/accepting.

Every changed wording field needs a matching claim binding. New/changed diagram
relationships require an observed connection with matching endpoint identities,
direction, kind and names. Relabeling an endpoint also triggers this check.
An interpretation cannot pass as a verified source observation. Arbitrary native
HTML remains explicitly unverified authored content; full motion/narration
semantic enforcement and detached-scene policies are still unfinished.

The envelope and provider contract are in
`packages/studio-server/src/project/proposalTypes.ts`. The host can inject an
optional `ProjectServiceOptions.proposalProvider`; output is checked against the
project revision and source snapshot. Provider failures return an explicit
unavailable error. The normal Studio host does not yet configure a provider;
the UI exposes that state and the local JSON/CLI path. No model was called in
this checkpoint. The provider test is an adapter contract with a test response.

## CLI and tools

All commands run in the Docker workspace and use the same project service:

```sh
bun run vflow proposal-context --id PROJECT --intake INTAKE --home DATA_HOME
bun run vflow propose --file proposal.json --home DATA_HOME
bun run vflow proposals --id PROJECT --home DATA_HOME
bun run vflow review-proposal --id PROJECT --proposal PROPOSAL --home DATA_HOME
bun run vflow revise-proposal --id PROJECT --proposal PROPOSAL --file revision.json --home DATA_HOME
bun run vflow reject-proposal --id PROJECT --proposal PROPOSAL --file decision.json --home DATA_HOME
bun run vflow accept-proposal --id PROJECT --proposal PROPOSAL --file decision.json --home DATA_HOME
```

`decision.json` contains the reviewed `version`, `contentHash` and, for acceptance,
`acknowledgedClaimIds`. `revision.json` contains `version`, `contentHash` and the
replacement `proposal`. Large CLI responses await the stdout write callback;
this fixes truncated piped source-context JSON observed in the browser journey.

Managed projects reuse the inherited local tool registrar/polyfill for
`project_inspect`, `project_source_context`, `project_propose` and
`project_inspect_proposals`. The existing agent-tools preference is respected.
The complete inspectDiagram/applyCommand/createScene/conflict/render/capability
catalog and full published input schemas still need AFM-096 acceptance. This
checkpoint records actual CLI calls, not a claimed live browser-agent session.

## Evidence and next work

`evidence/tickets/AFM-098/result.json` records the code SHA, commands, hashes and
limitations. Seven focused tests pass, including a real supported edge, reversed
and relabeled endpoints, stale revision/evidence, invalid-batch repair, rejection,
atomic acceptance and undo. The recovery test models a command committed before
its proposal sidecar update; it is not an actual process-kill matrix.

Pinned Chromium exercised CLI context/submission, Studio rejection, typed JSON
revision to version 2, exact source excerpts, field comparison, acceptance at
project revision 1 and undo at revision 2. All original authoring documents were
restored. Desktop and mobile screenshots were inspected. No film was produced
by this checkpoint, and no human factual-usefulness or film-quality approval is
implied. The original fixed manifest story templates remain.

The broad branch audit fails (retained output): complexity in the new review,
schema and grounding functions needs decomposition; unused internal exports and
browser-proof duplication need cleanup. It also reports class methods exercised
by the real routes/CLI. No suppressions were added and no clean-audit claim is made.

Continue with distinct source-backed story planning and actual explanatory
scenes, together with exact before/head capture. Complete provider host
configuration, agent tool coverage, all-family proposal/motion grounding,
cross-process contention/fault evidence and dependency tickets AFM-024/037/061
before claiming these tickets or the product gate passed.
