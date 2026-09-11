import type { Hono } from "hono";
import type { StudioApiAdapter } from "../types";

export function installLocalApiPolicy(api: Hono, adapter: StudioApiAdapter) {
  api.use("*", async (c, next) => {
    const requestUrl = new URL(c.req.url);
    const host = requestUrl.hostname;
    const allowed = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (!allowed)
      return c.json({ error: "The local Studio API only accepts loopback hosts." }, 403);
    const origin = c.req.header("Origin");
    if (origin && origin !== requestUrl.origin)
      return c.json({ error: "Cross-origin access to the local Studio API is blocked." }, 403);
    if (c.req.header("Sec-Fetch-Site") === "cross-site")
      return c.json({ error: "Cross-site access is blocked." }, 403);
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      const length = Number(c.req.header("Content-Length") || 0);
      if (!Number.isFinite(length) || length > 4_000_000)
        return c.json({ error: "Request exceeds the project command limit." }, 413);
      const match = c.req.path.match(/\/projects\/([^/]+)/);
      const legacy = !c.req.path.includes("/vflow/");
      if (
        legacy &&
        match &&
        adapter.projectService?.has(decodeURIComponent(match[1]!)) &&
        !/\/render$/.test(c.req.path)
      ) {
        return c.json(
          {
            code: "project/managed-output",
            error:
              "This project is managed. Edit diagram source or scene presentation through the project command endpoint.",
          },
          409,
        );
      }
    }
    await next();
  });
}
