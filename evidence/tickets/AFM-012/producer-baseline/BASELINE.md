# Producer regression baseline

**Commit:** `81ae028adfdce3a56f78cfa53e9833c08308f0d4`
**Image:** `v-flow-exais:dev` — node v22.23.2, bun 1.3.13, ffmpeg 5.1.9-0+deb12u1,
chrome-headless-shell 148.0.7778.167, Debian 12.15
**Method:** each partition run standalone. No `&&` chaining, so a failure in one
could not prevent learning anything about the others. 50-minute timeout each.

## Inventory, regenerated at this commit

`{"total":103,"unit":{"bun":42,"vitest":42},"integration":{"bun":10,"vitest":9}}`

Matches the previously recorded counts exactly. **These are selection counts,
not execution results.**

## Results

| Partition | Exit | Files selected | Files launched | Files passed | Files failed | Test cases passed | Test cases failed |
|---|---|---|---|---|---|---|---|
| unit / bun | **0** | 42 | 42 | 42 | 0 | 660 | 0 |
| unit / vitest | **1** | 42 | 42 | 40 | 2 | see below | 2 |
| integration / bun | **1** | 10 | 10 | 9 | 1 | 63 | 1 |
| integration / vitest | **0** | 9 | 9 | 9 | 0 | — | 0 |

**No files were left unlaunched in any partition.** Every selected file was
launched and produced a summary, so there is no unknown-unexecuted population.

After the ffprobe caller fix (below), unit/vitest was rerun and reports exact
aggregates: **665 passed, 1 failed, 1 skipped, 667 total, 41 of 42 files
passing**. The one remaining failure is `audioPadTrim.integration.test.ts`.

The 1 skipped case is recorded as skipped, not as passed.

### A correction to an earlier count

An initial pass reported "39 launched" for unit/bun against 42 selected. That
was a regex error on my side — the pattern missed the singular `Ran 1 test
across …` form. All 42 launched. There was no gap.

## Failures, classified by evidence

Classification is based on whether the implicated source differs from the
imported upstream bytes, not on where the test originated.

### 1. `src/utils/ffprobeArgvContract.test.ts` — **confirmed integration regression** — FIXED

```
packages/studio-server/src/project/projectBatch.ts:
  "--" must be immediately before the input
```

`projectBatch.ts` is **new code in this repository**, not imported from
upstream. It built `["-v","error","-count_frames","-show_streams",
"-show_format","-of","json", path]` with no `--`, so a media file whose name
begins with `-` would be parsed as an option rather than as the file to probe.

The assertion was **not** weakened. The caller was fixed by inserting `"--"`
before the path. Focused rerun: **73/73 pass**. Full-partition rerun:
unit/vitest moves from 2 failing files to 1 (665 passed / 1 failed / 1 skipped),
recorded in `unit-vitest-after-fix.log`.

Note the original failing run is retained in `unit-vitest.log`. The rerun does
not retroactively make it pass.

### 2. `src/services/distributed/assemble.test.ts` — **not yet classified**

```
concat-copies two mp4 chunks and applies faststart
expected videoStream.r_frame_rate to be "30/1", received "30000/1001"
```

Both `assemble.ts` and `assemble.test.ts` are **byte-identical to the imported
upstream**, so our changes did not cause this. That is not sufficient to call it
inherited.

`assemble.ts` does pass `-r fpsArg` on the concat path, so this is not a missing
flag. `30000/1001` is exactly NTSC 29.97, which suggests either the muxer
selecting a timebase or an fps value arriving wrong. Distinguishing an
ffmpeg-version behavioural difference from a genuine inherited defect requires
comparing against the exact ffmpeg build upstream tested with, which we do not
have. Left explicitly unclassified rather than guessed.

The test's own comment states it exists to guard the `-r` flag from regressing,
so it is worth resolving properly rather than adjusting.

### 3. `src/services/render/audioPadTrim.integration.test.ts` — **not yet classified**

```
keeps the delivered AAC below its true-peak ceiling
expected 5.9 to be less than or equal to 3
```

Both implementation and test are **byte-identical to upstream**. True-peak
depends on the AAC encoder, which makes an ffmpeg-build difference plausible,
but that is a hypothesis and has not been demonstrated. Same reasoning as above:
not labelled inherited without evidence.

## What this baseline does and does not establish

**Does:** all 103 selected files launch; 61 of 61 files pass outside the three
failures above; unit/bun is completely green at 660 test cases; one failure is a
regression from our own new code and is fixed.

**Does not:** prove the producer works. These are the inherited test suites
running in this environment. Two failures remain unexplained, and an unexplained
failure is not a passing one.

## Reproducing

```sh
docker compose run --rm workspace bash -lc \
  'cd packages/producer && bun run test:unit:bun'        # and :unit:vitest,
                                                          # :integration:bun,
                                                          # :integration:vitest
```

Run each separately. Focused diagnosis of a single file:

```sh
node scripts/run-test-lane.mjs unit vitest src/utils/ffprobeArgvContract.test.ts
```

Logs in this directory carry the commit, exact command, full output and exit
code for each partition.
