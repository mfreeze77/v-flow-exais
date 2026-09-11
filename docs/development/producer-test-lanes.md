# Focused producer test lanes

This is a bounded AFM-012 change to the inherited producer runner. It does not
close AFM-012, the clean-workspace baseline tickets, or a product gate. The
existing test classification remains authoritative and is not weakened.

## Run in the project's Docker environment

From the repository root:

```sh
# Inspect the plan without starting Bun/Vitest or loading test bodies.
docker compose run --rm workspace bun run --cwd packages/producer \
  test:unit:vitest --list src/services/renderOrchestrator.test.ts

# Run the single file which the old runner silently ignored as an argument.
docker compose run --rm workspace bun run --cwd packages/producer \
  test:unit:vitest src/services/renderOrchestrator.test.ts

# Let classification choose the runner for each file in a directory.
docker compose run --rm workspace bun run --cwd packages/producer \
  test:unit src/services

# Keep real host-capability tests in their integration lane.
docker compose run --rm workspace bun run --cwd packages/producer \
  test:integration:vitest src/services/fileServer.test.ts

# Classification and the runner's own dependency-free regression checks.
docker compose run --rm workspace bun run --cwd packages/producer test:classification
```

Use `docker-compose` instead of `docker compose` where that is the installed
entry point. These are validation instructions, not a claim they were executed
in the pinned development image for this PR; see its evidence receipt.

## Selection contract

The direct Node entry accepts:

```text
node scripts/run-test-lane.mjs <unit|integration> [bun|vitest] [--list] [--] [test-file-or-directory ...]
```

Without selectors it retains full-lane behavior. With selectors, every selector
must resolve to an exact classified file or directory and contribute at least
one file in the requested lane/runner. Directories are intersected with that
lane/runner; they do not promote integration tests into the unit lane.

Producer-relative `src/...`, `./src/...`, repository-relative
`packages/producer/src/...`, and same-platform absolute paths inside the
producer root are supported. Backslashes in relative paths are normalized.
Selectors are relative to the producer package, not the caller's current
directory. Quote paths containing spaces.

Overlapping paths are deduplicated in discovery order. A missing path, wrong
lane/runner, empty lane, unsupported option, or dangling `--` exits nonzero
before any runner launches. No typo can silently fall back to the full lane.
Globs, partial filename matches, and arbitrary downstream runner flags are not
part of this interface. A literal existing filename containing punctuation is
still matched by identity, not interpreted as a pattern.

`--list` reports selected files only; it does not execute their bodies and must
not be described as a passing producer suite. Normal execution logs the planned
files and reports selected-but-unlaunched files when a child fails. It preserves
the child exit code, maps signal termination to failure, and never starts later
commands after a failed invocation. It does not infer individual assertion
results from a process exit code.

## Runner boundaries

Vitest receives absolute filename filters. Because its CLI treats positional
paths as substring filters, the planner refuses a collision with any unselected
classified file rather than broadening the run. Bun receives explicit `./` file
paths and retains one new process per test file to isolate `mock.module` state.
Vitest is launched with `bun x --no-install`; missing dependencies must be
installed through the workspace's pinned installation process, not fetched
silently by a test command. No dependency or lockfile changes are introduced.

The runner's regression tests use a synthetic classified inventory and recorded
child runners. Separate Node CLI processes exercise argument and exit-code
wiring, including a symlinked entry. These are dispatch-contract tests, **not**
Bun/Vitest application passes, browser evidence, or render evidence. Existing
classification tests and actual product suites are still required.

## Remaining baseline work

This change does not resolve package entry/build-order failures, the recorded
ffprobe argument-contract failure, the broader quality audit, or clean-checkout
installation/build acceptance. Re-run the focused producer test and the full
classified lanes in the pinned image after their prerequisites are repaired.
Do not mark previously failed or unexecuted tests as passed merely because the
selection bug is fixed.

Inherited files modified here: `packages/producer/scripts/run-test-lane.mjs`
and the `test:classification` command in `packages/producer/package.json`.
Classification logic and lane assignments remain unchanged.

## Documentation references

- Vitest filename filtering: https://vitest.dev/guide/filtering.html
- Bun explicit-file test execution: https://bun.sh/docs/test

The patch relies on the existing workspace versions; it does not upgrade to
versions shown by these documentation sites.
