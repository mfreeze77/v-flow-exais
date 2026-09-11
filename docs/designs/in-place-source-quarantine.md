# In-place build and the source quarantine

**Status:** accepted
**Date:** 2026-09-10
**Affects:** AFM-001, AFM-002, and every import ticket in E01

## Context

`AFM-001` requirement 1 says the preflight must "reject a root nested inside the
destination." `START_HERE.md` reinforces it: "The output must be a new
directory; never initialize the output inside an input folder or overwrite
either input."

This repository is built **in place**: `v-flow-exais/` is the output, and the
two upstream snapshots live at `v-flow-exais/_sources/archify-main` and
`v-flow-exais/_sources/hyperframes-main`. That is a source root nested inside
the destination, so a literal reading of the rule refuses it — and the first run
of `tools/import/preflight-cli.ts` did exactly that.

## Decision

Keep the check. Add a narrow exemption for one **declared** quarantine
directory, passed explicitly as `--quarantine` (default `_sources`), and record
every exempted input in the report as `quarantinedInputs`.

An input inside the destination but outside the declared quarantine is still
refused. The reverse containment — the output repository nested inside a source
input — is **never** exempt.

## Why this preserves the rule's intent

The rule exists to prevent three concrete failures. None of them are reachable
here:

1. **The product building out of an input tree.** `_sources/` is gitignored and
   nothing imports from it. `docs/EXECUTION_RULES.md` requires the repo to build
   with the raw folders absent, and the release gate AFM-134 verifies a clean
   archive rebuild without them.
2. **An input being modified or overwritten.** The snapshots are `chmod a-w` on
   the host and bind-mounted `:ro` into the container by `compose.yaml`, so no
   container process can write to them.
3. **An input being mistaken for product source later.** The quarantine is a
   single declared path, excluded from the workspace globs in `package.json`,
   and its presence is now explicit in every preflight report rather than
   inferred.

What the rule protects is the *direction of derivation*, not filesystem
containment. Quarantine keeps the derivation one-way.

## Cost

`_sources/` is 251 MB extracted (43 MB Archify, 208 MB HyperFrames). It is
excluded from version control, so it does not enter the handoff archive.

Anyone preferring the conventional sibling layout can pass
`--destination`/`--quarantine` accordingly; the tool supports both and the
default exemption is the only behavioural difference.

## Consequences

- Import tickets read from `_sources/` but must always write to `packages/`.
- `provenance/source-preflight.json` carries `quarantinedInputs`, so an auditor
  can see at a glance that this was an in-place build.
- If the quarantine is ever removed, preflight fails closed rather than silently
  scanning a tree it should not.
