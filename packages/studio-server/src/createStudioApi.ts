import { Hono } from "hono";
import { registerProjectCommandRoutes } from './routes/projectCommands';
import { installLocalApiPolicy } from './project/localApiPolicy';
import type { StudioApiAdapter } from "./types.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerStoryboardRoutes } from "./routes/storyboard.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerPreviewRoutes } from "./routes/preview.js";
import { registerLintRoutes } from "./routes/lint.js";
import { registerRenderRoutes } from "./routes/render.js";
import { registerThumbnailRoutes } from "./routes/thumbnail.js";
import { registerWaveformRoutes } from "./routes/waveform.js";
import { registerFontRoutes } from "./routes/fonts.js";
import { registerRegistryRoutes } from "./routes/registry.js";
import { registerSelectionRoutes } from "./routes/selection.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerGlobalAssetRoutes } from "./routes/globalAssets.js";

/**
 * Create a Hono sub-app with all studio API routes.
 *
 * Both the vite dev server and CLI embedded server mount this app
 * under /api, each providing their own adapter for host-specific behavior.
 */
export function createStudioApi(adapter: StudioApiAdapter): Hono {
  const api = new Hono();
  api.onError((error: any, c) => {
    if (!c.req.path.includes('/vflow/')) return c.json({ error: 'Internal server error' }, 500);
    const conflict = error?.code === 'project/revision-conflict' || error?.message?.includes('idempotency-conflict');
    return c.json({ error: error.message || 'Studio operation failed.', code: error.code || 'project/invalid', diagnostics: error.diagnostics || [], expected: error.expected, actual: error.actual }, conflict ? 409 : 400);
  });
  installLocalApiPolicy(api, adapter);
  registerProjectCommandRoutes(api, adapter);

  registerProjectRoutes(api, adapter);
  registerStoryboardRoutes(api, adapter);
  registerFileRoutes(api, adapter);
  registerPreviewRoutes(api, adapter);
  registerLintRoutes(api, adapter);
  registerRenderRoutes(api, adapter);
  registerThumbnailRoutes(api, adapter);
  registerSelectionRoutes(api, adapter);
  registerMediaRoutes(api, adapter);
  registerWaveformRoutes(api, adapter);
  registerFontRoutes(api);
  registerRegistryRoutes(api, adapter);
  registerGlobalAssetRoutes(api);

  return api;
}
