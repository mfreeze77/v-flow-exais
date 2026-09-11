# V-Flow EXAIS

One Studio for typed architecture diagrams and real video production. Bun workspace, TypeScript, Vitest. Built by merging two owned sources: Archify (five typed diagram renderers) and HyperFrames (Studio / SDK / player / producer composition stack).

The authoritative spec is the tracked implementation pack at `docs/implementation/`: 134 tickets (AFM-001..AFM-134), 15 epics, six gates. Read the actual ticket body before implementing it — never work from a summary. Resume from `evidence/LEDGER.md` and the current scope in `docs/designs/scope-local-single-user.md`; the pack's original empty-directory intake instructions describe the completed import, not a request to restart it.

## Everything runs in Docker

`bun`, `ffmpeg`, `chromium` and fonts come from the image, not the host. Windows hosts files and the editor only.

```sh
docker compose build
docker compose run --rm workspace bun run test:unit
docker compose run --rm workspace bash
```

Renders use the pinned `chrome-headless-shell` from the image. Do not bump it casually: each Chrome stable bump shifts pixel output enough to fail PSNR against the golden baselines, so a bump means regenerating baselines in the same commit.

### Clean up after yourself

This machine hosts several other Docker projects. Leaving containers, dangling
images and build cache behind fills the disk.

- **Always `docker compose run --rm`.** Never leave a container behind.
- After a batch of work: `docker image prune -f && docker builder prune -f`.
  Both only remove unreferenced layers.
- **Never `docker volume prune` or `docker system prune -a`.** Other projects'
  database volumes live on this host, and `v-flow-exais_workspace-node-modules`
  / `v-flow-exais_bun-cache` are load-bearing here.
- Check with `docker system df`; scope anything destructive with
  `--filter name=v-flow-exais`.

## Rules

- **`git add -A` on Windows deletes the repo's one symlink.** Git here cannot
  stat `packages/producer/tests/render-symlinked-assets/src/shared`; it warns
  `Function not implemented` and then stages the path as _deleted_. That is how
  it vanished in AFM-005 — a commit about git hooks — and a clean `git status`
  looked like proof the import was complete. Never filter that warning out of a
  status check. If the entry is missing, restore it and re-arm the guard:

  ```sh
  git update-index --add --cacheinfo 120000,8fba6b66ae1b3d5c30626aa5a86283c4e96d80b2,packages/producer/tests/render-symlinked-assets/src/shared
  git update-index --skip-worktree packages/producer/tests/render-symlinked-assets/src/shared
  ```

  `skip-worktree` is a local index flag, so a fresh clone on Windows needs it
  set again. `bun run check:import-reconciliation` (first links of the lint
  chain) fails if any imported file stops being tracked without a declared
  reason, so the loss is caught rather than discovered later.

- **`_sources/` is frozen.** It is the read-only provenance baseline for drift detection and source-anchor lookups. Nothing imports it, nothing builds from it, and the repo must build with it absent. The product owns its copy under `packages/` — that is the code you edit.
- **Adding a workspace package means updating every Dockerfile.** The `COPY packages/<name>/package.json` lists are explicit; `bun install --frozen-lockfile` fails on any member missing from the build context. `bun run check:dockerfile-workspaces` catches it.
- **Keep the `@hyperframes/*` scope for now.** Per contract C11 a scope rename must update code, lockfile, exports, build scripts, skills and distribution tests atomically — it is its own ticket, not a drive-by.
- **Never animate a relationship that isn't in the authored model.** Guided-view focus order is not graph connectivity. `gateway -> api_a` and `gateway -> api_b` must not become `api_a -> api_b`.
- **One command/history boundary.** The project owns the write transaction; disable the SDK's autonomous history _and_ its persist queue when it does. Two competing autosave systems is a defect, not a config.
- **Compiler-owned vs presentation-owned.** Diagram geometry, endpoints, direction and labels belong to the compiler; framing, timing, emphasis, callouts and narration belong to presentation. Overrides persist against semantic identity + scene instance + base revision, never DOM paths.
- **Integer frames, rational fps.** Store `startFrame` / `durationFrames` as integers and fps as numerator/denominator. Convert to seconds only at the emitter.

## Evidence

Every ticket produces `evidence/tickets/AFM-###/result.json` with a real commit SHA, exact commands and exit codes, and artifact hashes. Per `docs/DEFINITION_OF_DONE.md`:

- A mocked provider response is a contract test. It is never live-service or model evidence.
- A render ticket is not done until an actual file exists and has been probed and visually inspected. A returned path proves nothing.
- A missing prerequisite is a recorded blocker, not a reason to mark a gate passed.
- Never manufacture a commit ID, timing, hash or result.

## Remote

Local only. No pushing to an upstream remote, no publishing `@hyperframes/*`, no infrastructure creation and no paid provider calls without explicit authorization.
