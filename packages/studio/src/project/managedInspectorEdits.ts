import { openComposition } from "@hyperframes/sdk";
import type { Composition } from "@hyperframes/sdk";
import { OBJECT_COLLECTIONS } from "@hyperframes/project-model";
import type { EditorDocumentContent, EditorProjectView } from "@hyperframes/project-model";
import type { JournalHistoryDelegate } from "./journalHistoryTypes";
import {
  ManagedStudioRejected,
  validateNativeInspectorEdit,
  type NativeInspectorEdit,
} from "./managedStudioPolicy";

export type OpenNativeComposition = (
  html: string,
  options: { history: false },
) => Promise<Composition>;
export interface NativeInspectorTarget {
  hfId: string;
  tag: string;
  text: string | null;
  domId: string | null;
}
const TEXT_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "label",
  "button",
  "div",
]);

export async function nativeInspectorTargets(
  content: EditorDocumentContent,
  open: OpenNativeComposition = openComposition,
): Promise<NativeInspectorTarget[]> {
  if (content.kind !== "native")
    throw new ManagedStudioRejected("Only authored native HTML can be opened by the SDK.");
  const session = await open(content.content, { history: false });
  try {
    return session
      .getElements()
      .filter(
        (element) =>
          TEXT_TAGS.has(element.tag.toLowerCase()) &&
          element.text !== null &&
          element.children.length === 0,
      )
      .map((element) => ({
        hfId: element.scopedId,
        tag: element.tag,
        text: element.text,
        domId: element.attributes.id ?? null,
      }));
  } finally {
    session.dispose();
  }
}

/** The source baseline is captured before editing, never replaced with a fresh GET. */
export async function commitNativeInspectorEdit(options: {
  content: EditorDocumentContent;
  hfId: string;
  edit: NativeInspectorEdit;
  journal: JournalHistoryDelegate;
  assertCurrent: () => void;
  open?: OpenNativeComposition;
}): Promise<string[]> {
  const { content, hfId, edit, journal, assertCurrent } = options;
  validateNativeInspectorEdit(edit);
  assertCurrent();
  if (content.kind !== "native" || content.projectId !== journal.projectId)
    throw new ManagedStudioRejected(
      "The selected document is not native authoring in this project.",
    );
  const session = await (options.open ?? openComposition)(content.content, { history: false });
  try {
    assertCurrent();
    const target = session.getElement(hfId);
    if (
      !target ||
      !TEXT_TAGS.has(target.tag.toLowerCase()) ||
      target.children.length !== 0 ||
      target.text === null
    )
      throw new ManagedStudioRejected(
        "Select one authored text element. Containers and generated elements are not rewritten.",
      );
    const operation =
      edit.type === "text"
        ? { type: "setText" as const, target: hfId, value: edit.value }
        : { type: "setStyle" as const, target: hfId, styles: { [edit.property]: edit.value } };
    const capability = session.can(operation);
    if (!capability.ok) throw new ManagedStudioRejected(capability.message);
    session.dispatch(operation);
    const after = session.serialize();
    assertCurrent();
    return await journal.commitEdit({
      label: edit.type === "text" ? "Edit native text" : `Edit native ${edit.property}`,
      kind: "manual",
      files: { [content.path]: { before: content.content, after } },
    });
  } finally {
    session.dispose();
  }
}

export function diagramObjectRows(
  content: EditorDocumentContent,
): Array<{ id: string; label: string }> {
  if (content.kind === "native") return [];
  const source = JSON.parse(content.content) as Record<string, unknown>;
  const objects = source[OBJECT_COLLECTIONS[content.kind]];
  if (!Array.isArray(objects))
    throw new ManagedStudioRejected("Diagram object collection is missing.");
  return objects.map((value) => {
    if (!value || typeof value.id !== "string" || typeof value.label !== "string")
      throw new ManagedStudioRejected("Diagram object has no stable identity and label.");
    return { id: value.id, label: value.label };
  });
}
export async function commitDiagramLabel(options: {
  content: EditorDocumentContent;
  objectId: string;
  label: string;
  journal: JournalHistoryDelegate;
  assertCurrent: () => void;
}): Promise<string[]> {
  const { content, objectId, label, journal, assertCurrent } = options;
  assertCurrent();
  if (
    content.kind === "native" ||
    content.projectId !== journal.projectId ||
    !label.trim() ||
    label.length > 240
  )
    throw new ManagedStudioRejected("A diagram identity and bounded label are required.");
  const source = JSON.parse(content.content) as Record<string, unknown>;
  const rows = source[OBJECT_COLLECTIONS[content.kind]];
  if (!Array.isArray(rows)) throw new ManagedStudioRejected("The source has no object collection.");
  const matches = rows.filter((row) => row?.id === objectId);
  if (matches.length !== 1)
    throw new ManagedStudioRejected("The semantic target is missing or ambiguous.");
  matches[0].label = label;
  return journal.commitEdit({
    label: "Rename diagram object",
    kind: "source",
    files: { [content.path]: { before: content.content, after: JSON.stringify(source, null, 2) } },
  });
}

export function assertInspectorDocument(
  content: EditorDocumentContent,
  view: EditorProjectView,
  documentId: string,
): void {
  const doc = view.documents.find((item) => item.documentId === documentId);
  if (
    !doc ||
    content.projectId !== view.projectId ||
    content.revision !== view.revision ||
    content.revisionHash !== view.revisionHash ||
    content.documentId !== doc.documentId ||
    content.path !== doc.path ||
    content.kind !== doc.kind ||
    content.contentHash !== doc.contentHash
  )
    throw new ManagedStudioRejected(
      "The inspector source no longer matches its captured revision.",
    );
}
