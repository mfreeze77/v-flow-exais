import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5190";
const home = process.env.VFLOW_DATA_HOME!;
assert.equal(home, "/tmp/vflow-story-review");
const projects = JSON.parse(readFileSync("out/story-planning/projects.json", "utf8"));
const results = [];
for (const project of projects) {
  const id = project.id;
  const response = await fetch(`${base}/api/vflow/projects/${id}/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.ok(response.ok);
  const build = await response.json();
  const url = `${base}/api/vflow/projects/${id}/preview`;
  const preview = await fetch(url);
  assert.equal(preview.headers.get("X-VFlow-Build"), build.hash);
  await preview.arrayBuffer();
  const raw = execFileSync(
    "node",
    [
      ".agents/skills/motion-doctrine/scripts/seam-gate.mjs",
      "verify",
      "--ledger",
      join(home, "projects", id, ".vflow/builds", build.hash, "ledger.json"),
      "--url",
      base,
      "--comp-url",
      url,
      "--json",
    ],
    {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, CHROME_PATH: "/workspace/tools/vflow/chrome-headless.sh" },
    },
  );
  const seams = JSON.parse(raw);
  results.push({ projectId: id, buildHash: build.hash, seams });
  writeFileSync(
    "evidence/tickets/AFM-093/story-planning/seams.json",
    JSON.stringify(results, null, 2),
  );
  assert.ok(
    seams.every((seam: any) => seam.rows.every((row: any) => row.status === "PASS")),
    raw,
  );
}
console.log(
  JSON.stringify({
    projects: results.length,
    checks: results.reduce(
      (sum, item) =>
        sum + item.seams.reduce((count: number, seam: any) => count + seam.rows.length, 0),
      0,
    ),
    status: "passed",
  }),
);
