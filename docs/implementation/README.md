# ArchFrame Studio — unified implementation ticket package

Version **2.0.0**, dated **September 10, 2026**. Working product name, not a trademark/name-availability determination.

**134 implementation tickets across 15 epics, including six milestone gates. All application tickets are PLANNED / NOT IMPLEMENTED.** This package is the execution specification requested for combining two raw source folders into one fully custom repo. It contains planning documents and usable planning-validation tools; it does **not** contain a merged application or a GitHub fork.

Start with [START_HERE.md](START_HERE.md), then [the kickoff prompt](prompts/IMPLEMENTATION_KICKOFF.md). The implementing agent receives `archify-main/`, `hyperframes-main/` and this package, and creates `archframe-studio/` as a sibling output. Input sources are read-only.

## Main entry points

- [Full consolidated ticket book](ALL_IMPLEMENTATION_TICKETS.md), [ticket index](backlog/INDEX.md), and [machine-readable backlog](backlog/tickets.json).
- [Product scope](docs/PRODUCT_SPEC.md), [shared contracts](docs/CONTRACTS.md), [definition of done](docs/DEFINITION_OF_DONE.md), and [execution/parallelism rules](docs/EXECUTION_RULES.md).
- [Dependency order](backlog/EXECUTION_ORDER.md), [milestone gates](docs/MILESTONES.md), and [capability coverage](docs/CAPABILITY_MATRIX.md).
- [Verified source map](provenance/SOURCE_MAP.md), [complete source inventory](provenance/SOURCE_INVENTORY.json), [snapshot hashes](provenance/SOURCE_SNAPSHOTS.json), and [import dispositions](provenance/IMPORT_DISPOSITIONS.md).
- [Planning-tool commands](tools/README.md), [prior-backlog crosswalk](backlog/SUPERSESSION.md), and [package validation result](planning-validation.json).

The complete backlog replaces the earlier **AF-001–AF-024** outline. It preserves the agreed end state: one repository, workspace, project, Studio, command/history boundary and video-production path. There is still an internal diagram-to-scene compiler; there is not a separate bridge product or a second required app.

Local editing and rendering with approved local assets must work without upstream service accounts. Optional hosted/model/media integrations remain explicit and separately verified; this pack does not assert they become free or automatically work after forking.
