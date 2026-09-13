/**
 * Managed documents never enter native filesystem/preview handlers. Some GET
 * handlers stamp IDs or start generated work, so method alone is not a policy.
 * Registered before native routes; no monkey-patching fetch in the browser.
 */
import type { Hono, MiddlewareHandler } from "hono";
import { nativeManagedRequest } from "./managedNativeFencePolicy";
import { readCommittedProject } from "@hyperframes/project-model/revisions";
import type { UnifiedProjectService } from "./projectService";
import { projectEditorDocument, projectEditorView } from "./editorProjection";
import { normalizeEditorPath } from "@hyperframes/project-model";

export const MANAGED_STUDIO_PROTOCOL = "managed-studio-native-fence-v1";

export function installManagedNativeFence(api: Hono, service: UnifiedProjectService): void {
  // The capability handshake is installed by the same function as the fence.
  api.get("/vflow/projects/:id/editor/studio-access", (c) => {
    const current = readCommittedProject(service.root(c.req.param("id")));
    return c.json({
      protocol: MANAGED_STUDIO_PROTOCOL,
      projectId: current.snapshot.manifest.id,
      nativeRoutes: "blocked-except-authoring-reads",
      history: "project-journal",
    });
  });
  const guard: MiddlewareHandler = async (c, next) => {
    const id = c.req.param("id");
    if (!id || !service.has(id)) return next();
    // Validate the owned store even for blocked operations; corruption must not
    // fall through to another filesystem root with the same name.
    const current = readCommittedProject(service.root(id));
    const marker = `/projects/${encodeURIComponent(id)}`;
    const rawPath = new URL(c.req.url).pathname;
    const offset = rawPath.indexOf(marker);
    const suffix = offset < 0 ? "" : rawPath.slice(offset + marker.length);
    c.header("Cache-Control", "no-store");
    if (nativeManagedRequest(c.req.method, suffix) !== "read-document")
      return c.json(
        {
          code: "editor/native-route-blocked",
          error:
            "Managed authoring uses project commands and pinned previews. This native operation is not enabled.",
        },
        409,
      );
    let path: string;
    try {
      path = normalizeEditorPath(decodeURIComponent(suffix.slice("/files/".length)));
    } catch {
      return c.json({ code: "editor/invalid-path", error: "Invalid authoring reference." }, 400);
    }
    const view = projectEditorView(current);
    const doc = view.documents.find((item) => item.path === path);
    if (!doc) {
      if (c.req.query("optional") === "1") return c.json({});
      return c.json(
        { code: "editor/document-not-found", error: "No authoritative document has this path." },
        404,
      );
    }
    const value = projectEditorDocument(current, view, doc.documentId);
    c.header("ETag", `"${value.contentHash}"`);
    return c.json({ ...value, version: value.contentHash });
  };
  api.use("/projects/:id", guard);
  api.use("/projects/:id/*", guard);
}
