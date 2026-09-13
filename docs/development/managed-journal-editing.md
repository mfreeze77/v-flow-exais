# Managed editing and project-owned history (AFM-072)

Implementation contribution based on `a601b8d661b56a3c3b3894eac28283079c19485c`.
This is not a ticket-completion receipt or proof that managed projects mount the full Studio.

## One authority, not synchronized undo stacks

`useManagedJournalAuthority` creates a per-session controller without making a request during
render. It is activated/released by an effect; late discovery reads are generation-gated.
`usePersistentEditHistory({projectId, journal})` subscribes to its cached immutable status and
never constructs or loads IndexedDB/native history in delegated mode. Undo/redo sends a single
project command against the observed revision; the file-read/write callbacks are ignored.
The native hook's store/controller exports and default behavior are retained.

App supplies the same authority's writer to both the internal file manager and the resolved
editing-system writer. The writer carries an explicit `vflowProjectJournal` capability. It is
not an authentication boundary and never authorizes a server path: the project service still
validates operations, revisions, content, assets and compilation.

The callable `(path, content, expectedContent?)` part of this writer deliberately rejects bare
writes **before mutation**. Supported transaction helpers recognize its capability instead:

- `persistSdkCandidateMutation` / `persistSdkSerialize`: one native document edit, one project
  command, then candidate publication/refresh. No independent recordEdit and no file rollback.
- `saveProjectFilesWithHistory`: all changed documents in one command; no sequential writes
  followed by compensating commits. Explicit raw-source edits require `expectedContent` captured
  with the draft. A fresh read is not a replacement for that baseline.

An editor not adapted to one of those transaction paths gets an actionable error. Do not fix that
error by handing it the old writer or by catching and continuing. A standalone `recordEdit` also
rejects: history is committed with the source, not added afterward.

## Ownership and stale edits

All paths must resolve to authoritative documents through the existing `operationForWrite`.
Generated output addresses, unknown files and duplicate aliases fail before command allocation.
Native/DOM/SDK edits may replace only native authored content. Diagram JSON replacement must be
an explicitly `source`-owned edit; it preserves the source family and still passes the server's
normal validation. These checks are not a complete capability policy for every NLE operation.

The existing content-precondition comparison is reused (exported rather than duplicated): exact
native text, JSON-value equality for diagram baselines. Commands use the revision loaded by the
controller; they do not fetch a newer revision immediately before saving or undoing. A server race
therefore remains a conflict. Conflicting/unsupported drafts must stay recoverable in the UI.

Native uploads, file/folder creation, rename, delete and duplication through the injected file
manager are blocked until they have real project operations. Existing CLI/in-process owned-asset
registration and the current managed workspace source commands are unchanged.

## Commit, retry and refresh have different outcomes

An explicit 4xx rejection is not a confirmed commit. A lost acknowledgement, malformed response,
or 5xx leaves the exact command identity/payload pending in the current editor session. New edits
and history operations are blocked. `retryPending()` resends the original payload/ID and lets the
existing idempotent journal recover its result. No automatic retry or rebase is performed.

Once a valid commit acknowledgement arrives, a subsequent history read failure is reported as
`Change saved; history refresh failed`. It does not throw a false write failure or execute a
compensating write. A newer revision discovered during that read is not silently adopted as the
baseline. Explicit reload/reconciliation is required. An observer exception cannot undo a commit.

Pending commands are **not** persisted in browser storage. After a browser/process restart, reload
committed state and reconcile any retained draft; do not reconstruct and resend an uncertain edit
with a new ID. The server outcome persists, but this patch does not add crash-persistent client
outboxes or automatic recovery of an unknown command ID.

`JournalStatusBanner` shows the controller's status and offers explicit original-command retry or
history reload. Preserve/reconcile drafts before accepting newer state. It does not own a second
history. Undo/redo bypasses native caption and beat stacks in journal mode and requests a full
preview/SDK refresh even for manifest-only changes; applying source-only DOM inverses cannot
represent timing, asset or conflict-state changes.

## Native compatibility

With no journal delegate, the existing native IndexedDB history, writes, rollback, read URLs,
caption/beat arbitration and source-save baseline contract are unchanged. The new managed-only
checks are not applied to native project names or paths. No dependencies, schemas, lockfiles,
producer/runtime files, generated checksummed assets, or NLE navigation files change here.

## Not yet enabled or finished

`ProjectRouter` is unchanged. Managed projects do not mount the retained Studio through this
patch. These are authoring integrations for that future mount, not a claim that the router or
canvas/inspector/timeline journey now works.

Before enabling it:

1. Provide the already-landed managed NLE navigation/session to the shared shell and keep
   source/preview/scene baselines coherent. Instrument real canvas and inspector commits.
2. Thread explicit raw-source draft baselines through the native source editor. Its current
   implicit-baseline save call is intentionally rejected in managed mode rather than permitted
   to overwrite a newer document. The managed workspace's revision-bound source form is unchanged.
3. Disable or convert legacy server-side mutation islands (caption, beat, lifecycle, upload,
   file CRUD, registry and sidecar workflows). Blocking their final file write does not prove an
   earlier POST had no effect. No such islands are declared supported here.
4. Use semantic commands for diagram edits and explicit presentation commands for timing.
   Mapping a generated ID to a document never authorizes direct SVG rewriting.
5. Demonstrate mixed editing, one history entry per gesture, undo/redo, safe regeneration,
   reopen and an inspected exported video through the actual browser UI.

Labels sent to this adapter are UI context, not new persisted journal metadata. The history view
uses a truthful generic `project change` label rather than inventing historical labels/timestamps.
No history coalescing or separate undo population is synthesized.

## Verification

See the contribution's `evidence/VERIFICATION.json` and `LOCAL_MANAGER_HANDOFF.md` for actual
executed commands and limitations. Isolated Node tests use transport/candidate doubles and are
not Bun/Vitest, filesystem-journal or browser evidence. The separately supplied real-service and
React tests remain required in the pinned workspace. Do not mark AFM-072 or AFM-078 complete from
this package or transplant a passing receipt from the base tree.
