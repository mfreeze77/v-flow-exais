/** AFM-059/060 bounded entry: a preview is not an authoring capability. */
import type { EditorPreviewSession, EditorProjectView } from "@hyperframes/project-model";
import type { JournalHistoryState } from "./journalHistoryTypes";

export class ManagedStudioRejected extends Error {
  readonly code = "editor/managed-operation-blocked";
  constructor(message: string) {
    super(message);
    this.name = "ManagedStudioRejected";
  }
}

export interface ManagedStudioPin {
  projectId: string;
  revision: number;
  revisionHash: string;
  buildHash: string;
  sceneId: string;
  documentId: string;
  sourcePath: string;
}

/** State belongs to the editor, not attributes supplied by active HTML. */
export function managedStudioPin(
  view: EditorProjectView,
  preview: EditorPreviewSession,
  sceneId: string,
  journal: JournalHistoryState,
): ManagedStudioPin {
  if (
    journal.owner !== "project-journal" ||
    view.writeOwner !== "project-command" ||
    view.generatedOutputEditable !== false ||
    preview.generatedOutputEditable !== false ||
    preview.historyOwner !== "project-journal" ||
    !journal.loaded ||
    journal.busy ||
    journal.uncertain ||
    journal.pendingCommandId ||
    journal.projectId !== view.projectId ||
    journal.revision !== view.revision ||
    preview.projectId !== view.projectId ||
    preview.revision !== view.revision ||
    preview.revisionHash !== view.revisionHash
  )
    throw new ManagedStudioRejected(
      "The editor, preview and journal must share one ready revision. Reload before editing.",
    );
  const scene = preview.scenes.find((item) => item.sceneId === sceneId);
  const doc = scene && view.documents.find((item) => item.documentId === scene.documentId);
  if (
    !scene ||
    !doc ||
    doc.path !== scene.sourcePath ||
    doc.kind !== scene.documentKind ||
    scene.kind !== (doc.kind === "native" ? "native" : "diagram") ||
    scene.editOwner !== (doc.kind === "native" ? "native-document" : "diagram-command") ||
    !doc.sceneInstanceIds.includes(sceneId)
  )
    throw new ManagedStudioRejected("Select an authored scene from this build before editing.");
  return {
    projectId: view.projectId,
    revision: view.revision,
    revisionHash: view.revisionHash,
    buildHash: preview.buildHash,
    sceneId,
    documentId: doc.documentId,
    sourcePath: doc.path,
  };
}

export function sameManagedStudioPin(a: ManagedStudioPin, b: ManagedStudioPin): boolean {
  return (
    a.projectId === b.projectId &&
    a.revision === b.revision &&
    a.revisionHash === b.revisionHash &&
    a.buildHash === b.buildHash &&
    a.sceneId === b.sceneId &&
    a.documentId === b.documentId &&
    a.sourcePath === b.sourcePath
  );
}

/** Narrow initial operations. No HTML/attribute/script/timing mutation hidden in a style edit. */
export type NativeInspectorEdit =
  | { type: "text"; value: string }
  | { type: "style"; property: "color" | "fontSize" | "opacity"; value: string };

export function validateNativeInspectorEdit(edit: NativeInspectorEdit): void {
  if (!edit || typeof edit !== "object" || Array.isArray(edit))
    throw new ManagedStudioRejected("An explicit edit is required.");
  const allowed = edit.type === "text" ? ["type", "value"] : ["type", "property", "value"];
  if (
    Object.keys(edit).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !Object.hasOwn(edit, key))
  )
    throw new ManagedStudioRejected("Unknown or missing edit fields.");
  if (edit.type === "text") {
    if (typeof edit.value !== "string" || edit.value.length > 10000)
      throw new ManagedStudioRejected("Text must contain no more than 10,000 characters.");
    return;
  }
  if (edit.type !== "style" || typeof edit.value !== "string")
    throw new ManagedStudioRejected("This operation is not enabled in the managed inspector.");
  const v = edit.value;
  if (edit.property === "color" && /^#[0-9a-fA-F]{6}$/.test(v)) return;
  if (edit.property === "fontSize" && /^(?:[1-9]\d{0,2}|1000)px$/.test(v)) return;
  if (edit.property === "opacity" && /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/.test(v)) return;
  throw new ManagedStudioRejected(
    "Unsupported or invalid style value. Use hex colour, 1–1000px font size, or opacity 0–1.",
  );
}

/** UI layout state is readable; legacy mutation callbacks have no capability in this mode. */
const READ_ACTIONS = new Set([
  "handleTimelineElementSelect",
  "handlePreviewCanvasMouseDown",
  "handlePreviewCanvasPointerMove",
  "handlePreviewCanvasPointerLeave",
  "applyDomSelection",
  "clearDomSelection",
  "applyMarqueeSelection",
  "buildDomSelectionFromTarget",
  "buildDomSelectionForTimelineElement",
  "updateDomEditHoverSelection",
  "setActiveGroupElement",
  "invalidateGsapCache",
  "getGsapAnimationsForSelection",
]);
export function readOnlyManagedDomSession<T extends object>(session: T, blocked: () => void): T {
  const result = Object.fromEntries(
    Object.entries(session).map(([key, value]) => [
      key,
      typeof value === "function" && !READ_ACTIONS.has(key) ? blocked : value,
    ]),
  ) as T;
  // The retained overlays consult these affordances before beginning a drag.
  for (const key of ["domEditSelection", "domEditHoverSelection"]) {
    const source = (result as Record<string, any>)[key];
    if (source?.capabilities)
      (result as Record<string, any>)[key] = {
        ...source,
        capabilities: Object.fromEntries(
          Object.entries(source.capabilities).map(([name, value]) => [
            name,
            typeof value === "boolean" ? (name === "canSelect" ? value : false) : value,
          ]),
        ),
      };
  }
  return result;
}
