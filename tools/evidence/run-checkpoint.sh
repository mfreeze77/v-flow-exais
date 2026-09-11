#!/usr/bin/env bash
# V-Flow EXAIS — records a full checkpoint with an exit code for every check.
#
# Run inside the container:
#   docker compose run --rm -T workspace bash tools/evidence/run-checkpoint.sh <out-dir>
#
# Why this exists rather than a hand-assembled evidence directory:
#
#   - 14 of the 18 logs in the previous checkpoint recorded no exit code at all,
#     so the summariser had nothing to judge them by and the old generator called
#     them all "pass". A log without an exit status is not evidence of success.
#   - `lint.log` captured only oxlint's output, while `bun run lint` is an
#     eleven-command chain. Eight boundary and contract checks ran before oxlint
#     and two more after, none of them recorded. The chain's own exit status is
#     the only thing that speaks for all eleven.
#
# So: every check runs through `record`, which always appends EXIT=<status>, and
# the command recorded is the one actually executed. No step can be silently
# omitted, because a missing log reads as `unknown`, never as a pass.

set -uo pipefail

OUT="${1:?usage: run-checkpoint.sh <output-directory>}"
mkdir -p "$OUT"
# Absolute from here on. Several checks run with `--cwd packages/producer`, and
# a relative VFLOW_LANE_REPORT under one of those wrote its lane reports to
# packages/producer/<the same relative path> instead — so the summary found no
# framework evidence and correctly reported every Vitest total as unknown.
OUT="$(cd "$OUT" && pwd)"

record() {
  local name="$1"
  shift
  local log="$OUT/${name}.log"
  echo "=== $name ===" >&2
  {
    echo "COMMAND: $*"
    echo "STARTED: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
  } >"$log"
  # Both streams go to the log: a check that fails only on stderr must not
  # leave a log that reads clean.
  "$@" >>"$log" 2>&1
  local status=$?
  {
    echo
    echo "FINISHED: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "EXIT=$status"
  } >>"$log"
  echo "    exit $status" >&2
  return 0
}

# Environment provenance. A checkpoint that does not say what it ran on cannot
# be compared against a later one.
{
  echo "COMMAND: environment capture"
  echo
  echo "bun:      $(bun --version 2>&1)"
  echo "node:     $(node --version 2>&1)"
  echo "ffmpeg:   $(ffmpeg -version 2>&1 | head -1)"
  echo "ffprobe:  $(ffprobe -version 2>&1 | head -1)"
  echo "chromium: $(chromium --version 2>&1 | head -1)"
  echo "os:       $(cat /etc/debian_version 2>&1)"
  echo "commit:   $(git rev-parse HEAD 2>&1)"
  echo "dirty:    $(git status --porcelain 2>&1 | wc -l) file(s)"
  echo
  echo "EXIT=0"
} >"$OUT/environment.log"

# --- Repository-wide checks -------------------------------------------------
# The full lint chain, recorded by its own exit status rather than by one link.
record lint                     bun run lint
record format                   bun run format:check
record check-package-boundaries node scripts/check-package-boundaries.mjs
record check-workspace          bun run check:workspace
record doctor                   bun run doctor
record audit-assets             bun run audit:assets
record audit-automation         bun run audit:automation

# --- Script and tooling suites ----------------------------------------------
record boundaries-tests         node --test scripts/check-package-boundaries.test.mjs
record checkpoint-summary-tests node --test tools/evidence/checkpoint-summary.test.mjs
record scripts-tests            bun run test:scripts
record classification           bun run --cwd packages/producer test:classification

# --- Producer partitions ----------------------------------------------------
# Names match the partitions the summariser reads.
#
# Only the lanes get VFLOW_LANE_REPORT. Exporting it for every check leaked it
# into the runner's own contract tests, which then saw an extra log line and
# failed on an assertion about a different message entirely.
record_lane() {
  local name="$1"
  shift
  # Set and unset explicitly. Whether an assignment prefixed to a shell function
  # call persists afterwards differs between bash modes, and a leaked value here
  # is precisely the bug this wrapper exists to avoid.
  export VFLOW_LANE_REPORT="$OUT/${name}.report.json"
  record "$name" "$@"
  unset VFLOW_LANE_REPORT
}

record_lane unit-bun            bun run --cwd packages/producer test:unit:bun
record_lane unit-vitest         bun run --cwd packages/producer test:unit:vitest
record_lane integration-bun     bun run --cwd packages/producer test:integration:bun
record_lane integration-vitest  bun run --cwd packages/producer test:integration:vitest

# --- Acceptance -------------------------------------------------------------
record acceptance               bun run test:acceptance

# The summary is generated from these records; it does not restate them.
node tools/evidence/checkpoint-summary.mjs "$OUT"
exit $?
