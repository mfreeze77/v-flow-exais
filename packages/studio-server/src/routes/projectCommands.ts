import type { Hono } from "hono";
import { readFileSync } from "node:fs";
import { assertContainedPath, sha256 } from "@hyperframes/project-model/revisions";
import { ProjectBatchService, type ProjectBatch } from "../project/projectBatch";
import { verifyBuild } from "../project/projectBuild";
import type { StudioApiAdapter } from "../types";
import { registerProjectProposalRoutes } from "./projectProposals";
import { projectApiError } from "../project/projectApiError";

function publicBatch(record: ProjectBatch) {
  return {
    ...record,
    items: record.items.map(({ build, outputPath: _outputPath, ...item }) => ({
      ...item,
      build: build
        ? { hash: build.hash, revision: build.revision, receipt: build.receipt }
        : undefined,
      downloadUrl:
        item.status === "complete"
          ? `/api/vflow/batches/${record.id}/outputs/${item.projectId}`
          : undefined,
    })),
  };
}

export function registerProjectCommandRoutes(api: Hono, adapter: StudioApiAdapter) {
  const service = adapter.projectService;
  if (!service) return;
  const batches = new ProjectBatchService(service, adapter);
  const previews = new Map<string, string>();
  api.use("/vflow/*", async (c, next) => {
    try {
      await next();
    } catch (error: any) {
      const result = projectApiError(error);
      return c.json(result.body, result.status);
    }
  });
  registerProjectProposalRoutes(api, service);
  api.get("/vflow/sources", (c) => c.json({ roots: service.roots() }));
  api.get("/vflow/projects", (c) => c.json({ projects: service.list() }));
  api.post("/vflow/intakes", async (c) => c.json(await service.intake(await c.req.json())));
  api.get("/vflow/intakes/:id", (c) => c.json(service.readIntake(c.req.param("id"))));
  api.post("/vflow/intakes/:id/accept", async (c) => {
    const body = await c.req.json();
    return c.json({ projects: await service.acceptIntake(c.req.param("id"), body.selected) });
  });
  api.post("/vflow/import-diagram", async (c) =>
    c.json(await service.importDiagram(await c.req.json())),
  );
  api.get("/vflow/projects/:id", (c) => c.json(service.get(c.req.param("id"))));
  api.post("/vflow/projects/:id/commands", async (c) =>
    c.json(await service.command(c.req.param("id"), await c.req.json())),
  );
  api.post("/vflow/projects/:id/build", async (c) => {
    const build = await service.build(c.req.param("id"));
    return c.json({ hash: build.hash, revision: build.revision, receipt: build.receipt });
  });
  api.get("/vflow/projects/:id/preview", async (c) => {
    const build = await service.build(c.req.param("id"));
    verifyBuild(build);
    let html = previews.get(build.hash);
    if (!html) {
      html = (await adapter.bundle(build.dir)) || undefined;
      if (!html) throw new Error("The retained composition compiler could not build this preview.");
      if (adapter.transformPreviewHtml)
        html = await adapter.transformPreviewHtml({
          html,
          project: { id: build.projectId, dir: build.dir },
          activeCompositionPath: "index.html",
        });
      previews.set(build.hash, html);
      if (previews.size > 12) previews.delete(previews.keys().next().value!);
    }
    c.header("X-VFlow-Build", build.hash);
    c.header("Cache-Control", "no-store");
    // Generated native/diagram content is offline. The owned runtime remains same-origin.
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'none'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
    );
    return c.html(html);
  });
  api.post("/vflow/batches", async (c) =>
    c.json(publicBatch(await batches.start((await c.req.json()).projectIds))),
  );
  api.get("/vflow/batches", (c) => c.json({ batches: batches.list().map(publicBatch) }));
  api.get("/vflow/batches/:id", (c) => c.json(publicBatch(batches.get(c.req.param("id")))));
  api.post("/vflow/batches/:id/cancel", (c) =>
    c.json(publicBatch(batches.cancel(c.req.param("id")))),
  );
  api.post("/vflow/batches/:id/resume", async (c) =>
    c.json(publicBatch(await batches.resume(c.req.param("id")))),
  );
  api.get("/vflow/batches/:id/outputs/:projectId", (c) => {
    const item = batches
      .get(c.req.param("id"))
      .items.find((row) => row.projectId === c.req.param("projectId"));
    if (!item || item.status !== "complete" || !item.outputPath)
      return c.json({ error: "Verified output is unavailable." }, 404);
    assertContainedPath(service.root(item.projectId), item.outputPath);
    const bytes = readFileSync(item.outputPath);
    if (sha256(bytes) !== item.sha256)
      throw new Error("Output no longer matches its verified hash.");
    c.header("Content-Type", "video/mp4");
    c.header("Content-Disposition", `attachment; filename="${item.projectId}.mp4"`);
    return c.body(bytes);
  });
}
