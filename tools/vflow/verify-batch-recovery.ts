import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import {
  UnifiedProjectService,
  ProjectBatchService,
  type RenderJobState,
} from "../../packages/studio-server/src/index";
import { initializeProject } from "../../packages/project-model/src/storage/commit";
import { createRenderJob, executeRenderJob } from "../../packages/producer/src/index";
const home = mkdtempSync(join(tmpdir(), "vflow-real-recovery-"));
const service = new UnifiedProjectService({ home, sourceRoots: [] });
const live = new UnifiedProjectService({ home: "/var/lib/vflow", sourceRoots: [] });
const template = live.get("video-88f11d4b-82a5-403f-8104-ced44c57c1c8").snapshot;
const jobs: RenderJobState[] = [];
const adapter = {
  startRender(options: any) {
    const abort = new AbortController();
    const state: RenderJobState = {
      id: options.jobId,
      status: "rendering",
      progress: 0,
      outputPath: options.outputPath,
      cancel: () => abort.abort(),
    };
    jobs.push(state);
    void (async () => {
      try {
        const job = createRenderJob({
          fps: options.fps,
          format: "mp4",
          quality: "standard",
          workers: 1,
        });
        await executeRenderJob(
          job,
          options.project.dir,
          options.outputPath,
          (event) => {
            state.progress = event.progress;
            state.stage = event.currentStage;
          },
          abort.signal,
        );
        state.status = abort.signal.aborted ? "cancelled" : "complete";
      } catch (error) {
        state.status = abort.signal.aborted ? "cancelled" : "failed";
        state.error = String(error);
      }
    })();
    return state;
  },
};
const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
try {
  for (const id of ["good-one", "good-two", "invalid-diagram"]) {
    const snapshot = structuredClone(template);
    snapshot.manifest.id = id;
    snapshot.manifest.revision = 0;
    snapshot.manifest.output.fps = { numerator: 30000, denominator: 1001 };
    snapshot.manifest.documents = snapshot.manifest.documents.slice(0, 2);
    snapshot.manifest.scenes = snapshot.manifest.scenes.slice(0, 2);
    snapshot.manifest.scenes[1]!.durationFrames = 90;
    snapshot.sources = Object.fromEntries(
      snapshot.manifest.documents.map((doc) => [doc.id, snapshot.sources[doc.id]!]),
    );
    if (id === "invalid-diagram") delete (snapshot.sources["diagram-0"] as any).components[0].pos;
    const root = join(service.projectsDir, id);
    mkdirSync(root);
    await initializeProject(root, snapshot);
  }
  const first = new ProjectBatchService(service, adapter);
  const started = await first.start(["good-one", "good-two", "invalid-diagram"]);
  const deadline = Date.now() + 300000;
  while (
    !(first.get(started.id).items[0]!.status === "complete" && jobs[1]?.progress > 5) &&
    Date.now() < deadline
  )
    await pause();
  assert.equal(first.get(started.id).items[0]!.status, "complete");
  const completeHash = first.get(started.id).items[0]!.sha256;
  first.cancel(started.id);
  while (first.get(started.id).status === "running" && Date.now() < deadline) await pause();
  const cancelled = first.get(started.id);
  assert.equal(cancelled.status, "cancelled");
  await new Promise((resolve) => setTimeout(resolve, 150));
  const next = new ProjectBatchService(service, adapter);
  await next.resume(started.id);
  while (next.get(started.id).status === "running" && Date.now() < deadline) await pause();
  const finished = next.get(started.id);
  assert.equal(finished.status, "partial");
  assert.deepEqual(
    finished.items.map((item) => item.status),
    ["complete", "complete", "failed"],
  );
  assert.equal(finished.items[0]!.sha256, completeHash);
  assert.equal(finished.items[0]!.attemptId, cancelled.items[0]!.attemptId);
  assert.notEqual(finished.items[1]!.attemptId, cancelled.items[1]!.attemptId);
  assert.equal(finished.items[1]!.probe.fps, "30000/1001");
  assert.equal(finished.items[1]!.probe.frames, 165);
  const repeated = await next.start(["good-one", "good-two"]);
  while (next.get(repeated.id).status === "running" && Date.now() < deadline) await pause();
  const reused = next.get(repeated.id);
  assert.equal(reused.status, "complete");
  assert.ok(reused.items.every((item) => item.reused));
  copyFileSync(finished.items[1]!.outputPath!, "evidence/tickets/AFM-099/recovery-fractional.mp4");
  writeFileSync(
    "evidence/tickets/AFM-099/recovery-result.json",
    JSON.stringify({ cancelled, finished, reused }, null, 2),
  );
  console.log(
    JSON.stringify({
      checks: [
        "real producer cancellation",
        "new service resumes matching build",
        "completed output preserved",
        "partial failure isolated",
        "unchanged outputs reused",
        "fractional FPS media probe",
      ],
      probe: finished.items[1]!.probe,
    }),
  );
} finally {
  rmSync(home, { recursive: true, force: true });
}
