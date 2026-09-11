# Runtime and installation contract

AFM-010. Machine-readable form: `provenance/runtime-contract.json`.
Check a live environment with `bun run doctor`.

## The one supported configuration

Everything runs in the container defined by `.devcontainer/Dockerfile`.

| Component | Tested version |
|---|---|
| Base image | `node:22-bookworm-slim@sha256:d649c27d…cc6436` |
| OS | Debian GNU/Linux 12.15 (bookworm) |
| Node | v22.23.2 |
| Bun | 1.3.13 |
| ffmpeg / ffprobe | 5.1.9-0+deb12u1 |
| chrome-headless-shell | 148.0.7778.167 (pinned) |
| Chromium | 152.0.7977.82 |

The base is pinned **by digest**, because a tag moves between builds and
`node:22-bookworm-slim` alone does not identify a reproducible environment.
Pinning the base does not freeze the `apt` and `npm` downloads layered on top,
so those versions are recorded as *observed*, not guaranteed.

## Untested, which is not the same as unsupported

- Host execution on Windows, macOS or non-container Linux. Node 22 and Bun
  1.3.13 may well work, but nothing here verifies it and the ffmpeg and
  headless-shell builds would differ.
- Node newer than 22. The declared floor is a minimum, not a certification.
- arm64. The recorded digest and headless-shell path are linux/amd64.

## Why the browser is pinned

Each Chrome stable bump shifts pixel output enough to fail PSNR against the
golden baselines. `bun run doctor` executes the shell and compares its reported
version against the pin — it does not merely check that a file exists, because a
real browser of the wrong build is the failure that matters.

Bumping the pin and regenerating the baselines belong in the same commit.

## Engine fields are not the contract

Each package's `engines` field describes *that package*. The binding statement
for the combined product is `provenance/runtime-contract.json`.

`diagram-engine` inherited `>=18` from Archify — true of Archify alone, false of
the combined product, which is the claim AFM-010 forbids. It is now `>=22` like
the rest of the workspace. That is a support-policy decision; it was not the
cause of any build failure.

## Installing

```sh
docker compose build
docker compose run --rm workspace bun install --frozen-lockfile
docker compose run --rm workspace bun run build
```

`--frozen-lockfile` is deliberate. A stale lockfile must fail loudly rather than
be silently rewritten:

```
error: lockfile had changes, but lockfile is frozen
```

If that appears, a manifest changed without the lockfile. Re-run `bun install`
without the flag and commit the updated `bun.lock` as a reviewed change.

## Diagnosing

```sh
docker compose run --rm workspace bun run doctor
```

Exit codes are distinct so a render pipeline can fail early with a specific
reason: **0** ready, **1** builds but cannot render (a render dependency is
missing or broken), **2** cannot build (a required runtime is missing or
unsupported).

The doctor executes every dependency rather than locating it. "Found on PATH" is
not "works" — an earlier version made exactly that mistake and reported green
for a binary whose version probe was failing.

It never installs anything. Initial downloads are an approved setup step, not
something a diagnostic performs on your behalf.
