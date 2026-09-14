import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { join } from "node:path";

/** Stops only this driver's process group. Never kills another Studio/server or global browser. */
export function runStartupWorker(script, configPath, output, options = {}) {
  const timeoutMs = options.timeoutMs ?? 180_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    throw new Error("Invalid worker watchdog.");
  return new Promise((resolve) => {
    const stdout = openSync(join(output, "worker.stdout.log"), "wx");
    const stderr = openSync(join(output, "worker.stderr.log"), "wx");
    const grouped = process.platform !== "win32";
    let child;
    try {
      child = spawn(process.execPath, [script, "--worker", configPath], {
        cwd: options.cwd ?? process.cwd(),
        stdio: ["ignore", stdout, stderr],
        detached: grouped,
        env: options.env ?? process.env,
      });
    } catch (error) {
      closeSync(stdout);
      closeSync(stderr);
      resolve({ code: null, signal: null, error: String(error), timedOut: false });
      return;
    }
    let timedOut = false,
      spawnError = null,
      interrupted = false,
      killTimer;
    const terminate = (signal) => {
      if (!child.pid) return;
      try {
        process.kill(grouped ? -child.pid : child.pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") spawnError ??= String(error);
      }
    };
    const stop = () => {
      terminate("SIGTERM");
      killTimer ??= setTimeout(() => terminate("SIGKILL"), 1500);
    };
    const interrupt = () => {
      interrupted = true;
      stop();
    };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    child.on("error", (error) => {
      spawnError = String(error);
    });
    child.on("close", (code, signal) => {
      // A leader can exit on TERM while browser descendants remain in its group.
      if (grouped && (timedOut || interrupted)) terminate("SIGKILL");
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      closeSync(stdout);
      closeSync(stderr);
      resolve({ code, signal, error: spawnError, timedOut, interrupted });
    });
  });
}
