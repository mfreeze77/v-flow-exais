import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "@hyperframes/project-model/revisions";
import type { StudioApiAdapter, RenderJobState } from "../types";
import { atomicJson, verifyBuild, type PinnedBuild } from "./projectBuild";
import type { UnifiedProjectService } from "./projectService";
import { batchIsOwned, ownBatch } from "./batchLock";
import { assertContainedPath } from "@hyperframes/project-model/revisions";

export interface BatchItem {
  projectId: string;
  status: "queued" | "running" | "complete" | "failed" | "cancelled";
  progress: number;
  build?: PinnedBuild;
  attemptId?: string;
  outputPath?: string;
  sha256?: string;
  probe?: any;
  error?: string;
  reused?: boolean;
}
export interface ProjectBatch {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  status: "running" | "complete" | "partial" | "failed" | "cancelled" | "interrupted";
  items: BatchItem[];
}

export function probeVideo(path: string, build: PinnedBuild) {
  if (!existsSync(path) || statSync(path).size < 1000)
    throw new Error("Producer did not create a video file.");
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
      { encoding: "utf8", timeout: 60_000, maxBuffer: 2_000_000 },
    ),
  );
  const video = probe.streams.find((stream: any) => stream.codec_type === "video");
  const output = build.receipt.output;
  const expectedDuration =
    (build.receipt.durationFrames * output.fps.denominator) / output.fps.numerator;
  const [num = 0, den = 1] = String(video?.avg_frame_rate || "0/1")
    .split("/")
    .map(Number);
  if (
    !video ||
    video.width !== output.width ||
    video.height !== output.height ||
    !["h264", "hevc"].includes(video.codec_name) ||
    Math.abs(num / den - output.fps.numerator / output.fps.denominator) > 1e-7 ||
    Math.abs(Number(video.duration ?? probe.format.duration) - expectedDuration) >
      output.fps.denominator / output.fps.numerator + 0.002 ||
    Number(video.nb_read_frames) !== build.receipt.durationFrames
  )
    throw new Error("Rendered video properties do not match the pinned build.");
  return {
    codec: video.codec_name,
    width: video.width,
    height: video.height,
    fps: video.avg_frame_rate,
    duration: Number(video.duration ?? probe.format.duration),
    frames: Number(video.nb_read_frames),
    bytes: statSync(path).size,
  };
}

