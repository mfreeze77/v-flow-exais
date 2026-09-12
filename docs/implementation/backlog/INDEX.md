# Implementation ticket index

**134 tickets, all PLANNED.** This is the implementation backlog, not a merged application. See [START HERE](../START_HERE.md).

## E01 — Raw-source intake, ownership and import

| Ticket                           | Implementation outcome                                              | Dependencies     |
| -------------------------------- | ------------------------------------------------------------------- | ---------------- |
| [AFM-001](../tickets/AFM-001.md) | Preflight the two raw source folders                                | None             |
| [AFM-002](../tickets/AFM-002.md) | Create a complete source disposition and import ledger              | AFM-001          |
| [AFM-003](../tickets/AFM-003.md) | Initialize and populate the new owned monorepo                      | AFM-002          |
| [AFM-004](../tickets/AFM-004.md) | Retain licenses, notices and asset-rights provenance                | AFM-002          |
| [AFM-005](../tickets/AFM-005.md) | Quarantine inherited publication, hooks and deployment              | AFM-002          |
| [AFM-006](../tickets/AFM-006.md) | Preserve source paths, modes and cross-platform filesystem behavior | AFM-003          |
| [AFM-007](../tickets/AFM-007.md) | Record upstream baselines and selective-update procedure            | AFM-001, AFM-002 |
| [AFM-008](../tickets/AFM-008.md) | Create feature-preservation and baseline-failure registers          | AFM-002          |

## E02 — Unified workspace and verified baselines

| Ticket                           | Implementation outcome                                     | Dependencies              |
| -------------------------------- | ---------------------------------------------------------- | ------------------------- |
| [AFM-009](../tickets/AFM-009.md) | Reconcile workspace manifests and package ownership        | AFM-003, AFM-005          |
| [AFM-010](../tickets/AFM-010.md) | Pin runtime, lockfile and installation prerequisites       | AFM-009                   |
| [AFM-011](../tickets/AFM-011.md) | Repair build order, exports and asset relocation           | AFM-009, AFM-010          |
| [AFM-012](../tickets/AFM-012.md) | Reconcile lint, types, tests and package boundaries        | AFM-009, AFM-011          |
| [AFM-013](../tickets/AFM-013.md) | Re-run and preserve the Archify source baseline            | AFM-010, AFM-011, AFM-012 |
| [AFM-014](../tickets/AFM-014.md) | Re-run the HyperFrames source baseline                     | AFM-010, AFM-011, AFM-012 |
| [AFM-015](../tickets/AFM-015.md) | Install destination-owned CI and evidence collection       | AFM-005, AFM-012          |
| [AFM-016](../tickets/AFM-016.md) | Remove transitional wrappers and certify one-repo baseline | AFM-013, AFM-014, AFM-015 |

## E03 — Shared project model and atomic authoring

| Ticket                           | Implementation outcome                                                 | Dependencies              |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------- |
| [AFM-017](../tickets/AFM-017.md) | Define the versioned unified project document                          | AFM-009                   |
| [AFM-018](../tickets/AFM-018.md) | Implement durable document, object and scene-instance identities       | AFM-017                   |
| [AFM-019](../tickets/AFM-019.md) | Specify shared commands, revision checks and idempotency               | AFM-017, AFM-018          |
| [AFM-020](../tickets/AFM-020.md) | Build atomic filesystem revisions and recovery                         | AFM-019                   |
| [AFM-021](../tickets/AFM-021.md) | Implement one project undo/redo command journal                        | AFM-019, AFM-020          |
| [AFM-022](../tickets/AFM-022.md) | Implement backup-first import and project migrations                   | AFM-017, AFM-018, AFM-020 |
| [AFM-023](../tickets/AFM-023.md) | Create a shared asset registry and reference contract                  | AFM-017, AFM-020          |
| [AFM-024](../tickets/AFM-024.md) | Define diagnostics, evidence and redaction contracts                   | AFM-017, AFM-019          |
| [AFM-025](../tickets/AFM-025.md) | Version story timing, animation intents and presentation overrides     | AFM-017, AFM-018, AFM-023 |
| [AFM-026](../tickets/AFM-026.md) | Implement build hashes, dependency graph and garbage collection policy | AFM-020, AFM-023, AFM-025 |

