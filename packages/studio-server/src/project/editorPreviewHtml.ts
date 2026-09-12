import { parseHTML } from "linkedom";
import {
  editorPreviewBase,
  EditorPreviewError,
  type EditorPreviewSession,
  type CompiledSceneBinding,
} from "@hyperframes/project-model";

/** Decorate a derived preview only. Never stamp IDs into the authored document on disk. */
export function decorateEditorPreview(
  html: string,
  session: EditorPreviewSession,
  scene?: CompiledSceneBinding,
): string {
  const base = `${editorPreviewBase(session)}/`;
  const { document } = parseHTML(html);
  if (!document.head || !document.body)
    throw new EditorPreviewError(
      "editor/invalid-preview-html",
      "Preview has no document root.",
      409,
    );
  for (const old of document.querySelectorAll("base")) old.remove();
  const baseNode = document.createElement("base");
  baseNode.setAttribute("href", base);
  document.head.insertBefore(baseNode, document.head.firstChild);
  const root = document.documentElement;
  root.setAttribute("data-vflow-project-id", session.projectId);
  root.setAttribute("data-vflow-revision", String(session.revision));
  root.setAttribute("data-vflow-revision-hash", session.revisionHash);
  root.setAttribute("data-vflow-build-hash", session.buildHash);
  root.setAttribute("data-vflow-generated-editable", "false");

  function mark(element: Element, binding: CompiledSceneBinding) {
    element.setAttribute("data-vflow-scene-id", binding.sceneId);
    element.setAttribute("data-vflow-document-id", binding.documentId);
    element.setAttribute("data-vflow-source-path", binding.sourcePath);
    element.setAttribute("data-vflow-generated-path", binding.outputPath);
    element.setAttribute("data-vflow-edit-owner", binding.editOwner);
    element.setAttribute("data-vflow-revision", String(session.revision));
    // Native DOM tools can resolve to native authoring. Diagram HTML remains compiler-owned.
    if (binding.kind === "native")
      element.setAttribute("data-composition-file", binding.sourcePath);
  }
  if (scene) {
    const element = document.querySelector("[data-composition-id]");
    if (!element)
      throw new EditorPreviewError(
        "editor/unmapped-preview",
        "Scene preview has no composition root.",
        409,
      );
    mark(element, scene);
    element.setAttribute("data-start", "0");
    element.setAttribute(
      "data-duration",
      String(
        (scene.durationFrames * session.output.fps.denominator) / session.output.fps.numerator,
      ),
    );
    element.setAttribute("data-width", String(session.output.width));
    element.setAttribute("data-height", String(session.output.height));
  } else {
    for (const binding of session.scenes) {
      const host = document.getElementById(binding.hostId);
      if (!host)
        throw new EditorPreviewError(
          "editor/unmapped-preview",
          "Compiled scene is missing from the master preview.",
          409,
        );
      mark(host, binding);
    }
  }
  for (const element of document.querySelectorAll("[data-composition-file]")) {
    const binding = session.scenes.find(
      (item) => item.outputPath === element.getAttribute("data-composition-file"),
    );
    if (binding) mark(element, binding);
  }
  return document.toString();
}
