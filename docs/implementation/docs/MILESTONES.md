# Milestone gates

| Gate ticket | Checkpoint | Required evidence |
|---|---|---|
| AFM-129 / G0 | One-source workspace baseline | Safe import/provenance, one install/lockfile/build, both upstream local workflows, no runtime sibling source |
| AFM-130 / G1 | First native architecture slice | Studio import/edit/create scene/save/reopen/backward scrub; native title; actual MP4 and topology/probe/frame checks |
| AFM-131 / G2 | Shared authoring and mixed media | Coherent undo/autosave, regeneration-safe overrides, explicit orphan conflicts, local audio/captions, native-only compatibility |
| AFM-132 / G3 | All families and change review | All five typed diagram workflows plus standalone viewer and receipt-grounded before/delta/after render |
| AFM-133 / G4 | Release-candidate quality | Offline/security, platform, durability/performance, source privacy, agent/tool contracts and real end-to-end evidence |
| AFM-134 / G5 | Complete new repo handoff | All prior tickets, clean archive rebuild, actual outputs, manifests/checksums/notices/docs/provenance and reviewed support limitations |

Gates do not replace implementation tickets. G1 is an intentionally early actual-render checkpoint; it is not a release or full-parity declaration. Gate receipts must identify actual commands and artifacts. Interface/live external-service status remains separate so a local product is not misrepresented as fully certified hosted SaaS.
