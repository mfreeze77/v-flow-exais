import { readFileSync } from "node:fs";
import { commitWhileLocked } from "./commit.ts";

try {
  const request = JSON.parse(readFileSync(0, "utf8"));
  const result = commitWhileLocked(process.argv[2], request);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      message: error instanceof Error ? error.message : "Project commit failed.",
      code: error.code,
      expected: error.expected,
      actual: error.actual,
      diagnostics: error.diagnostics,
    }),
  );
  process.exitCode = 1;
}