## E04 — Callable diagram engine and preserved viewer

| Ticket                           | Implementation outcome                                        | Dependencies                                                  |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| [AFM-027](../tickets/AFM-027.md) | Extract a side-effect-free diagram compilation API            | AFM-011, AFM-017, AFM-024                                     |
| [AFM-028](../tickets/AFM-028.md) | Preserve schemas, generated validators and compatibility      | AFM-013, AFM-027                                              |
| [AFM-029](../tickets/AFM-029.md) | Refactor architecture layout and emit native geometry         | AFM-027, AFM-028, AFM-018                                     |
| [AFM-030](../tickets/AFM-030.md) | Refactor workflow layout and migration into the engine        | AFM-027, AFM-028, AFM-018                                     |
| [AFM-031](../tickets/AFM-031.md) | Refactor sequence compilation with ordered message identity   | AFM-027, AFM-028, AFM-018                                     |
| [AFM-032](../tickets/AFM-032.md) | Refactor dataflow compilation and boundary semantics          | AFM-027, AFM-028, AFM-018                                     |
| [AFM-033](../tickets/AFM-033.md) | Refactor lifecycle compilation and transition semantics       | AFM-027, AFM-028, AFM-018                                     |
| [AFM-034](../tickets/AFM-034.md) | Extract reusable themes, presets, locale and brand resolution | AFM-027, AFM-028, AFM-004                                     |
| [AFM-035](../tickets/AFM-035.md) | Extract the standalone diagram viewer as a product module     | AFM-027, AFM-029, AFM-030, AFM-031, AFM-032, AFM-033, AFM-034 |
| [AFM-036](../tickets/AFM-036.md) | Retain authored reachability, route inspection and deep links | AFM-029, AFM-035, AFM-024                                     |
| [AFM-037](../tickets/AFM-037.md) | Integrate source evidence and exact architecture deltas       | AFM-029, AFM-024, AFM-018                                     |
| [AFM-038](../tickets/AFM-038.md) | Expose artifact checks and thin compatibility commands        | AFM-029, AFM-030, AFM-031, AFM-032, AFM-033, AFM-035, AFM-037 |

## E05 — Native diagram scenes and deterministic motion

| Ticket                           | Implementation outcome                                       | Dependencies                                |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| [AFM-039](../tickets/AFM-039.md) | Implement the native managed diagram-scene contract          | AFM-025, AFM-029, AFM-026                   |
| [AFM-040](../tickets/AFM-040.md) | Namespace SVG, CSS and composition-instance identities       | AFM-039, AFM-018                            |
| [AFM-041](../tickets/AFM-041.md) | Build scene framing and camera geometry                      | AFM-039, AFM-025                            |
| [AFM-042](../tickets/AFM-042.md) | Compile paused seekable focus and reveal animations          | AFM-039, AFM-040, AFM-041                   |
| [AFM-043](../tickets/AFM-043.md) | Animate only authored relationships and valid routes         | AFM-039, AFM-042, AFM-036                   |
| [AFM-044](../tickets/AFM-044.md) | Map nested-scene time and overlapping composition windows    | AFM-042, AFM-025                            |
| [AFM-045](../tickets/AFM-045.md) | Generate editable story drafts from guided views             | AFM-025, AFM-039, AFM-043                   |
| [AFM-046](../tickets/AFM-046.md) | Bind semantic animation intents to editable timeline tracks  | AFM-039, AFM-042, AFM-025                   |
| [AFM-047](../tickets/AFM-047.md) | Validate multi-instance scenes and mixed native compositions | AFM-040, AFM-044, AFM-046                   |
| [AFM-048](../tickets/AFM-048.md) | Implement managed regeneration and binding conflict reports  | AFM-026, AFM-039, AFM-046                   |
| [AFM-049](../tickets/AFM-049.md) | Enforce asset readiness and offline frame capture            | AFM-039, AFM-023, AFM-042                   |
| [AFM-050](../tickets/AFM-050.md) | Create an arbitrary-seek conformance harness                 | AFM-042, AFM-043, AFM-044, AFM-047, AFM-049 |

