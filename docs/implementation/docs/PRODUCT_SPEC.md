# Complete local-product scope

## Decision and precedence

Build one owned, deeply integrated monorepo from the supplied Archify and HyperFrames sources. This is not merely source colocation, a CLI wrapper, screenshot import or a pair of apps connected by an export command. The user decision and this v2 package supersede the earlier bridge recommendation and AF-001–AF-024 backlog. The earlier single-repo blueprint remains historical context; this package supplies the expanded execution requirements. Conflicts found during implementation require an explicit architecture decision and capability amendment, not silent scope reduction.

The snapshots are authoritative for implementation interfaces. Current public docs are context, not authorization to replace source with latest main. A downloaded folder with different bytes requires a drift review. ZIP comments contain revision-like identifiers, recorded as candidates; this pack did not independently verify their upstream commits and does not possess upstream Git history.

## Required user journey

One Studio can open/import a diagram or native composition project; inspect its source and relationships; edit real semantic fields and layout; create guided-view scenes; select the same object across canvas, outline, inspector and timeline; customize camera, node emphasis, real-edge motion and callouts; mix ordinary native titles/media/effects; add local narration and captions; undo coherently; regenerate without losing valid presentation edits; resolve conflicts; save/reopen; and export editable projects, standalone diagrams, supported stills and real videos.

All five Archify types are required: architecture, workflow, sequence, dataflow and lifecycle. The first architecture slice is only an early milestone. Source retention alone is never integration evidence. Native-only HyperFrames composition projects remain supported and must not be forced into a diagram format.

## Repository and package direction

Use the HyperFrames Bun workspace and existing Studio/server/SDK/player/core/producer stack as the structural foundation. Retain useful packages including deployment adapters; audit their optional service boundaries. Bring Archify into owned diagram-engine and diagram-viewer packages. Add project-model and diagram-motion. Keep current internal scopes and `.mjs` where practical until a separately tested rename/refactor provides value.

```text
archframe-studio/
  package.json
  bun.lock
  packages/
    studio/ studio-server/ cli/ core/ parsers/ sdk/
    player/ engine/ producer/ lint/ shader-transitions/
    aws-lambda/ gcp-cloud-run/ sdk-playground/
    diagram-engine/ diagram-viewer/ project-model/ diagram-motion/
  skills/ templates/ examples/ tests/ tools/ docs/
  provenance/ licenses/ THIRD_PARTY_NOTICES.md
```

One repo does not require one OS process. Browser captures and encoder workers may be isolated processes/containers built from that same repo and release. Do not add a second unrelated application server solely to call Archify.

## Authoring and ownership

A versioned project manifest references typed diagram JSON, editable story intent, native HTML compositions, presentation overrides, asset records and immutable committed revisions. One project does not require one huge JSON file. Generated SVG and HTML are rebuildable output, not independent semantic truth.

A semantic rename edits the diagram source and updates every managed appearance. A headline or node emphasis changes presentation. A layout gesture writes a validated layout hint/sidecar, not an untracked SVG transform. An agent uses the same commands as the UI. A removed edge creates an explicit orphan conflict for dependent animations. Native freeform HTML remains editable; a managed scene can become native only through an explicit detach operation with backup and warning.

## Fidelity requirements

Preserve authored IDs, direction, labels, branches, groups and supported evidence. Guided-view focus order is not graph connectivity. In the supplied deployment example, gateway -> api_a and gateway -> api_b must not become api_a -> api_b. Sequence message order/repeated endpoints, workflow lanes/branches, dataflow boundaries and lifecycle transitions retain type-specific models. A structural diff does not prove deployment changes, runtime causality, speed, safety or security.

## Time and production

Compile managed scenes into the existing composition contract with paused, seekable motion. HyperFrames runtime controls video time; standalone viewer timers are not imported into video scenes. Use integer story frames and rational frame-rate representation, with conversion at the emitter. Pin source/build/asset hashes before rendering and block unresolved assets. Capture is independent of timestamp visit order. Byte-identical encoded output across arbitrary machines is not promised.

## Local-first and explicit optional scope

Required local release: authoring, validated diagram generation, preview, native media editing, local narration/caption import, project management and real rendering work with preinstalled prerequisites and approved local assets, without mandatory upstream service login. Network is allowed for initial installation when explicitly approved; offline runtime is a separate acceptance test.

Retain/configure inherited optional voice, transcription, model, catalog, capture, Figma, publishing and cloud adapter interfaces. Do not count a mocked response as live service evidence. Live integration verification requires configured user-owned credentials and authorization; absence must be accurately reported without disabling the baseline local app. Full local-product completion does not imply all paid hosted services, multi-user SaaS, billing, tenant isolation, realtime collaboration or a new foundation model. Those are not silently added requirements.

## Release definition

Final delivery includes complete source, one lockfile, migrations, tests, docs, notices, provenance, reviewed assets/asset instructions, examples, build/run scripts and verifiable release artifacts. It builds without raw sibling folders, global upstream CLIs or submodules. The final gate verifies all required local capability evidence and clearly reports conditional external modes. No remote GitHub action or publication is implied until explicitly authorized and actually performed.
