# Managed document write preconditions

This is a bounded AFM-072 correction based on `2ff9d034006e279447f869dbfb6aa791b33df35c`.
It does not close AFM-072 or AFM-078, expose managed projects through the native
Studio shell, or replace the project command journal.

## Two different concurrency windows

A whole-document edit is derived from a particular authoring state. Fetching a
newer project revision immediately before submitting that old edit is not a
substitute for checking the document the editor actually read.

1. An external edit commits before `readSnapshot()`: compare `expectedContent`
   against the target source in that snapshot. A mismatch throws
   `ProjectContentConflict` with code `project/content-conflict`, without
   allocating a command ID or calling `sendCommand()`.
2. An external edit commits after `readSnapshot()`: submit that snapshot's
   revision as `expectedRevision`; the existing service/journal rejects the race.
   Do not automatically fetch again and retry the old replacement.

The old implementation accepted a third `expectedContent` argument but ignored
it. An editor reading A could overwrite a later B with its stale A-derived C,
while legitimately supplying B's current revision to the service.

## Callers

Supply the original authoring content when saving an existing draft:

```ts
await writer(documentPath, editedContent, originalAuthoringContent);
```

Do not use generated preview HTML as the native baseline, or serialize through
a DOM only to derive the expected bytes. Native HTML comparisons are exact:
whitespace, empty strings and line endings are not normalized.

Diagram sources are stored as JSON objects. Their expected text is parsed and
compared by JSON value: indentation and object-key ordering are immaterial;
array ordering, values and additional fields remain significant. New source
still passes through the existing project command validation.

For compatibility the two-argument call still requests an unconditional
replacement against the freshly read revision. It cannot detect a draft that
became stale before that read. Draft-based UI callers must supply their baseline
or use a revision-bound project command directly.

A snapshot for the wrong project, a missing source, an invalid revision, or a
malformed diagram baseline is rejected. Errors deliberately omit source text.
There is no fallback direct file writer and no automatic commit retry.

## Evidence and remaining verification

Thirty new adapter checks execute the actual implementation with an injected
transport. In the assistant sandbox (Node 22.16.0, TypeScript 5.8.3), the original
adapter passed 10 and failed 20; the patched adapter passed all 30. TypeScript was
transpiled to ES2022 and only the test-framework import was changed from Vitest
to Node's test runner. These are not Bun, Docker, actual-journal, browser or
full-workspace test results. The existing seven `commandWriter.test.ts` cases
are left unchanged; they exercise the actual project model in the workspace.

Before merge, run in the pinned workspace container:

```sh
(cd packages/studio && bun x --no-install vitest run \
  src/project/commandWriter.test.ts \
  src/project/commandWriter.preconditions.test.ts)
bun run --cwd packages/studio typecheck
bun x --no-install vitest run --config vitest.acceptance.config.ts \
  tests/acceptance/AFM-078.test.ts
bun run lint
bun run format:check
```

Retain the command IDs/revisions and verify in browser integration that a
rejected edit leaves its draft intact. Actual journal, SDK publication, browser,
full package typecheck, lint and format verification remain pending for this
patch until the local manager records them. Preserve the restored symlink and
existing asset, media, selection and regeneration work.