## E06 — One API, preview and production job system

| Ticket                           | Implementation outcome                                        | Dependencies                                                  |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| [AFM-051](../tickets/AFM-051.md) | Extend the existing Studio API with project commands          | AFM-019, AFM-020, AFM-024, AFM-027                            |
| [AFM-052](../tickets/AFM-052.md) | Add diagram import, compile, inspect and compare endpoints    | AFM-051, AFM-029, AFM-037, AFM-038, AFM-022                   |
| [AFM-053](../tickets/AFM-053.md) | Integrate file watchers, external edits and revision events   | AFM-020, AFM-026, AFM-051                                     |
| [AFM-054](../tickets/AFM-054.md) | Run immutable mixed-project renders through the producer      | AFM-026, AFM-047, AFM-049, AFM-051                            |
| [AFM-055](../tickets/AFM-055.md) | Implement render cancellation, retries and artifact lifecycle | AFM-054                                                       |
| [AFM-056](../tickets/AFM-056.md) | Serve revision-correct previews and thumbnails                | AFM-026, AFM-049, AFM-051                                     |
| [AFM-057](../tickets/AFM-057.md) | Enforce managed ownership on every mutation ingress           | AFM-019, AFM-051, AFM-053, AFM-039                            |
| [AFM-058](../tickets/AFM-058.md) | Verify API consistency, errors and recovery contracts         | AFM-051, AFM-052, AFM-053, AFM-054, AFM-055, AFM-056, AFM-057 |

## E07 — Fully integrated Studio editing experience

| Ticket                           | Implementation outcome                                          | Dependencies                                |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| [AFM-059](../tickets/AFM-059.md) | Add unified project onboarding and open/import flows            | AFM-022, AFM-051, AFM-056                   |
| [AFM-060](../tickets/AFM-060.md) | Implement document outline and diagram-aware scene browser      | AFM-059, AFM-018, AFM-056                   |
| [AFM-061](../tickets/AFM-061.md) | Unify selection between canvas, inspector and timeline          | AFM-060, AFM-046, AFM-056                   |
| [AFM-062](../tickets/AFM-062.md) | Add schema-aware semantic property editing                      | AFM-061, AFM-051, AFM-057, AFM-029          |
| [AFM-063](../tickets/AFM-063.md) | Create guided-view scenes and render the first vertical slice   | AFM-059, AFM-062, AFM-045, AFM-054, AFM-042 |
| [AFM-064](../tickets/AFM-064.md) | Implement schema-valid node and relationship creation/deletion  | AFM-062, AFM-018, AFM-019, AFM-057          |
| [AFM-065](../tickets/AFM-065.md) | Implement editable layout, grouping and drag gestures           | AFM-062, AFM-064, AFM-029, AFM-030          |
| [AFM-066](../tickets/AFM-066.md) | Add guided-view, route and evidence authoring panels            | AFM-062, AFM-036, AFM-037, AFM-045          |
| [AFM-067](../tickets/AFM-067.md) | Add diagram-aware timeline lanes and trim/reorder controls      | AFM-061, AFM-046, AFM-025, AFM-051          |
| [AFM-068](../tickets/AFM-068.md) | Expose camera, emphasis, edge and callout animation controls    | AFM-067, AFM-042, AFM-043, AFM-046, AFM-057 |
| [AFM-069](../tickets/AFM-069.md) | Integrate source editing, diagnostics and safe scene detachment | AFM-057, AFM-053, AFM-062                   |
| [AFM-070](../tickets/AFM-070.md) | Add truthful save, regeneration, conflict and job UX            | AFM-059, AFM-053, AFM-055, AFM-048          |
| [AFM-071](../tickets/AFM-071.md) | Complete Studio accessibility and keyboard interaction          | AFM-060, AFM-061, AFM-062, AFM-067, AFM-070 |

## E08 — Shared history, regeneration and recovery

