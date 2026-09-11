import type { Hono } from "hono";
import type { UnifiedProjectService } from "../project/projectService";

export function registerProjectProposalRoutes(api: Hono, service: UnifiedProjectService) {
  const proposals = service.proposals;
  api.get("/vflow/proposal-provider", (c) => c.json(proposals.providerStatus()));
  api.get("/vflow/projects/:id/proposal-context", (c) =>
    c.json(proposals.context(c.req.param("id"), c.req.query("intakeId") || "")),
  );
  api.get("/vflow/projects/:id/proposals", (c) =>
    c.json({ proposals: proposals.list(c.req.param("id")) }),
  );
  api.post("/vflow/projects/:id/proposals", async (c) => {
    const body = await c.req.json();
    if (body?.projectId !== c.req.param("id"))
      return c.json(
        { error: "Proposal targets a different project.", code: "proposal/wrong-project" },
        400,
      );
    return c.json(await proposals.create(body));
  });
  api.post("/vflow/projects/:id/proposals/generate", async (c) => {
    const body = await c.req.json();
    return c.json(await proposals.generate(c.req.param("id"), body.intakeId, body.brief));
  });
  api.get("/vflow/projects/:id/proposals/:proposalId", async (c) =>
    c.json(await proposals.get(c.req.param("id"), c.req.param("proposalId"))),
  );
  api.post("/vflow/projects/:id/proposals/:proposalId/revise", async (c) => {
    const body = await c.req.json();
    return c.json(
      await proposals.revise(
        c.req.param("id"),
        c.req.param("proposalId"),
        body.version,
        body.contentHash,
        body.proposal,
      ),
    );
  });
  api.post("/vflow/projects/:id/proposals/:proposalId/reject", async (c) => {
    const body = await c.req.json();
    return c.json(
      await proposals.reject(
        c.req.param("id"),
        c.req.param("proposalId"),
        body.version,
        body.contentHash,
      ),
    );
  });
  api.post("/vflow/projects/:id/proposals/:proposalId/accept", async (c) => {
    const body = await c.req.json();
    return c.json(
      await proposals.accept(
        c.req.param("id"),
        c.req.param("proposalId"),
        body.version,
        body.contentHash,
        body.acknowledgedClaimIds,
      ),
    );
  });
}
