#!/bin/sh
set -eu
exec "${PRODUCER_HEADLESS_SHELL_PATH:?Pinned Chrome path required}" --no-sandbox "$@"
