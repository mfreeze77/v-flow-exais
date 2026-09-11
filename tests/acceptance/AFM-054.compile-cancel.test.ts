import { it, expect } from "vitest";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createRenderJob,
  executeRenderJob,
} from "../../packages/producer/src/services/renderOrchestrator";
it("cancels the actual local render orchestration while a font request is pending", async () => {
  const dir = mkdtempSync(join(tmpdir(), "render-font-cancel-"));
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requested = false;
  try {
    writeFileSync(
      join(dir, "index.html"),
      '<!doctype html><html><head><style>body{font-family:"PendingFontForCancellation"}</style></head><body><div data-composition-id="root" data-width="1280" data-height="720" data-duration="1">Cancel before capture</div></body></html>',
    );
    globalThis.fetch = ((_: unknown, init?: RequestInit) => {
      requested = true;
      const pending = new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true }),
      );
      controller.abort(new Error("cancel pending compile"));
      return pending;
    }) as typeof fetch;
    const job = createRenderJob({
      fps: { num: 30, den: 1 },
      workers: 1,
      format: "mp4",
      quality: "standard",
    });
    await expect(
      executeRenderJob(job, dir, join(dir, "result.mp4"), undefined, controller.signal),
    ).rejects.toThrow();
    expect(requested).toBe(true);
    expect(existsSync(join(dir, "result.mp4"))).toBe(false);
    expect(job.status).toBe("cancelled");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true, force: true });
  }
}, 3000);
