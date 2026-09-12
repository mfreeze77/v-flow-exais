# Managed editor previews and scene mappings

Scope: the preview/scene-address part of AFM-059/060/077. This does **not** finish
native Studio mounting, journal-owned native history, or editing capability gates.

## Authoring and playback are different address spaces

`compileSceneBindings` supplies the same emission addresses the motion compiler
uses. Each receipt records the scene instance, document ID/kind, authoritative
source path, generated output path, frame interval, and host identifiers. Repeated
appearances share the document ID but not the scene identity or generated output.
The existing emission filenames remain unchanged; MOTION_VERSION is 1.1.0 because
receipt metadata and scene markup have expanded.

`resolvePreviewScene` resolves against one validated session, not by trimming an
arbitrary filename or taking the first occurrence of a document. A render token
requires the captured build and revision hashes. Reused `el-0`/`slot-0` tokens
from another build are rejected. Source-path-only selection is ambiguous when a
document appears twice; the caller must supply the scene instance.

The `editOwner` field identifies the intended owner, **not permission to execute
an edit**. The compiler-owned master has no authoritative HTML document. Future
native-editor wiring must retain the journal writer and content preconditions,
and check capabilities against trusted bindings, not untrusted DOM attributes.

## HTTP contract

1. Read `/api/vflow/projects/:id/editor` to capture the committed revision and
   immutable index digest.
2. POST `/api/vflow/projects/:id/editor/previews` with exactly `projectId`,
   `revision`, and `revisionHash`. An already-stale request is 409, not an
   instruction to build whatever happens to be current. Preparation is an
   explicit compile/build action; it does not add an authoring revision.
3. Use `/api/vflow/projects/:id/editor/previews/:buildHash/view` for the master.
   Add `?sceneId=...` for a standalone scene.
4. Local resources resolve below the same build's `/assets/:name` endpoint.
   Only the installed GSAP file and hashed WAV/PNG addresses are served, and
   only when the receipt lists them and their bytes match its digest.

All GETs above read an existing build. They never call build(), follow CURRENT to
a different revision, substitute a live asset, or stamp an authored source file.
They use no-store responses so corruption is checked on subsequent requests.
Missing/corrupt outputs fail; older receipts lacking scene mappings require an
explicit new preparation. Older render outputs and legacy routes are retained.
The existing legacy `/vflow/projects/:id/preview` endpoint is NOT redefined here.

A change committed during compilation cannot replace the captured snapshot. The
returned preview may be older than CURRENT, but it is correctly identified. The
workspace checks load generations before publication, retains its last valid
preview when preparation fails, and does not call a confirmed save a failed write
merely because its subsequent preview refresh failed.

## Rendering implementation

Master preview uses the retained adapter bundle pipeline. A single-scene preview
uses `buildSubCompositionHtml`; it is a scene-local view, **not a preview of the
adjacent master transition**. Its root has local start zero, the scene's rational
frame duration, and the output dimensions. Playback/seek parity for these roots
still requires the browser verification below; markup assertions do not prove it.

LinkeDOM decorates only the derived document with build/revision and authoring
context and an immutable resource base. Native composition-file links are mapped
to the authoritative native path. Diagrams remain `diagram-command` owned; their
generated SVG/HTML is not made into native source. No hf-id persistence or native
file writer is invoked by the route.

The authoring bytes, generated files and copied assets are build-pinned. The
host-supplied preview runtime URL and transform implementation still belong to
the deployed application. This is not a guarantee of identical pixels across
runtime/server upgrades. The existing producer pinning and release checks remain
necessary. Native external subcomposition trees, arbitrary assets, byte ranges,
and media-proxy parity are not expanded by this bounded change.

## User-visible integration and remaining work

ProjectWorkspace now uses an immutable master URL and offers a selected-scene
preview link. Its existing commands and persistent conflict panel are unchanged.
The hostile-native-ID/read-contract fixes, native read client, generated runtime,
formatter exclusions, media fixes and restored symlink are not touched.

ProjectRouter still chooses ProjectWorkspace versus StudioApp. Before changing
that, wire these mappings to NLE drill-down/selection, delegate native history to
the journal, and prohibit unsupported native edits to managed output. Do not pass
an emitted filename to `writeAuthoredDocument` or infer scene context from an
array index. This change does not claim that the full native editor can already
edit a managed project.

## Verification obligations

The contribution's isolated checks cover the shared mapping contract, client
validation/publication gate, and real filesystem hashing. Their transport and
package dependencies are bounded diagnostic adapters, not the application stack.
Run the real compiler tests, store/Hono tests, LinkeDOM tests, package typechecks,
existing reader/writer/conflict tests, AFM-078, root lint/format, and a browser
journey in the pinned container before integration.

In the browser, open the mixed project, follow both scene links, check all local
resources, scrub backward and at the half-open boundary, and verify authoring JSON
and native HTML remain unchanged by reads. Delay an old preparation while a newer
one completes; its late success or failure must not replace the newer preview.
After an invalid edit or failed refresh, the old view must retain its original
revision/build headers. Test source edits, undo, reload and actual export. Keep
these UI/render results separate from passing route and markup assertions.
