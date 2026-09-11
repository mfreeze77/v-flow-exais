import { readFileSync, copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
const home = process.env.VFLOW_DATA_HOME!;
assert.equal(home, "/tmp/vflow-story-review");
const batchId = process.argv[2]!;
assert.match(batchId, /^batch-[a-f0-9-]{36}$/);
const output = "out/story-planning";
const evidence = "evidence/tickets/AFM-093/story-planning";
const intake = JSON.parse(readFileSync(`${output}/intake.json`, "utf8"));
const projects = JSON.parse(readFileSync(`${output}/projects.json`, "utf8"));
const path = join(home, "batches", `${batchId}.json`);
let batch = JSON.parse(readFileSync(path, "utf8"));
assert.deepEqual(
  batch.items.map((item: any) => item.projectId),
  projects.map((item: any) => item.id),
);
const deadline = Date.now() + 20 * 60_000;
let previous = "";
while (batch.status === "running" && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  batch = JSON.parse(readFileSync(path, "utf8"));
  const status = batch.items
    .map((item: any) => `${item.status}:${Math.floor(item.progress / 20) * 20}`)
    .join(",");
  if (status !== previous) {
    console.log(status);
    previous = status;
  }
}
assert.equal(batch.status, "complete", JSON.stringify(batch.items));
const service = new UnifiedProjectService({ home, sourceRoots: [] });
for (const [index, item] of batch.items.entries()) {
  copyFileSync(item.outputPath, `${output}/story-${index}.mp4`);
  const snapshot = service.get(item.projectId).snapshot;
  item.frames = [];
  for (const [beatIndex, scene] of snapshot.manifest.scenes.entries()) {
    const at = (scene.startFrame + scene.durationFrames * 0.75) / 30;
    const frame = `${evidence}/film-${index}-beat-${beatIndex}.png`;
    execFileSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        String(at),
        "-i",
        item.outputPath,
        "-frames:v",
        "1",
        frame,
      ],
      { timeout: 60_000 },
    );
    item.frames.push({ at, path: frame });
  }
  item.retainedVideo = `${output}/story-${index}.mp4`;
}
writeFileSync(
  `${evidence}/result.json`,
  JSON.stringify(
    {
      intakeId: intake.id,
      snapshotHash: intake.facts.snapshotHash,
      options: intake.planning.options,
      plans: intake.proposals.map((plan: any) => ({
        id: plan.id,
        planHash: plan.planHash,
        title: plan.title,
        family: plan.story.family,
        beats: plan.story.beats,
      })),
      batch,
      providerEvidence:
        "Offline evidence-driven draft planning and Studio script revision. No model call or human film acceptance is claimed.",
      recovery:
        "Collected the same persisted batch after its initial HTTP connection closed; did not repeat the batch POST.",
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    id: batch.id,
    videos: batch.items.map((item: any) => ({ path: item.retainedVideo, probe: item.probe })),
  }),
);
