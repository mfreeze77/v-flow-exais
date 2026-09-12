/** AFM-059/060: committed-document reads for the retained Studio. No mutation routes. */
import type { Hono } from "hono";
import { readCommittedProject } from "@hyperframes/project-model/revisions";
import type { UnifiedProjectService } from "../project/projectService";
import { readProjectAssetBytes } from "../project/projectAssets";
import {
  EditorReadError,
  assertEditorReadMatches,
  editorRevisionFromQuery,
  projectEditorDocument,
  projectEditorView,
} from "../project/editorProjection";

function knownFailure(error: unknown): Response {
  if (!(error instanceof EditorReadError)) throw error;
  return Response.json(
    { code: error.code, error: error.message },
    {
      status: error.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function registerProjectEditorRoutes(api: Hono, service: UnifiedProjectService): void {
  api.get("/vflow/projects/:id/editor", (c) => {
    const current = readCommittedProject(service.root(c.req.param("id")));
    c.header("Cache-Control", "no-store");
    c.header("X-VFlow-Revision", String(current.pointer.revision));
    return c.json(projectEditorView(current));
  });

  api.get("/vflow/projects/:id/editor/documents/:documentId", (c) => {
    try {
      const id = c.req.param("id");
      const expected = editorRevisionFromQuery(
        id,
        c.req.query("revision"),
        c.req.query("revisionHash"),
      );
      const current = readCommittedProject(service.root(id));
      const result = projectEditorDocument(current, expected, c.req.param("documentId"));
      c.header("Cache-Control", "no-store");
      c.header("ETag", `"${result.contentHash}"`);
      return c.json(result);
    } catch (error) {
      return knownFailure(error);
    }
  });

  api.get("/vflow/projects/:id/editor/assets/:assetId", (c) => {
    try {
      const id = c.req.param("id");
      const expected = editorRevisionFromQuery(
        id,
        c.req.query("revision"),
        c.req.query("revisionHash"),
      );
      const root = service.root(id);
      const current = readCommittedProject(root);
      assertEditorReadMatches(current, expected);
      const asset = current.snapshot.manifest.assets?.find((a) => a.id === c.req.param("assetId"));
      if (!asset)
        throw new EditorReadError(404, "editor/asset-not-found", "No committed asset has that ID.");
      // The owned store validates path, metadata, byte length and content digest.
      const bytes = readProjectAssetBytes(root, asset);
      return new Response(Uint8Array.from(bytes), {
        headers: {
          "Content-Type": asset.mediaType,
          "Content-Length": String(bytes.length),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
          ETag: `"${asset.sha256}"`,
        },
      });
    } catch (error) {
      return knownFailure(error);
    }
  });
}