| Ticket                           | Implementation outcome                                      | Dependencies                                                  |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| [AFM-072](../tickets/AFM-072.md) | Connect the SDK to project-owned history and persistence    | AFM-021, AFM-057, AFM-062, AFM-067                            |
| [AFM-073](../tickets/AFM-073.md) | Rebase presentation overrides by stable identity            | AFM-048, AFM-072, AFM-018                                     |
| [AFM-074](../tickets/AFM-074.md) | Handle source deletion, duplication and cross-scene impact  | AFM-064, AFM-073, AFM-021                                     |
| [AFM-075](../tickets/AFM-075.md) | Implement external-edit conflict reconciliation             | AFM-053, AFM-072, AFM-073                                     |
| [AFM-076](../tickets/AFM-076.md) | Add crash recovery, revision restore and retention controls | AFM-020, AFM-021, AFM-072, AFM-026                            |
| [AFM-077](../tickets/AFM-077.md) | Optimize incremental rebuild and stale result cancellation  | AFM-026, AFM-048, AFM-056, AFM-073                            |
| [AFM-078](../tickets/AFM-078.md) | Prove coherent undo, regeneration and reopen end to end     | AFM-072, AFM-073, AFM-074, AFM-075, AFM-076, AFM-077, AFM-070 |

## E09 — Assets, narration, captions and native video parity

| Ticket                           | Implementation outcome                                               | Dependencies                                |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| [AFM-079](../tickets/AFM-079.md) | Implement shared media ingestion, deduplication and probing          | AFM-023, AFM-051, AFM-049                   |
| [AFM-080](../tickets/AFM-080.md) | Integrate narration clips and optional synthesis providers           | AFM-079, AFM-025, AFM-072                   |
| [AFM-081](../tickets/AFM-081.md) | Unify caption import, editing and frame-accurate export              | AFM-079, AFM-080, AFM-025                   |
| [AFM-082](../tickets/AFM-082.md) | Preserve native media transforms, audio effects and color controls   | AFM-079, AFM-072, AFM-047                   |
| [AFM-083](../tickets/AFM-083.md) | Unify templates, local catalog and asset provenance                  | AFM-079, AFM-034, AFM-045, AFM-005          |
| [AFM-084](../tickets/AFM-084.md) | Support readable output presets and theme customization              | AFM-041, AFM-034, AFM-079, AFM-081          |
| [AFM-085](../tickets/AFM-085.md) | Preserve player, slideshow and external native-project compatibility | AFM-022, AFM-047, AFM-072, AFM-082          |
| [AFM-086](../tickets/AFM-086.md) | Provide one export surface for project, diagram, still and video     | AFM-038, AFM-054, AFM-081, AFM-084, AFM-085 |

## E10 — All diagram families and architecture-change reviews

| Ticket                           | Implementation outcome                                         | Dependencies                                                           |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [AFM-087](../tickets/AFM-087.md) | Complete workflow authoring and video scene integration        | AFM-030, AFM-064, AFM-065, AFM-068, AFM-073                            |
| [AFM-088](../tickets/AFM-088.md) | Complete sequence authoring and ordered message motion         | AFM-031, AFM-064, AFM-068, AFM-073                                     |
| [AFM-089](../tickets/AFM-089.md) | Complete dataflow authoring and flow-motion integration        | AFM-032, AFM-064, AFM-065, AFM-068, AFM-073                            |
| [AFM-090](../tickets/AFM-090.md) | Complete lifecycle authoring and transition-motion integration | AFM-033, AFM-064, AFM-068, AFM-073                                     |
| [AFM-091](../tickets/AFM-091.md) | Complete viewer features and deep-link continuity in Studio    | AFM-035, AFM-036, AFM-066, AFM-087, AFM-088, AFM-089, AFM-090          |
| [AFM-092](../tickets/AFM-092.md) | Build exact before/delta/after review scenes                   | AFM-037, AFM-073, AFM-045, AFM-068                                     |
| [AFM-093](../tickets/AFM-093.md) | Integrate repository/PR evidence into review workflows         | AFM-092, AFM-024, AFM-051                                              |
| [AFM-094](../tickets/AFM-094.md) | Certify all five diagram families and native scenes together   | AFM-087, AFM-088, AFM-089, AFM-090, AFM-091, AFM-092, AFM-086, AFM-078 |

