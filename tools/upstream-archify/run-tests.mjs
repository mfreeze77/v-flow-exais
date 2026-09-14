#!/usr/bin/env node
import { ownedArchifyPath, ownedSkillPath, ownedWorkspaceRoot } from "./owned-layout.mjs";

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = ownedWorkspaceRoot;
const skillRoot = ownedArchifyPath(repoRoot, "archify");
const testRoot = ownedSkillPath(skillRoot, "test");
const testFiles = fs
  .readdirSync(testRoot)
  .filter((entry) => entry.endsWith(".test.mjs"))
  .sort()
  .map((entry) => path.join("test", entry));

const [major, minor] = process.versions.node.split(".").map(Number);
const supportsConcurrencyFlag = major > 18 || (major === 18 && minor >= 19);
const args = ["--test"];
if (supportsConcurrencyFlag) args.push("--test-concurrency=2");
args.push(...testFiles);

const result = spawnSync(process.execPath, args, {
  cwd: skillRoot,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.signal) {
  process.stderr.write(`test runner terminated by ${result.signal}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
