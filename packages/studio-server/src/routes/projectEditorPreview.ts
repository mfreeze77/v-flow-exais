import { ensureHfIds } from "@hyperframes/parsers/hf-ids";
/** Explicit preview preparation; all subsequent reads address an immutable build. */
import type { Hono } from "hono";
import {
  assertEditorRevision,
  EditorPreviewError,
  type EditorRevision,
} from "@hyperframes/project-model";
import { buildCommittedProject, verifyBuild } from "../project/projectBuild";
import {
  readPinnedEditorPreview,
  readPinnedPreviewFile,
  previewAssetPath,
} from "../project/pinnedEditorPreview";
import { decorateEditorPreview } from "../project/editorPreviewHtml";
import { buildSubCompositionHtml } from "../helpers/subComposition";
import type { StudioApiAdapter } from "../types";

const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'none'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function fail(error: unknown): Response {
  if (error instanceof EditorPreviewError)
    return Response.json(
      { code: error.code, error: error.message },
      { status: error.status, headers: noStore },
    );
  throw error;
}

function requestedRevision(id: string, body: unknown): EditorRevision {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 3 ||
    Object.keys(body).some((k) => !["projectId", "revision", "revisionHash"].includes(k))
  )
    throw new EditorPreviewError(
      "editor/invalid-preview-request",
      "A captured editor revision is required.",
    );
  try {
    assertEditorRevision(body);
  } catch {
    throw new EditorPreviewError(
      "editor/invalid-preview-request",
      "A captured editor revision is required.",
    );
  }
  if (body.projectId !== id)
    throw new EditorPreviewError(
      "editor/foreign-project",
      "Preview request targets another project.",
    );
  return body;
}

export function registerProjectEditorPreviewRoutes(api: Hono, adapter: StudioApiAdapter): void {
  const service = adapter.projectService;
  if (!service) return;
  const route = "/vflow/projects/:id/editor/previews";

  api.post(route, async (c) => {
    try {
      const id = c.req.param("id");
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        throw new EditorPreviewError(
          "editor/invalid-preview-request",
          "Preview request must be valid JSON.",
        );
      }
      const expected = requestedRevision(id, body);
      // A revision committed before capture is rejected. One committed during compilation
      // cannot substitute its bytes: buildCommittedProject compiled the captured snapshot.
      const root = service.root(id);
      const build = await buildCommittedProject(root, expected);
      const pinned = readPinnedEditorPreview(root, id, build.hash);
      return Response.json(pinned.session, { headers: noStore });
    } catch (error) {
      return fail(error);
    }
  });

  api.get(`${route}/:buildHash/view`, async (c) => {
    try {
      const id = c.req.param("id");
      const pinned = readPinnedEditorPreview(service.root(id), id, c.req.param("buildHash"));
      const requested = c.req.query("sceneId");
      const scene =
        requested === undefined
          ? undefined
          : pinned.session.scenes.find((s) => s.sceneId === requested);
      if (requested !== undefined && !scene)
        throw new EditorPreviewError(
          "editor/scene-not-found",
          "Scene is absent from this pinned build.",
          404,
        );
      verifyBuild(pinned);
      let html = scene
        ? buildSubCompositionHtml(
            pinned.dir,
            scene.outputPath,
            adapter.runtimeUrl,
            undefined,
            scene.kind === "native"
              ? ensureHfIds(readPinnedPreviewFile(pinned, scene.outputPath).toString("utf8"))
              : undefined,
          )
        : await adapter.bundle(pinned.dir);
      if (!html)
        throw new EditorPreviewError(
          "editor/preview-unavailable",
          "The retained compiler could not prepare the preview.",
          409,
        );
      if (adapter.transformPreviewHtml)
        html = await adapter.transformPreviewHtml({
          html,
          project: { id, dir: pinned.dir },
          activeCompositionPath: scene?.outputPath ?? "index.html",
        });
      // Verify again across the asynchronous compiler boundary. Derived native IDs were stamped in memory only; no source or build file is written.
      verifyBuild(pinned);
      return new Response(decorateEditorPreview(html, pinned.session, scene), {
        headers: {
          ...noStore,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": CSP,
          "X-VFlow-Build": pinned.hash,
          "X-VFlow-Revision": String(pinned.revision),
          "X-VFlow-Revision-Hash": pinned.session.revisionHash,
        },
      });
    } catch (error) {
      return fail(error);
    }
  });

  api.get(`${route}/:buildHash/assets/:name`, (c) => {
    try {
      const id = c.req.param("id");
      const pinned = readPinnedEditorPreview(service.root(id), id, c.req.param("buildHash"));
      const asset = previewAssetPath(c.req.param("name"));
      const bytes = readPinnedPreviewFile(pinned, asset.path);
      return new Response(Uint8Array.from(bytes), {
        headers: {
          ...noStore,
          "Content-Type": asset.mime,
          "Content-Length": String(bytes.length),
          ETag: `"${pinned.fileHashes[asset.path]}"`,
        },
      });
    } catch (error) {
      return fail(error);
    }
  });
}
