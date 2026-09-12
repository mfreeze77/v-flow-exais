# Producer regression baseline

**Image:** `v-flow-exais:dev` — node v22.23.2, bun 1.3.13, ffmpeg 5.1.9-0+deb12u1,
chrome-headless-shell 148.0.7778.167, Debian 12.15
**Method:** each partition run standalone, never chained, so a failure in one
could not prevent learning anything about the others.

## Final result — all four partitions complete, one tree

Logs in `final/`.

| Partition            | Exit  | Files | Cases passed | Cases failed | Unlaunched |
| -------------------- | ----- | ----- | ------------ | ------------ | ---------- |
| unit / bun           | **0** | 42/42 | 660          | 0            | none       |
| unit / vitest        | **0** | 42/42 | 666          | 0            | none       |
| integration / bun    | **0** | 10/10 | 175          | 0            | none       |
| integration / vitest | **0** | 9/9   | 77           | 0            | none       |

**103 of 103 selected files launched and passed. 1,578 test cases.**

Inventory regenerated at the tested commit:
`{"total":103,"unit":{"bun":42,"vitest":42},"integration":{"bun":10,"vitest":9}}`

Earlier runs are retained in the parent directory. A later passing run does not
retroactively make an earlier failing run pass, and the originals show what the
inherited producer actually did before the fixes.

## The three failures, and how each was resolved

### 1. ffprobe argv contract — confirmed integration regression

`packages/studio-server/src/project/projectBatch.ts` is **new code in this
repository**, not imported. It built its ffprobe argv without `--` before the
input path, so a media file named `-foo.mp4` would be parsed as an option.

The assertion was preserved; the caller was fixed.

### 2. Concat chunk-boundary timing — confirmed defect in inherited code

```
expected r_frame_rate "30/1", received "30000/1001"
```

The concat list was written as bare `file '<path>'` lines with **no `duration`
directives**, so the demuxer positioned each next input using the container's
_rounded_ duration: a 5-frame 30fps chunk reports `0.167000`, not `0.166667`.
Chunk 2 therefore started 5 ticks late at time base 1/15360, and the irregular
gap made ffmpeg derive `30000/1001`.

Measured here on our own ffmpeg 5.1.9:

| variant                    | final `r_frame_rate` | packet 6 PTS |
| -------------------------- | -------------------- | ------------ |
| original                   | `30000/1001`         | 0.166992     |
| output-`r`-only            | `30000/1001`         | 0.166992     |
| **frame-derived duration** | **`30/1`**           | **0.166667** |
| rounded-duration control   | `30000/1001`         | 0.166992     |

At 24000/1001 the original degrades further, to `287/12`.

Two things this settles. **The input-side `-r` does not prevent it** — the
`-r`-only variant still produced `30000/1001`, so adding frame-rate flags would
have been the wrong fix. And the upstream comment sitting beside that flag shows
it was an attempt at this same problem: a known-needed, insufficient mitigation.

**Fix:** derive each entry's `duration` from validated chunk frame ranges and the
plan's rational rate — `frames × fpsDen / fpsNum` at full precision. No
re-encode, no new flags. The timestamps are corrected, not the metadata label.

### 3. AAC delivery loudness — confirmed defect in inherited code

```
audio pad real-media packet contract > keeps the delivered AAC below its true-peak ceiling
AssertionError: expected 5.9 to be less than or equal to 3   (line 179)
```

**This was never a true-peak failure.** The test asserts three things and line
179 is the third; the delivered-peak assertion on line 176 **passed**. `5.9` is
an integrated-loudness delta in **LU**, not a peak in dBFS.

The correction applied `volume=<attenuation>dB` — a blanket gain cut across the
whole signal to bring a few peaks under the ceiling, so integrated loudness fell
by the full attenuation. It also could not converge, because each pass added the
entire remaining deficit on the assumption that peak responds linearly to gain.
It does not: AAC encoding adds a level-dependent overshoot.

Measured on ffmpeg 5.1.9:

| pass        | attenuation | integrated LUFS | true peak dBFS         |
| ----------- | ----------- | --------------- | ---------------------- |
| 0 (trimmed) | 0.0 dB      | 1.7             | **+1.4**               |
| 1           | −2.4 dB     | −0.7            | **+2.3** ← peak _rose_ |
| 2           | −5.7 dB     | −4.0            | −4.4                   |

Attenuating by 2.4 dB moved the measured peak **up**. The next pass compounded
to −5.7 dB and undershot the ceiling by 3.4 dB, taking loudness with it.

This reproduces on ffmpeg 5.1.9 (5.9) and on 7.1.5 (6.1), so it is not build
variation and an ffmpeg upgrade would not have fixed it.

**Fix:** a look-ahead limiter, which reduces only what exceeds the ceiling —
`alimiter=limit=<linear>:level=disabled`. `level=disabled` matters: the default
normalises the result back up, reintroducing the peaks just removed. The loop
lowers a limiter ceiling rather than accumulating gain, with a 0.5 dB margin for
AAC overshoot, and each pass re-encodes from the original input so limiting is
never stacked.

Both requirements hold and neither assertion was weakened.

## Corrections made to this document

Two reporting errors of mine, both caught in external review:

1. **It claimed no files were left unlaunched.** The fail-fast integration/bun
   run had left **7 of 10** unlaunched, and said so plainly:
   `Runner exited 1; 7 selected files not launched`. I counted `Ran … across`
   summaries with a regex instead of reading the runner's own verdict —
   trusting a derived count over the tool's statement. Reporting unlaunched
   files is precisely the capability merged in PR #1.

2. **It diagnosed the audio failure as a true-peak failure**, taking the test's
   title rather than reading which assertion failed.

The 7 files were run independently at the time, and now launch in the normal
partition because the fail-fast _cause_ is gone. The runner was never modified
to make a report look complete.

## Known coverage gaps — passing is not always covering

- **macOS system-font capture is unverified.** Two cases in
  `deterministicFonts-systemCapture.test.ts` print
  `Skipping: /System/Library/Fonts/… not available`, return early, and Bun
  records them as `(pass)`. They count among the passing cases above but
  demonstrate nothing about macOS behaviour.
- **`alimiter` is a dynamics processor.** It changes audio character, not only
  level. Both assertions hold, but nothing here evaluates perceptual quality;
  that warrants a human listen before shipping.
- **Attribution.** Byte-identical source establishes that _those files_ were not
  edited — not that every effect of the fork is excluded. Dependencies, helpers,
  export resolution, configuration and native tool builds can all still differ.

## What this establishes, and what it does not

**Does:** every selected producer test file launches and passes in the supported
environment, and two genuine defects in inherited code were diagnosed to
mechanism and fixed without weakening any assertion.

**Does not:** prove the producer works, or complete AFM-012. Passing the
inherited suites is not the same as the product being correct, and AFM-012's
package-boundary and reporting requirements are separate from its test results.

## Reproducing

```sh
docker compose run --rm workspace bash -lc \
  'cd packages/producer && bun run test:unit:bun'
```

Run each partition separately: `test:unit:bun`, `test:unit:vitest`,
`test:integration:bun`, `test:integration:vitest`. Focused single file:

```sh
node scripts/run-test-lane.mjs integration bun src/services/distributed/assemble.test.ts
```
