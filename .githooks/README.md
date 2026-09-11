# Repository-owned git hooks

`core.hooksPath` points here, not at `.git/hooks`.

Upstream ships `lefthook.yml`, and the `lefthook` dependency installs
`pre-commit` and `commit-msg` into `.git/hooks/` from its own postinstall —
independently of the root `prepare` script, which this repo already removed.
Those hooks were unreviewed inherited automation, and the generated scripts even
hardcode a container path (`/workspace/node_modules/...`), so they fail on the
host and silently run a different toolchain inside the container.

Redirecting `core.hooksPath` makes anything written into `.git/hooks` inert
without deleting upstream's configuration, which is retained for review.

Add a hook here only after reviewing what it runs. See
`docs/upstream/disabled-automation.md` (AFM-005).
