import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runStartupWorker } from "./managed-startup-process.mjs";
async function run(code, timeoutMs = 5000) {
  const dir = mkdtempSync(join(tmpdir(), "vflow-startup-child-"));
  try {
    const script = join(dir, "child.mjs");
    writeFileSync(script, code);
    const result = await runStartupWorker(script, join(dir, "unused.json"), dir, { timeoutMs });
    return { ...result, stdout: readFileSync(join(dir, "worker.stdout.log"), "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("child success preserves exit and stdout", async () => {
  const r = await run('console.log("observed, not accepted")');
  assert.equal(r.code, 0);
  assert.equal(r.timedOut, false);
  assert.match(r.stdout, /not accepted/);
});
test("child nonzero is not converted into a successful run", async () => {
  const r = await run("process.exitCode=7");
  assert.equal(r.code, 7);
});
test("a blocked worker hits its own watchdog", async () => {
  const r = await run("setInterval(()=>{},100)", 100);
  assert.equal(r.timedOut, true);
  assert.notEqual(r.code, 0);
});
test("syntax failure retains the child failure", async () => {
  const r = await run("const a = ;");
  assert.equal(r.code, 1);
});
