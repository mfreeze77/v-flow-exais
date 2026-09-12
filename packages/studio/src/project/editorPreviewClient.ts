import {
  assertEditorProjectView,
  assertEditorPreviewSession,
  EditorPreviewError,
  type EditorPreviewSession,
  type EditorProjectView,
} from "@hyperframes/project-model";

export type PreviewFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Construction is inert. Invalid IDs and network failures reject the async operation. */
export function createEditorPreviewClient(projectId: string, fetcher: PreviewFetch = fetch) {
  return {
    async prepare(view: EditorProjectView, signal?: AbortSignal): Promise<EditorPreviewSession> {
      signal?.throwIfAborted();
      const captured = structuredClone(view);
      assertEditorProjectView(captured);
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(projectId) || captured.projectId !== projectId)
        throw new EditorPreviewError(
          "editor/foreign-project",
          "Preview requires the captured managed project.",
        );
      const response = await fetcher(
        `/api/vflow/projects/${encodeURIComponent(projectId)}/editor/previews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            projectId,
            revision: captured.revision,
            revisionHash: captured.revisionHash,
          }),
          ...(signal ? { signal } : {}),
        },
      );
      signal?.throwIfAborted();
      if (!response.ok) {
        let body: { code?: string; error?: string } = {};
        try {
          body = await response.json();
        } catch {
          /* Preserve the HTTP failure. */
        }
        throw new EditorPreviewError(
          typeof body.code === "string" ? body.code : "editor/preview-failed",
          typeof body.error === "string"
            ? body.error
            : `Preview preparation failed (${response.status}).`,
          response.status,
        );
      }
      const value: unknown = await response.json();
      signal?.throwIfAborted();
      assertEditorPreviewSession(value);
      if (
        value.projectId !== captured.projectId ||
        value.revision !== captured.revision ||
        value.revisionHash !== captured.revisionHash ||
        value.scenes.length !== captured.scenes.length
      )
        throw new EditorPreviewError(
          "editor/mismatched-preview",
          "Preview belongs to a different authoring revision.",
          409,
        );
      for (const [index, binding] of value.scenes.entries()) {
        const scene = captured.scenes[index]!;
        const doc = captured.documents.find((d) => d.documentId === binding.documentId);
        if (
          !doc ||
          binding.sceneId !== scene.id ||
          binding.documentId !== scene.documentId ||
          binding.kind !== scene.kind ||
          binding.startFrame !== scene.startFrame ||
          binding.durationFrames !== scene.durationFrames ||
          binding.sourcePath !== doc.path ||
          binding.documentKind !== doc.kind
        )
          throw new EditorPreviewError(
            "editor/mismatched-preview",
            "Preview scene mapping differs from the captured authoring view.",
            409,
          );
      }
      return structuredClone(value);
    },
  };
}

/** A late response cannot replace a newer requested preview, even when abort is ignored. */
export function createPreviewPublicationGate() {
  let epoch = 0;
  let disposed = false;
  return {
    begin(): number {
      if (disposed) throw new Error("Preview publication gate is disposed.");
      return ++epoch;
    },
    isCurrent(token: number): boolean {
      return !disposed && token === epoch;
    },
    dispose(): void {
      disposed = true;
      ++epoch;
    },
  };
}
