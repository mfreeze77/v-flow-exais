import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
const home = mkdtempSync("/tmp/vflow-story-cli-");
const records: unknown[] = [];
function command(action: string, args: string[] = [], expected = 0) {
  const argv = ["packages/cli/src/cli.ts", "project", action, "--home", home, ...args];
  const run = spawnSync("bun", argv, { encoding: "utf8", timeout: 60_000, maxBuffer: 8_000_000 });
  records.push({ command: ["bun", ...argv], exitCode: run.status, stderr: run.stderr });
  writeFileSync(
    "evidence/tickets/AFM-093/story-planning/cli-commands.json",
    JSON.stringify(records, null, 2),
  );
  assert.equal(run.status, expected, run.stderr + run.stdout);
  return JSON.parse(run.stdout);
}
function input(name: string, value: unknown) {
  const path = join(home, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
}
let intake = command("plan", [
  "--source",
  "packages/studio-server/src/project",
  "--count",
  "3",
  "--seconds",
  "25",
  "--audience",
  "maintainers",
]).intake;
assert.equal(intake.proposals.length, 3);
assert.ok(new Set(intake.proposals.map((plan: any) => plan.story.family)).size >= 2);
intake = command("plan-stories", [
  "--intake",
  intake.id,
  "--file",
  input("options.json", { audience: "maintainers", durationSeconds: 30, count: 2 }),
]);
assert.equal(intake.proposals.length, 2);
const original = intake.proposals[0];
const story = structuredClone(original.story);
story.title = "Reviewed CLI source story";
intake = command("revise-story", [
  "--intake",
  intake.id,
  "--proposal",
  original.id,
  "--file",
  input("revision.json", { planHash: original.planHash, story }),
]);
const stale = command(
  "accept-stories",
  [
    "--intake",
    intake.id,
    "--file",
    input("stale.json", {
      selected: [original.id],
      review: { acknowledged: true, hashes: { [original.id]: original.planHash } },
    }),
  ],
  1,
);
assert.equal(stale.code, "proposal/review-conflict");
assert.equal(command("list").projects.length, 0);
const accepted = command("accept-stories", [
  "--intake",
  intake.id,
  "--file",
  input("accept.json", {
    selected: [original.id],
    review: { acknowledged: true, hashes: { [original.id]: intake.proposals[0].planHash } },
  }),
]);
assert.equal(accepted.length, 1);
const build = command("build", ["--id", accepted[0].id]);
assert.ok(readFileSync(join(build.dir, "index.html"), "utf8").includes("data-composition-id"));
console.log(
  JSON.stringify({
    commands: records.length,
    source: "packages/studio-server/src/project",
    revisedTitle: accepted[0].title,
    projectId: accepted[0].id,
    buildHash: build.hash,
    staleAcceptanceRefused: true,
  }),
);