## E11 — Unified CLI, skills and agent tools

| Ticket                           | Implementation outcome                                            | Dependencies                                         |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| [AFM-095](../tickets/AFM-095.md) | Expose one product CLI with native and diagram commands           | AFM-051, AFM-052, AFM-057, AFM-022, AFM-086          |
| [AFM-096](../tickets/AFM-096.md) | Expose revision-aware diagram and story agent tools               | AFM-051, AFM-057, AFM-061, AFM-095                   |
| [AFM-097](../tickets/AFM-097.md) | Create one combined skill and reconcile agent instructions        | AFM-095, AFM-096, AFM-005                            |
| [AFM-098](../tickets/AFM-098.md) | Implement source-grounded AI proposal review                      | AFM-096, AFM-024, AFM-037                            |
| [AFM-099](../tickets/AFM-099.md) | Support headless batch generation and resumable jobs              | AFM-095, AFM-026, AFM-055                            |
| [AFM-100](../tickets/AFM-100.md) | Preserve optional capture, Figma, cloud and publishing interfaces | AFM-005, AFM-095, AFM-079                            |
| [AFM-101](../tickets/AFM-101.md) | Add project, media and runtime diagnostics to doctor              | AFM-095, AFM-010, AFM-024, AFM-049                   |
| [AFM-102](../tickets/AFM-102.md) | Run real agent and CLI end-to-end acceptance                      | AFM-096, AFM-097, AFM-098, AFM-099, AFM-101, AFM-094 |

## E12 — Local-first security and resilient execution

| Ticket                           | Implementation outcome                                       | Dependencies                                                                    |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [AFM-103](../tickets/AFM-103.md) | Audit and gate all outbound network behavior                 | AFM-005, AFM-010, AFM-079, AFM-100                                              |
| [AFM-104](../tickets/AFM-104.md) | Harden project paths, archives and file operations           | AFM-006, AFM-020, AFM-051, AFM-079                                              |
| [AFM-105](../tickets/AFM-105.md) | Isolate imported HTML and preview messaging                  | AFM-057, AFM-056, AFM-104                                                       |
| [AFM-106](../tickets/AFM-106.md) | Constrain asset fetching and prevent internal-network access | AFM-103, AFM-104, AFM-049                                                       |
| [AFM-107](../tickets/AFM-107.md) | Protect secrets, source privacy and exported evidence        | AFM-024, AFM-004, AFM-080, AFM-098                                              |
| [AFM-108](../tickets/AFM-108.md) | Enforce render worker and process isolation                  | AFM-055, AFM-104, AFM-105, AFM-106                                              |
| [AFM-109](../tickets/AFM-109.md) | Secure the local API and deny accidental public hosting      | AFM-051, AFM-105, AFM-107                                                       |
| [AFM-110](../tickets/AFM-110.md) | Handle concurrency, quotas and filesystem exhaustion         | AFM-020, AFM-055, AFM-077, AFM-108                                              |
| [AFM-111](../tickets/AFM-111.md) | Produce software and asset provenance/security inventories   | AFM-004, AFM-009, AFM-103, AFM-107                                              |
| [AFM-112](../tickets/AFM-112.md) | Run adversarial and offline security acceptance              | AFM-103, AFM-104, AFM-105, AFM-106, AFM-107, AFM-108, AFM-109, AFM-110, AFM-111 |

## E13 — Regression, performance and platform certification

