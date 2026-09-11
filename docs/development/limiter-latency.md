# AAC limiter timing follow-up (AFM-012)

The limiter fix for excessive loudness reduction is retained. This patch only
adds `latency=1` to its filter, exposes the existing argument builder to internal
tests, and adds real-media timing coverage. Peak/loudness thresholds, correction
iterations, margin, encoder settings, concat behavior and lane classification
are unchanged.

## Why this matters

FFmpeg 5.1 alimiter defaults to a 5 ms attack and disabled latency compensation.
Its look-ahead buffer can delay samples and lose buffered audio at EOF unless
compensation is enabled. A correct output duration does not prove alignment.
The official implementation documents the option and its default:
https://ffmpeg.org/doxygen/5.1/af__alimiter_8c.html

On the reviewer environment (Node 22.16.0, FFmpeg 7.1.5), the old filter shifted
markers by 219 samples at 44.1 kHz and 239 samples at 48 kHz, and lost a quiet
marker near EOF. The patch kept PCM markers at their authored positions and
kept decoded AAC markers aligned with an unfiltered AAC control.

These are six real-media checks of the actual production argument builder,
isolated from workspace imports. They are NOT a full producer suite, proof of
perceptual quality, or a completed gate. Before: six failures and exit 1. After:
six passes and exit 0. Evidence: `evidence/tickets/AFM-012/limiter-latency/`.

## Required pinned-environment verification before merge

Run each command in the existing pinned workspace container, without changing
or deleting project-data volumes. Capture exact exit codes and retain failures.

```sh
bun run --cwd packages/producer test:unit:vitest src/services/render/audioPadTrim.integration.test.ts
bun run --cwd packages/producer typecheck
bunx --no-install oxlint packages/producer/src/services/render/audioPadTrim.ts packages/producer/src/services/render/audioPadTrim.integration.test.ts packages/producer/src/services/render/audioLimiterTiming.fixture.ts tools/vflow/diagnose-limiter-timing.mjs
bunx --no-install oxfmt --check packages/producer/src/services/render/audioPadTrim.ts packages/producer/src/services/render/audioPadTrim.integration.test.ts packages/producer/src/services/render/audioLimiterTiming.fixture.ts tools/vflow/diagnose-limiter-timing.mjs
```

The existing file now contains its two original tests plus six timing cases.
Do not accept a pass achieved by skipping the media prerequisite. Preserve
both the -1 dBFS delivered-peak requirement and the <=3 LU loudness-difference
requirement. Rerun affected complete producer partitions against the final
commit; the pre-patch 1,578-case result is not a result for this patch.

A standalone diagnostic also works without workspace dependencies:

```sh
node --experimental-strip-types tools/vflow/diagnose-limiter-timing.mjs --output /tmp/vflow-limiter-latency-new
```

It requires a new output directory, retains PCM/AAC fixtures and measurements,
and exits nonzero if any timing check fails. `--source FILE` can select an
older trusted production source file for a before/after comparison. It executes
only the extracted argument-builder/formatter functions, not the full service.

AFM-012 package-boundary and structured-reporting requirements remain open.
No formatter/linter, pinned Docker, full Vitest, or listening pass is claimed by
this contribution. The existing platform-specific skips also remain separate
coverage limitations.
