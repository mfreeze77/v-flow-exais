import { spawn, spawnSync } from "node:child_process";

/** A kernel lock works across CLI and Studio containers sharing the data volume. */
export function batchIsOwned(path: string): boolean {
  const result = spawnSync("flock", ["-n", path, "true"], { timeout: 5000 });
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error("Could not check batch ownership.");
}

export function ownBatch(path: string): Promise<() => void> {
  return new Promise((resolve, reject) => {
    // Closing stdin (including parent death) ends the holder and releases flock.
    const child = spawn(
      "flock",
      ["-n", path, "bun", "-e", 'console.log("owned"); await Bun.stdin.text();'],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let owned = false;
    child.once("error", reject);
    child.stdout.once("data", () => {
      owned = true;
      resolve(() => {
        child.stdin.end();
      });
    });
    child.once("close", (code) => {
      if (!owned)
        reject(
          new Error(
            code === 1
              ? "This batch is already running in another session."
              : "Could not acquire batch ownership.",
          ),
        );
    });
    child.stdin.on("error", () => {});
  });
}