/** Durable batch aggregation over the same adapter/producer render job API. */
export class ProjectBatchService {
  private active = new Map<
    string,
    { record: ProjectBatch; cancelled: boolean; job?: RenderJobState }
  >();
  private tail: Promise<void> = Promise.resolve();
  constructor(
    readonly projects: UnifiedProjectService,
    readonly adapter: Pick<StudioApiAdapter, "startRender">,
  ) {}
  private path(id: string) {
    if (!/^batch-[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid batch ID.");
    return join(this.projects.batchesDir, `${id}.json`);
  }
  private save(record: ProjectBatch) {
    atomicJson(this.path(record.id), record);
  }
  get(id: string): ProjectBatch {
    const active = this.active.get(id);
    if (active) return structuredClone(active.record);
    const record = JSON.parse(readFileSync(this.path(id), "utf8")) as ProjectBatch;
    if (record.status === "running" && !batchIsOwned(`${this.path(id)}.lock`))
      record.status = "interrupted";
    return record;
  }
  list() {
    return readdirSync(this.projects.batchesDir)
      .filter((name) => /^batch-[0-9a-f-]{36}\.json$/.test(name))
      .map((name) => this.get(name.slice(0, -5)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async start(ids: string[]) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 12 || new Set(ids).size !== ids.length)
      throw new Error("Select one to twelve different projects.");
    const record: ProjectBatch = {
      schemaVersion: 1,
      id: `batch-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      status: "running",
      items: [],
    };
    // Freeze every project before scheduling; edits after this point cannot alter the batch.
    for (const projectId of ids) {
      try {
        record.items.push({
          projectId,
          status: "queued",
          progress: 0,
          build: await this.projects.build(projectId),
        });
      } catch (error) {
        record.items.push({
          projectId,
          status: "failed",
          progress: 0,
          error: error instanceof Error ? error.message : "Build failed.",
        });
      }
    }
    const release = await ownBatch(`${this.path(record.id)}.lock`);
    this.save(record);
    this.enqueue(record, release);
    return structuredClone(record);
  }
  async resume(id: string) {
    if (this.active.has(id)) return this.get(id);
    const release = await ownBatch(`${this.path(id)}.lock`);
    try {
      const record = this.get(id);
      for (const item of record.items)
        if (item.status !== "complete") {
          item.status = "queued";
          item.progress = 0;
          delete item.error;
        }
      rmSync(`${this.path(id)}.cancel`, { force: true });
      record.status = "running";
      this.save(record);
      this.enqueue(record, release);
      return structuredClone(record);
    } catch (error) {
      release();
      throw error;
    }
  }
  cancel(id: string) {
    const active = this.active.get(id);
    if (active) {
      active.cancelled = true;
      active.job?.cancel?.();
      return this.get(id);
    }
    const record = this.get(id);
    if (record.status === "running") atomicJson(`${this.path(id)}.cancel`, { cancelled: true });
    return record;
  }
  private enqueue(record: ProjectBatch, release: () => void) {
    const state = { record, cancelled: false, job: undefined as RenderJobState | undefined };
    this.active.set(record.id, state);
    // This service queues batches; kernel locks prevent duplicate cross-session work.
    this.tail = this.tail
      .then(async () => {
        // Let the API flush the durable batch receipt before producer setup can
        // perform synchronous compilation work on this event loop.
        await new Promise<void>((resolve) => setImmediate(resolve));
        try {
          for (const item of record.items) {
            state.cancelled ||= existsSync(`${this.path(record.id)}.cancel`);
            if (item.status === "complete" || item.status === "failed") continue;
            if (state.cancelled) {
              item.status = "cancelled";
              continue;
            }
            try {
              if (!item.build)
                throw new Error(
                  "This item has no valid pinned build. Repair the source and start a new batch.",
                );
              verifyBuild(item.build);
              const renderDir = join(
                this.projects.root(item.projectId),
                ".vflow/renders",
                item.build.hash,
              );
              mkdirSync(renderDir, { recursive: true });
              const cachedPath = join(renderDir, "success.json");
              if (existsSync(cachedPath)) {
                const cached = JSON.parse(readFileSync(cachedPath, "utf8"));
                assertContainedPath(renderDir, cached.outputPath);
                if (
                  cached.buildHash === item.build.hash &&
                  existsSync(cached.outputPath) &&
                  sha256(readFileSync(cached.outputPath)) === cached.sha256
                ) {
                  const probe = probeVideo(cached.outputPath, item.build);
                  Object.assign(item, {
                    status: "complete",
                    progress: 100,
                    outputPath: cached.outputPath,
                    sha256: cached.sha256,
                    probe,
                    reused: true,
                  });
                  this.save(record);
                  continue;
                }
              }
              item.attemptId = randomUUID();
              item.outputPath = join(renderDir, `${item.attemptId}.mp4`);
              item.status = "running";
              item.progress = 0;
              this.save(record);
              const fps = item.build.receipt.output.fps;
              const job = this.adapter.startRender({
                project: { id: item.projectId, dir: item.build.dir },
                outputPath: item.outputPath,
                format: "mp4",
                fps: { num: fps.numerator, den: fps.denominator },
                quality: "standard",
                workers: 1,
                jobId: `${record.id}-${item.attemptId}`,
                telemetryOptOut: true,
              });
              state.job = job;
              while (job.status === "rendering") {
                item.progress = Math.min(98, job.progress);
                this.save(record);
                await new Promise((resolve) => setTimeout(resolve, 750));
                state.cancelled ||= existsSync(`${this.path(record.id)}.cancel`);
                if (state.cancelled) job.cancel?.();
              }
              if (state.cancelled || job.status === "cancelled") {
                item.status = "cancelled";
                continue;
              }
              if (job.status !== "complete")
                throw new Error(job.error || "Producer render failed.");
              verifyBuild(item.build);
              item.probe = probeVideo(item.outputPath, item.build);
              item.sha256 = sha256(readFileSync(item.outputPath));
              atomicJson(cachedPath, {
                buildHash: item.build.hash,
                outputPath: item.outputPath,
                sha256: item.sha256,
                probe: item.probe,
                attemptId: item.attemptId,
              });
              item.progress = 100;
              item.status = "complete";
            } catch (error) {
              item.status = "failed";
              item.error = error instanceof Error ? error.message : "Render failed.";
            } finally {
              state.job = undefined;
              this.save(record);
            }
          }
          const completed = record.items.filter((item) => item.status === "complete").length;
          record.status = state.cancelled
            ? "cancelled"
            : completed === record.items.length
              ? "complete"
              : completed
                ? "partial"
                : "failed";
          this.save(record);
        } finally {
          this.active.delete(record.id);
          release();
        }
      })
      .catch((error) => {
        record.status = "failed";
        this.save(record);
        this.active.delete(record.id);
        console.error("[V-Flow batch]", error);
      });
  }
}