| Ticket                           | Implementation outcome                                 | Dependencies                                                           |
| -------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| [AFM-113](../tickets/AFM-113.md) | Build a traceable integration fixture corpus           | AFM-008, AFM-013, AFM-014, AFM-018                                     |
| [AFM-114](../tickets/AFM-114.md) | Add schema, identity and property-based semantic tests | AFM-028, AFM-018, AFM-025, AFM-043, AFM-113                            |
| [AFM-115](../tickets/AFM-115.md) | Gate visual correctness and preview/render parity      | AFM-050, AFM-084, AFM-094, AFM-113                                     |
| [AFM-116](../tickets/AFM-116.md) | Define and enforce realistic performance budgets       | AFM-077, AFM-110, AFM-113                                              |
| [AFM-117](../tickets/AFM-117.md) | Certify Windows, macOS and Linux developer workflows   | AFM-010, AFM-016, AFM-086, AFM-104, AFM-113                            |
| [AFM-118](../tickets/AFM-118.md) | Test long-session durability and resource cleanup      | AFM-076, AFM-077, AFM-110, AFM-117                                     |
| [AFM-119](../tickets/AFM-119.md) | Automate capability evidence and no-drift validation   | AFM-008, AFM-094, AFM-102, AFM-112, AFM-115, AFM-117, AFM-118          |
| [AFM-120](../tickets/AFM-120.md) | Run final end-to-end product acceptance scenarios      | AFM-078, AFM-094, AFM-102, AFM-112, AFM-115, AFM-116, AFM-117, AFM-119 |

## E14 — Custom-product release and complete repo handoff

| Ticket                           | Implementation outcome                                                   | Dependencies                                         |
| -------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| [AFM-121](../tickets/AFM-121.md) | Apply product branding, CLI identity and optional scope rename           | AFM-095, AFM-097, AFM-004, AFM-016                   |
| [AFM-122](../tickets/AFM-122.md) | Package local development and self-hosted single-user deployment         | AFM-117, AFM-108, AFM-109, AFM-121                   |
| [AFM-123](../tickets/AFM-123.md) | Write developer contracts and migration/runbook documentation            | AFM-027, AFM-051, AFM-072, AFM-095, AFM-122          |
| [AFM-124](../tickets/AFM-124.md) | Create demo projects and human-verifiable acceptance evidence            | AFM-086, AFM-094, AFM-120, AFM-123                   |
| [AFM-125](../tickets/AFM-125.md) | Finalize upstream update and patch maintenance tooling                   | AFM-007, AFM-011, AFM-111, AFM-123                   |
| [AFM-126](../tickets/AFM-126.md) | Prepare source and runnable release artifacts                            | AFM-111, AFM-120, AFM-121, AFM-122, AFM-123, AFM-124 |
| [AFM-127](../tickets/AFM-127.md) | Run an independent release-candidate review and defect closure           | AFM-126, AFM-119, AFM-112                            |
| [AFM-128](../tickets/AFM-128.md) | Finalize the new repository and handoff without unauthorized publication | AFM-127, AFM-126, AFM-125                            |

## E15 — Milestone acceptance gates

| Ticket                           | Implementation outcome                                      | Dependencies                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [AFM-129](../tickets/AFM-129.md) | G0: Accept the single-workspace source baseline             | AFM-001, AFM-002, AFM-003, AFM-004, AFM-005, AFM-006, AFM-007, AFM-008, AFM-009, AFM-010, AFM-011, AFM-012, AFM-013, AFM-014, AFM-015, AFM-016 |
| [AFM-130](../tickets/AFM-130.md) | G1: Accept the first native architecture vertical slice     | AFM-129, AFM-020, AFM-027, AFM-029, AFM-039, AFM-040, AFM-042, AFM-043, AFM-049, AFM-051, AFM-054, AFM-057, AFM-063                            |
| [AFM-131](../tickets/AFM-131.md) | G2: Accept regeneration-safe mixed-content editing          | AFM-130, AFM-072, AFM-073, AFM-074, AFM-075, AFM-076, AFM-078, AFM-079, AFM-080, AFM-081, AFM-082, AFM-085                                     |
| [AFM-132](../tickets/AFM-132.md) | G3: Accept all diagram families and exact change reviews    | AFM-131, AFM-087, AFM-088, AFM-089, AFM-090, AFM-091, AFM-092, AFM-093, AFM-094                                                                |
| [AFM-133](../tickets/AFM-133.md) | G4: Accept security, platform and release-candidate quality | AFM-132, AFM-102, AFM-112, AFM-115, AFM-116, AFM-117, AFM-118, AFM-119, AFM-120, AFM-122, AFM-123                                              |
| [AFM-134](../tickets/AFM-134.md) | G5: Accept and verify the complete new repository           | All preceding tickets                                                                                                                          |
