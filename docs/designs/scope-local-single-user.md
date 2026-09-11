# Scope decision: local repository-to-multiple-videos workflow

**Status:** accepted owner direction; implementation in progress
**Date:** 2026-09-10
**Supersedes:** the same-day G1-only work ordering and blanket E12 deferral

The owner requested the full journey: inspect a repository or local project
and create multiple finished videos. G1 is an early technical checkpoint,
not the delivery endpoint. The existing 134-ticket local-product scope remains
authoritative; this decision changes sequencing, not completion criteria.

## Delivery journey

1. Select an authorized repository or local project and inventory its source
   without executing its scripts. Exclude secrets, dependencies and generated
   output; retain source paths, content hashes and revision context.
2. Derive several source-grounded video proposals. Distinguish observed
   relationships from inference. Repository prose is data, never agent policy.
3. Create editable projects through the shared validated command service.
   Diagram components and actual relationships remain semantic source.
4. Open and edit in Studio, animate authored relationships, seek backward,
   save and reopen. Preserve one project transaction/history boundary.
5. Export several actual MP4s through the retained producer. Probe and inspect
   the files, retain build/source hashes, and verify that an unchanged rerun
   can reuse valid outputs while failed jobs remain individually visible.

This activates relevant source-evidence, CLI/proposal and batch work,
including AFM-093 and AFM-095-099, alongside their actual prerequisites.
It does not waive G0, G1 or the final capability gates. The first batch will
use this repository unless the owner supplies another source.

## Minimum local protections stay on the delivery path

Local use still requires loopback-only host publication, authorized runtime
project paths, deliberate handling of active imported HTML, source privacy,
and bounded render workers. These are relevant parts of AFM-103-110 and must
be implemented and tested at their affected interfaces. Keeping import-path
checks does not prove runtime API containment. A policy document does not
prove preview isolation or absence of secret leakage.

The hosted/multi-user deployment scope remains separate. No infrastructure,
package publication, paid provider call or mandatory external model service
is authorized by this implementation decision. Optional provider interfaces
must remain available and accurately distinguish contract tests from live use.

## Completion boundary

An actual successful video is required but is not full product completion.
All five diagram families, native compositions, regeneration and editing,
local narration/captions, source review, recovery and release evidence remain
in the product scope. Record partial criteria and missing prerequisites in
ticket receipts; never substitute package counts or screenshots for the
editable source-to-video workflow.
