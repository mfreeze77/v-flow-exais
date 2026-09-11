# Capability-preservation and completion matrix

70 explicitly mapped capability groups. All application statuses are pending; the JSON retains separate source/baseline/Studio/render/release fields. A discovered capability not listed here must receive an owner and explicit retention/replacement decision; no silent dropping is permitted.

| ID | Required capability / boundary | Implementation tickets |
|---|---|---|
| CAP-001 | Single owned workspace / no sibling runtime | AFM-001, AFM-002, AFM-003, AFM-009, AFM-010, AFM-011, AFM-016, AFM-129 |
| CAP-002 | Safe source import, hashes and upstream divergence | AFM-001, AFM-002, AFM-006, AFM-007, AFM-125 |
| CAP-003 | Licenses, notices, asset rights and new identity | AFM-004, AFM-111, AFM-121 |
| CAP-004 | No inherited publishing / executable hook surprises | AFM-005, AFM-015, AFM-097 |
| CAP-005 | Full source/test/capability retention | AFM-008, AFM-013, AFM-014, AFM-119 |
| CAP-006 | Versioned typed project and native HTML ownership | AFM-017, AFM-022, AFM-085 |
| CAP-007 | Stable nodes, edges, messages and scene appearances | AFM-018, AFM-040, AFM-046 |
| CAP-008 | One revision-aware command path | AFM-019, AFM-051, AFM-057, AFM-095, AFM-096 |
| CAP-009 | Atomic saves, undo and crash recovery | AFM-020, AFM-021, AFM-072, AFM-076, AFM-078 |
| CAP-010 | Asset identity, measured timing and immutable builds | AFM-023, AFM-026, AFM-049, AFM-079 |
| CAP-011 | Evidence, diagnostics and public redaction | AFM-024, AFM-037, AFM-066, AFM-107 |
| CAP-012 | Story / frame timing / scene overrides | AFM-025, AFM-044, AFM-046, AFM-073 |
| CAP-013 | Callable engine without CLI/global side effects | AFM-027, AFM-028, AFM-038 |
| CAP-014 | Architecture render, semantic editing and scene motion | AFM-029, AFM-062, AFM-064, AFM-065, AFM-068, AFM-130 |
| CAP-015 | Workflow render/migration, lanes and branches | AFM-030, AFM-087, AFM-094 |
| CAP-016 | Sequence render and ordered repeated messages | AFM-031, AFM-088, AFM-094 |
| CAP-017 | Dataflow render, flows and boundary semantics | AFM-032, AFM-089, AFM-094 |
| CAP-018 | Lifecycle render, loops and transitions | AFM-033, AFM-090, AFM-094 |
| CAP-019 | Diagram themes, presets, locales and brand lookup | AFM-034, AFM-084, AFM-091 |
| CAP-020 | Interactive HTML viewer, details and search | AFM-035, AFM-060, AFM-091 |
| CAP-021 | Guided views, chapters and scene drafting | AFM-035, AFM-045, AFM-063, AFM-066, AFM-091 |
| CAP-022 | Authored route/reach inspection and semantic links | AFM-036, AFM-043, AFM-066, AFM-091 |
| CAP-023 | Pinned source evidence and exact architecture diff | AFM-037, AFM-092, AFM-093 |
| CAP-024 | Schema, artifact, geometry and visual checks | AFM-028, AFM-038, AFM-114, AFM-115 |
| CAP-025 | Native managed diagram composition | AFM-039, AFM-047, AFM-054 |
| CAP-026 | Collision-free SVG/CSS across scene instances | AFM-040, AFM-047, AFM-115 |
| CAP-027 | Readable camera framing and output safe areas | AFM-041, AFM-068, AFM-084 |
| CAP-028 | Seekable motion under a single runtime clock | AFM-042, AFM-044, AFM-050, AFM-115 |
| CAP-029 | No fabricated flow from focus order | AFM-043, AFM-045, AFM-098, AFM-114 |
| CAP-030 | Editable semantic tracks and animation controls | AFM-046, AFM-067, AFM-068 |
| CAP-031 | Regeneration without override loss | AFM-048, AFM-073, AFM-074, AFM-078 |
| CAP-032 | Asset/font readiness before frame zero | AFM-049, AFM-079, AFM-103 |
| CAP-033 | One API and consistent error contracts | AFM-051, AFM-052, AFM-058 |
| CAP-034 | External edit detection and conflict reconciliation | AFM-053, AFM-070, AFM-075 |
| CAP-035 | Real immutable video jobs, cancel/retry/recovery | AFM-054, AFM-055, AFM-110 |
| CAP-036 | Revision-correct previews and thumbnails | AFM-056, AFM-077, AFM-115 |
| CAP-037 | Managed mutation enforcement / explicit detach | AFM-057, AFM-069, AFM-072 |
| CAP-038 | Unified project launch and import UX | AFM-059, AFM-060, AFM-063 |
| CAP-039 | Shared selection / inspector / timeline context | AFM-061, AFM-062, AFM-067 |
| CAP-040 | Schema-valid object CRUD and persistent layout | AFM-064, AFM-065, AFM-074 |
| CAP-041 | Visible save/build/conflict/render status | AFM-070, AFM-076 |
| CAP-042 | Accessible keyboard and locale-aware UI | AFM-071, AFM-091 |
| CAP-043 | Shared asset browser and media ingestion | AFM-079, AFM-083 |
| CAP-044 | Local narration and opt-in synthesis adapters | AFM-080, AFM-100 |
| CAP-045 | Caption import/edit/sync/sidecar export | AFM-081, AFM-086 |
| CAP-046 | Native media transforms, effects, variables and color | AFM-082, AFM-085 |
| CAP-047 | Local templates and opt-in catalog | AFM-083, AFM-103 |
| CAP-048 | Widescreen, square and portrait output | AFM-084, AFM-115 |
| CAP-049 | Native-only / nested composition / player / slideshow | AFM-085, AFM-094 |
| CAP-050 | Project, diagram, still, MP4 and WebM export | AFM-086, AFM-126 |
| CAP-051 | All-family mixed product, not architecture-only | AFM-094, AFM-132 |
| CAP-052 | One custom CLI and compatibility commands | AFM-095, AFM-101 |
| CAP-053 | Semantic agent tools and combined skill | AFM-096, AFM-097, AFM-102 |
| CAP-054 | AI proposals with source review and validation | AFM-098, AFM-102 |
| CAP-055 | Headless batch output and resumable jobs | AFM-099, AFM-055 |
| CAP-056 | Optional capture, Figma, publishing and cloud interfaces | AFM-100, AFM-103 |
| CAP-057 | Doctor / setup / redacted diagnostics | AFM-101, AFM-123 |
| CAP-058 | Offline runtime and outbound-network policy | AFM-103, AFM-106, AFM-112 |
| CAP-059 | Path / archive / symlink / local filesystem safety | AFM-104, AFM-112 |
| CAP-060 | Untrusted composition isolation and message validation | AFM-105, AFM-108, AFM-112 |
| CAP-061 | No SSRF / secret leakage / API bypass | AFM-106, AFM-107, AFM-109, AFM-112 |
| CAP-062 | Worker quotas / cancellation / disk resilience | AFM-108, AFM-110, AFM-118 |
| CAP-063 | Local and protected single-user deployment | AFM-109, AFM-117, AFM-122 |
| CAP-064 | SBOM, dependency and distribution provenance | AFM-111, AFM-126 |
| CAP-065 | Seeded semantic, actual visual and parity regressions | AFM-113, AFM-114, AFM-115 |
| CAP-066 | Measured performance and long-session durability | AFM-116, AFM-118 |
| CAP-067 | Windows / macOS / Linux support declarations | AFM-117, AFM-122 |
| CAP-068 | No-drift evidence and all-capability release gate | AFM-119, AFM-120, AFM-127, AFM-134 |
| CAP-069 | Custom docs, demo source and complete repo packaging | AFM-121, AFM-123, AFM-124, AFM-126, AFM-128 |
| CAP-070 | Selective upstream update tooling | AFM-125 |

Conditional network/provider interfaces retain their code and local contract tests. Real hosted or model evidence is separate and must not be inferred from mock results. The full local workflow stays release-required.
