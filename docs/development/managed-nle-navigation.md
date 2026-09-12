# Managed master/scene navigation

Base: `34bdea13ae5e92c638250848f1ef93b8698ac233`.
Scope: AFM-059/060 playback navigation. This does not close AFM-072, AFM-078,
or the complete native/managed editor integration.

## What is connected

`ProjectWorkspace` uses `useManagedPreviewNavigation` and the retained player
and `CompositionBreadcrumb` to preview an individual scene inline. The master
playhead is saved in integer frames; returning from scene-local playback restores
that position, including frame zero. No scene click writes a project revision.

`EditorShell` now accepts an explicit `managedNavigation` option and passes it
through `NLEProvider` to `useCompositionStack`. Managed mode consumes the existing
`EditorPreviewSession` instead of fetching native `index.html` or parsing a source
map from generated HTML. The native path remains the default when this option is
absent. `{session: null}` means managed but waiting, NOT permission to use native
routes. The preview pane shows a waiting state rather than mounting a native
player while a managed build is unavailable.

Both paths use the same managed navigation state machine. There is no new renderer,
authoring store, journal, network loader or animation clock.

## Integration contract

```tsx
<EditorShell
  {...existingProps}
  managedNavigation={{
    session: acceptedPinnedPreview, // EditorPreviewSession | null
    onSceneChange: (sceneId, sourcePath) => {
      // Keep sceneId as the selected appearance; sourcePath is its document.
      // Do NOT collapse repeated appearances into one file-path selection.
    },
    onError: reportNavigationError,
  }}
/>
```

This option controls PLAYBACK NAVIGATION only. Supplying it does not authorize
native writes to a diagram, provide managed history for native edit controls,
or migrate project-file CRUD/upload/sidecar operations. `ProjectRouter` is
intentionally unchanged. Do not replace its managed/native branch merely because
this prop now exists. Native history delegation and operation capability gating
must be connected before the full managed native-editor mode is enabled.

`activeCompositionPath` is still an authoring document path for SDK/source tools.
A unique managed source path may activate its scene; a path with two appearances
is rejected rather than guessed. Scene/render-token clicks retain the exact
scene identity and separately announce its authoring path. The managed stack's
`managed-scene:<id>` is a navigation key, not a filename.

## Identity and lifetime

- The accepted session is validated and copied. Publications from another project,
  an older revision, or contradictory data for the same immutable identity fail.
- Every view transition has a generation token. Late `ready`/`timeupdate` events
  from an outgoing player cannot move a new playhead, even after an A -> B -> A
  visit returns to the same URL.
- A new build preserves the selected scene by scene ID plus document ID/kind.
  Reordering does not select whichever scene inherited `el-0`. A removed scene
  or a scene repointed to another document returns to master with an explicit
  notice. This is navigation fallback, not presentation-target reassignment.
- The retained NLE checks the displayed document's project, build/index hashes and
  scene URL before processing a drill-down. Its timeline stays disabled until
  that pinned view and the retained runtime are ready.
- Only native-document bindings enter the inherited DOM source map. Generated
  diagram output does not become a native-editable filename. A scene navigation
  may display a diagram; this is not a grant to edit its SVG.
- `NLEProvider` does not inject the native MotionPath CDN fallback for managed
  previews. Managed dependencies belong to the pinned build. Future plugin
  support must materialize the needed dependencies rather than enabling a live
  fallback in this path.

Time conversion uses the session's rational frame rate and half-open frame ranges.
Standalone playback is scene-local; the workspace's story position is derived
from the pinned scene's start frame. A failed preview refresh can retain an older
valid build, and navigation uses THAT build's dimensions, timing and identities,
not newer authoring metadata. The existing saved-versus-preview-error distinction
is preserved.

## Tests and limits

`managedPreviewNavigation.test.ts` has 41 pure runtime cases. Additional tests
exercise React/custom-element event lifetimes, the actual retained stack hook,
NLE source-map publication, and the preview pane's master URL. Component tests
substitute the media player where documented; they do not prove browser playback,
layout, GPU capture, audio alignment, or a complete editing journey.

Before accepting this integration, run the repository's existing NLE stack,
provider, pane/player and source-resolution tests alongside the new ones. In a
real browser, import a mixed diagram/title project, move the master playhead,
open each scene inline, return, then edit source, regenerate and navigate again.
Compare project revision/history before and after navigation to establish no
phantom authoring edit. Confirm that rejected stale events cannot activate
another scene and that native projects retain their existing preview URLs.

Do not suppress the recorded PropertyPanel/Timeline baseline failures or infer
resource starvation solely from isolation passes. Compare failures on the same
pinned environment and record the observed scope. No timeout is increased by this
change. No dependency, lockfile, generated runtime, producer media code, project
schema, symlink fixture or authoring transaction is changed.
