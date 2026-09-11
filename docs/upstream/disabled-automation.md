# Inherited automation: what was disabled and why

AFM-005. Audited by `bun run audit:automation`, which writes
`provenance/automation-audit.json`. Current state: **0 blocked, 13 review**.

The rule this enforces: a raw source import must never execute or publish under
upstream identities. No token, service account, registry or bucket from either
upstream configuration is assumed available or reused.

## Disabled

### Upstream CI workflows — 18 files, quarantined at import

All 18 workflow files from both repositories (`ci.yml`, `publish.yml`,
`release.yml`, `codeql.yml`, `canary-sunset.yml`, `catalog-previews.yml`,
`windows-render.yml`, `star-history.yml`, `dsh.yml` and the rest) carry the
`quarantine-automation` disposition in the import ledger and were routed to
`docs/upstream/<repo>/automation/` and `docs/upstream/hyperframes/workflows/`.

`.github/workflows/` does not exist in this repository. Nothing runs on push or
tag. The original text is retained for reference, and
`tests/acceptance/AFM-003.test.ts` asserts no workflow file is ever tracked.

### Root `prepare` lifecycle hook — removed

Upstream's root manifest carried:

```json
"prepare": "test -d .git && lefthook install || true"
```

Removed during AFM-003's manifest reconciliation, so `bun install` does not
install git hooks.

### Dependency-installed git hooks — neutralised via `core.hooksPath`

**Removing the `prepare` script was not sufficient.** The `lefthook` package
installs `pre-commit` and `commit-msg` into `.git/hooks/` from its *own*
postinstall during `bun install`. They appeared anyway and fired on the next
commit (`Can't find lefthook in PATH`). The generated hooks hardcode
`/workspace/node_modules/...`, so they fail on the host and would run an
unreviewed toolchain inside the container.

`core.hooksPath` is redirected to a repository-owned `.githooks/`, which makes
anything written into `.git/hooks` inert without deleting upstream's
configuration. This is the finding that justifies auditing the filesystem rather
than only reading manifests.

## Retained for review, currently inert

### `publishConfig.access: public` — 11 packages

Every inherited `@hyperframes/*` package still declares public publish access.
These are **not** modified, because rewriting 11 manifests risks upstream's own
packed-manifest checks, and contract C11 keeps the scope rename as its own
tested ticket.

They are inert here: there is no remote, no workflow, and no `.npmrc`, so no
credential exists for the `@hyperframes` scope. Publication would require
someone to deliberately authenticate and run a publish command.

**Publishing `@hyperframes/*` from this repository is prohibited.** These are
someone else's package names.

### `lefthook.yml`

Retained unmodified. Inert while `core.hooksPath` points at `.githooks/`.

### `.github/renovate.json`

Dependency auto-update configuration. Inert without the Renovate app installed
against a remote, and this repository has no remote.

## Before any future release

Deferred to an approved release configuration, not inherited:

1. Decide the package scope and whether anything is published at all.
2. Create destination-owned CI; do not restore upstream workflows wholesale.
3. Provision credentials under the owner's own accounts.
4. Re-run `bun run audit:automation` and require `blocked: 0` with every
   `review` item explicitly accepted.

See also `docs/designs/scope-local-single-user.md` — this build is local and
single-user, so no deployment path is configured at all.
