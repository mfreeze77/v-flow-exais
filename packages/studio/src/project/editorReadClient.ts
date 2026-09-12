/** Revision-pinned reads for the retained Studio. A failed managed read never falls back to files. */
import {
  assertEditorDocumentContent,
  assertEditorProjectView,
  normalizeEditorPath,
  type EditorDocumentContent,
  type EditorProjectView,
} from "@hyperframes/project-model";

export type EditorFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type ProjectReadOwnership = "managed" | "native";
export interface ProjectReadOptions {
  optional?: boolean;
  signal?: AbortSignal;
}

export class EditorReadFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EditorReadFailure";
  }
}

function validProjectId(id: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id))
    throw new EditorReadFailure(
      "editor/invalid-project",
      "An explicit project identity is required.",
    );
}

async function checkedJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    let body: { code?: string; error?: string } = {};
    try {
      body = await response.json();
    } catch {
      /* HTTP status is still failure evidence. */
    }
    throw new EditorReadFailure(
      body.code ?? "editor/read-failed",
      body.error ?? `Editor read failed (${response.status}).`,
      response.status,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new EditorReadFailure(
      "editor/invalid-json",
      "Editor returned invalid JSON.",
      response.status,
    );
  }
}

async function contentDigest(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createManagedEditorReader(projectId: string, fetcher: EditorFetch = fetch) {
  validProjectId(projectId);
  const base = `/api/vflow/projects/${encodeURIComponent(projectId)}/editor`;
  async function view(signal?: AbortSignal): Promise<EditorProjectView> {
    signal?.throwIfAborted();
    const value = await checkedJson(await fetcher(base, { signal, cache: "no-store" }));
    signal?.throwIfAborted();
    assertEditorProjectView(value);
    if (value.projectId !== projectId)
      throw new EditorReadFailure(
        "editor/foreign-project",
        "Editor view belongs to another project.",
      );
    return value;
  }

  async function readDocument(
    path: string,
    options: ProjectReadOptions & { view?: EditorProjectView } = {},
  ): Promise<EditorDocumentContent | undefined> {
    options.signal?.throwIfAborted();
    const wanted = normalizeEditorPath(path);
    const captured = structuredClone(options.view ?? (await view(options.signal)));
    assertEditorProjectView(captured);
    if (captured.projectId !== projectId)
      throw new EditorReadFailure(
        "editor/foreign-project",
        "Read context belongs to another project.",
      );
    const document = captured.documents.find((d) => d.path === wanted);
    if (!document) {
      if (options.optional) return undefined;
      throw new EditorReadFailure(
        "editor/document-not-found",
        "No authoritative document has that path.",
        404,
      );
    }
    const query = new URLSearchParams({
      revision: String(captured.revision),
      revisionHash: captured.revisionHash,
    });
    const value = await checkedJson(
      await fetcher(`${base}/documents/${encodeURIComponent(document.documentId)}?${query}`, {
        signal: options.signal,
        cache: "no-store",
      }),
    );
    assertEditorDocumentContent(value);
    if (
      value.projectId !== projectId ||
      value.revision !== captured.revision ||
      value.revisionHash !== captured.revisionHash ||
      value.documentId !== document.documentId ||
      value.path !== document.path ||
      value.kind !== document.kind ||
      value.contentHash !== document.contentHash
    )
      throw new EditorReadFailure(
        "editor/mismatched-document",
        "Document response does not belong to the captured editor view.",
      );
    if ((await contentDigest(value.content)) !== value.contentHash)
      throw new EditorReadFailure(
        "editor/content-mismatch",
        "Authoring bytes do not match their recorded content hash.",
      );
    options.signal?.throwIfAborted();
    return value;
  }

  return { view, readDocument };
}

/** Preserve the native response format; managed reads adapt only the read side of that contract. */
export function createProjectReadClient(
  projectId: string,
  ownership: ProjectReadOwnership,
  fetcher: EditorFetch = fetch,
) {
  if (ownership !== "managed" && ownership !== "native")
    throw new EditorReadFailure(
      "editor/unknown-owner",
      "Project ownership must be resolved before reading.",
    );
  const managed = ownership === "managed" ? createManagedEditorReader(projectId, fetcher) : null;
  // Native reads keep the encoding the hooks already used:
  // `encodeURIComponent`, with the server owning validation. `buildProjectApiPath`
  // is stricter — it rejects any id that is not a single safe path segment — and
  // routing native reads through it changed an established contract twice over:
  // it threw during render while constructing this client, and then rejected a
  // delayed read that previously resolved. Tightening the client is a separate
  // decision from connecting managed reads, and the existing ownership tests
  // pin the current behaviour deliberately.
  const nativeBase = `/api/projects/${encodeURIComponent(projectId)}`;
  return {
    async fetchListing(signal?: AbortSignal): Promise<Response> {
      // Only pass an init when there is something to put in it. The hooks
      // previously called fetch(url) with no second argument, and an init of
      // `{ signal: undefined }` is a different call — which existing tests
      // assert on, because the argument shape is part of the contract.
      if (!managed) return signal ? fetcher(nativeBase, { signal }) : fetcher(nativeBase);
      const view = await managed.view(signal);
      return Response.json(
        {
          managed: true,
          revision: view.revision,
          revisionHash: view.revisionHash,
          dir: null,
          files: [...view.documents.map((d) => d.path), ...view.assets.map((a) => a.path)],
          compositions: view.documents.filter((d) => d.kind === "native").map((d) => d.path),
          editorView: view,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    },
    async fetchFile(path: string, options: ProjectReadOptions = {}): Promise<Response> {
      // Native projects keep their existing path contract, including editor sidecars.
      // The native file API owns its existing path validation; do not apply the
      // managed manifest's stricter authoring-path rules to that separate mode.
      if (!managed) {
        const url = `${nativeBase}/files/${encodeURIComponent(path)}${options.optional ? "?optional=1" : ""}`;
        return options.signal ? fetcher(url, { signal: options.signal }) : fetcher(url);
      }
      const result = await managed.readDocument(path, options);
      if (!result)
        return Response.json({ content: undefined }, { headers: { "Cache-Control": "no-store" } });
      // `version` describes the returned representation. Native HTML is exact;
      // diagram JSON is pretty-printed and the writer compares JSON values.
      return Response.json(
        { ...result, version: result.contentHash },
        {
          headers: { "Cache-Control": "no-store", ETag: `"${result.contentHash}"` },
        },
      );
    },
  };
}
