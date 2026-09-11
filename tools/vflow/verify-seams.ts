import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5190";
const intake = JSON.parse(readFileSync("evidence/tickets/AFM-099/browser/intake.json", "utf8"));
const results = [];
for (const proposal of intake.proposals) {
  const id = proposal.snapshot.manifest.id;
  const build = await (
    await fetch(`${base}/api/vflow/projects/${id}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  ).json();
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
      `/var/lib/vflow/projects/${id}/.vflow/builds/${build.hash}/ledger.json`,
      "--url",
      base,
      "--comp-url",
      url,
      "--json",
    ],
    {
      encoding: "utf8",
      timeout: 60000,
      env: { ...process.env, CHROME_PATH: "/workspace/tools/vflow/chrome-headless.sh" },
    },
  );
  const seams = JSON.parse(raw);
  assert.ok(seams.every((seam: any) => seam.rows.every((row: any) => row.status === "PASS")));
  results.push({ projectId: id, buildHash: build.hash, seams });
}
writeFileSync("evidence/tickets/AFM-099/seam-result.json", JSON.stringify(results, null, 2));
console.log(
  JSON.stringify({
    projects: results.length,
    checks: results.reduce(
      (sum, item) => sum + item.seams.reduce((n: number, seam: any) => n + seam.rows.length, 0),
      0,
    ),
    status: "passed",
  }),
);
