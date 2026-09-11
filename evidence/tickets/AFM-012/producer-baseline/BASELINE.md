# Producer regression baseline

**Commit:** `81ae028adfdce3a56f78cfa53e9833c08308f0d4` (partition runs)
**Image:** `v-flow-exais:dev` — node v22.23.2, bun 1.3.13, ffmpeg 5.1.9-0+deb12u1,
chrome-headless-shell 148.0.7778.167, Debian 12.15
**Method:** each partition run standalone. No chaining, so a failure in one could
not prevent learning anything about the others.

## Inventory, regenerated at this commit

`{"total":103,"unit":{"bun":42,"vitest":42},"integration":{"bun":10,"vitest":9}}`

Matches the previously recorded counts exactly. **These are selection counts,
not execution results.**

## Results

| Partition | Exit | Selected | Launched | Files passed | Files failed | Cases passed | Cases failed |
|---|---|---|---|---|---|---|---|
| unit / bun | **0** | 42 | 42 | 42 | 0 | 660 | 0 |
| unit / vitest | **1** | 42 | 42 | 40 | 2 | — | 2 |
| integration / bun | **1** | 10 | **3** | 2 | 1 | 30 | 1 |
| integration / vitest | **0** | 9 | 9 | 9 | 0 | 77 | 0 |

After the ffprobe caller fix below, unit/vitest was rerun and reports exact
aggregates: **665 passed, 1 failed, 1 skipped, 667 total, 41 of 42 files
passing**. The 1 skipped case is recorded as skipped, not as passed.

## CORRECTION: integration/bun left 7 files unlaunched

An earlier version of this document claimed *"no files were left unlaunched in
any partition"*. **That was wrong**, and it contradicted a log committed in this
same directory. The runner states its own verdict plainly:

```
[producer:integration/bun] Selected 10 test files.
[producer:integration/bun] Runner exited 1; 7 selected files not launched.
```

The partition is fail-fast: `assemble.test.ts` failed and the run stopped. Only
**3 of 10** files launched — 2 passing, 1 failing.

The error was mine, and instructive: reporting unlaunched files is exactly the
capability merged in PR #1. It printed the answer in plain English and I counted
`Ran … across` summaries with a regex instead of reading the runner's verdict. A
derived count was trusted over the tool's own statement.

**The 7 files were then run independently** — see
`integration-bun-unlaunched.log`. All 7 pass: **144 cases, 0 failed, 0 skipped**.

| Previously unlaunched file | Result |
|---|---|
| `src/services/distributed/chunkBoundary.test.ts` | pass |
| `src/services/distributed/crossWorkerIdempotency.test.ts` | pass |
| `src/services/distributed/plan.test.ts` | pass |
| `src/services/distributed/planSizeCap.test.ts` | pass |
| `src/services/distributed/renderChunk.test.ts` | pass |
| `src/services/fileServer.test.ts` | pass |
| `src/services/htmlCompiler.naturalDuration.test.ts` | pass |

The fail-fast runner was **not** modified to make this report look complete, and
the original fail-fast log is retained unchanged.

## Coverage caveat: two macOS font checks pass without exercising macOS

In `deterministicFonts-systemCapture.test.ts`, cases print

```
Skipping: /System/Library/Fonts/Supplemental/Impact.ttf not available
```

and return early, yet Bun records them as `(pass)`. They are counted among the
passing cases above but are **not** evidence that macOS system-font capture
works. That behaviour is unverified on this platform.

## Failures, classified by evidence

Classification rests on whether the implicated source differs from the imported
upstream bytes — not on where the test originated.

### 1. `src/utils/ffprobeArgvContract.test.ts` — confirmed integration regression — FIXED

```
packages/studio-server/src/project/projectBatch.ts:
  "--" must be immediately before the input
```

`projectBatch.ts` is **new code in this repository**, not imported from upstream.
It built `["-v","error","-count_frames","-show_streams","-show_format","-of",
"json", path]` with no `--`, so a media file whose name begins with `-` would be
parsed as an option rather than as the file to probe.

The assertion was **not** weakened; the caller was fixed. Focused rerun:
**73/73**. Full-partition rerun: 2 failing files → 1, recorded in
`unit-vitest-after-fix.log`. The original failing run is retained in
`unit-vitest.log`; a later passing run does not retroactively make it pass.

