import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
const home = process.env.VFLOW_DATA_HOME!;
assert.equal(home, "/tmp/vflow-story-review");
const service = new UnifiedProjectService({ home, sourceRoots: [] });
const api = async (path: string, body?: unknown) => {
  const response = await fetch(
    `http://127.0.0.1:5190/api/vflow${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  assert.ok(response.ok);
  return response.json();
};
assert.ok(
  (await api("/batches")).batches.every((batch: any) => batch.status !== "running"),
  "Finish the film proof before cancellation testing.",
);
const project = await service.importDiagram({
  schema_version: 1,
  diagram_type: "architecture",
  meta: { title: "Compile cancellation", viewBox: [900, 570], legend: { mode: "hidden" } },
  components: [
    {
      id: "entry",
      type: "backend",
      label: "Cancel before capture",
      pos: [60, 80],
      size: [280, 70],
    },
  ],
  connections: [],
  cards: [],
});
const before = service.get(project.id).snapshot;
let batch = await api("/batches", { projectIds: [project.id] });
const deadline = Date.now() + 10_000;
while (batch.items[0].progress < 5 && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  batch = await api(`/batches/${batch.id}`);
}
assert.equal(batch.items[0].status, "running");
const cancelAtProgress = batch.items[0].progress;
const started = Date.now();
await api(`/batches/${batch.id}/cancel`, {});
while (batch.status === "running" && Date.now() - started < 10_000) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  batch = await api(`/batches/${batch.id}`);
}
assert.equal(batch.status, "cancelled");
const persisted = JSON.parse(readFileSync(join(home, "batches", `${batch.id}.json`), "utf8"));
assert.equal(persisted.items[0].status, "cancelled");
assert.equal(existsSync(persisted.items[0].outputPath), false);
assert.deepEqual(service.get(project.id).snapshot, before);
const result = {
  batchId: batch.id,
  projectId: project.id,
  cancelAtProgress,
  elapsedMs: Date.now() - started,
  batchStatus: batch.status,
  noOutput: true,
  sourceUnchanged: true,
  at: new Date().toISOString(),
};
writeFileSync(
  "evidence/tickets/AFM-093/story-planning/cancellation.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