### 2. `src/services/distributed/assemble.test.ts` — not yet classified

```
concat-copies two mp4 chunks and applies faststart
expected videoStream.r_frame_rate to be "30/1", received "30000/1001"
```

Both `assemble.ts` and `assemble.test.ts` are byte-identical to the imported
upstream, so our edits did not cause this. That alone does not make it inherited.

`assemble.ts` does pass `-r fpsArg` on the concat path — **but its presence does
not prove the packet timestamps carry the required cadence.** Output `-r` during
stream copy neither drops nor duplicates frames, so it can disagree with the
actual timestamps, and the concat demuxer positions each input using its
declared duration.

An independent experiment reproduced this exact fraction: concatenating two
5-frame 30fps chunks whose durations were declared as rounded `0.167` seconds
produced **`30000/1001`**, while frame-derived durations produced `30/1`. At
time base 1/15360 the second chunk should start at 2560 ticks; the rounded case
started it at 2565, with the preceding packet lasting 517 ticks instead of 512.

That is a controlled reproduction of a plausible mechanism, **not proof** that
the ffmpeg 5.1.9 failure here has the same cause. The cheap next experiment is
to preserve the chunks and concat intermediate and compare container durations,
stream durations, packet timestamps, packet durations and time bases — before
changing ffmpeg versions or adding frame-rate flags. A metadata-only fix that
leaves timing wrong would not satisfy the contract.

### 3. `src/services/render/audioPadTrim.integration.test.ts` — not yet classified

```
audio pad real-media packet contract > keeps the delivered AAC below its true-peak ceiling
AssertionError: expected 5.9 to be less than or equal to 3   (line 179)
```

**CORRECTION: this is not a true-peak failure.** An earlier version of this
document took the test's *title* as the diagnosis. The test asserts three things
in order, and line 179 is the third:

```ts
expect(sourceLevel.truePeakDbfs).toBeCloseTo(-1.5, 1);                 // passed
expect(deliveredLevel.truePeakDbfs).toBeLessThanOrEqual(-1);           // passed
expect(Math.abs(deliveredLevel.integratedLufs
              - sourceLevel.integratedLufs)).toBeLessThanOrEqual(3);   // FAILED
```

The delivered-peak assertion **passed**. `5.9` is an **integrated-loudness delta
in LU**, not a true peak in dBFS. The engineering question is therefore not "why
did the limiter fail" but **"why does reaching the peak ceiling shift overall
loudness by more than 3 LU?"**

An independent reproduction on a different ffmpeg build (7.1.5) showed the same
failure pattern — cumulative correction gains of −3.6, −4.5 and −5.9 dB, final
loudness delta 6.1. That does not rule out build variation, but it does mean
**upgrading ffmpeg is not an established fix**.

Next step is stage-level measurement in the pinned container: source PCM, mixed
AAC, trim output, each correction candidate, delivered media — the implementation
re-encodes during both duration and peak correction, so those are the boundaries
to inspect. Both requirements must hold: safe delivered peak **and** loudness
preservation. Neither may be relaxed to satisfy the other.

There is no reason to assume failures 2 and 3 share a cause.

## What this baseline does and does not establish

**Does:** every selected file now has execution evidence — 96 of 103 from the
partition runs, plus the 7 from independent follow-up runs. unit/bun is green at
660 cases, integration/vitest at 77, the follow-up files at 144. One failure was
a regression from our own new code and is fixed.

**Does not:** prove the producer works. Two media failures remain unexplained,
and an unexplained failure is not a passing one. The closing evidence this still
needs is a **complete rerun of the affected partitions against one final commit**
— the present state is one fail-fast partition plus separate follow-up runs.

A caution on attribution: byte-identical source establishes that *those files*
were not edited. It does not exclude every effect of the fork — dependencies,
helpers, export resolution, configuration and native tool builds can all differ.

## Reproducing

```sh
docker compose run --rm workspace bash -lc \
  'cd packages/producer && bun run test:unit:bun'
```

Run each partition separately (`test:unit:bun`, `test:unit:vitest`,
`test:integration:bun`, `test:integration:vitest`). Focused diagnosis of one file:

```sh
node scripts/run-test-lane.mjs integration bun src/services/distributed/plan.test.ts
```

Logs in this directory carry the commit, exact command, full output and exit code.
