import { defineCommand } from "citty";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import {
  UnifiedProjectService,
  ProjectBatchService,
  type StudioApiAdapter,
  type RenderJobState,
} from "@hyperframes/studio-server";
import { setCommandExitCode } from "../utils/commandResult";
import { proposalActions, runProjectProposal } from "./projectProposal";

/** The CLI shares the Studio command validator, immutable store and batch service. */
export default defineCommand({
  meta: {
    name: "project",
    description:
      "Inspect source, create multiple editable video projects, and render resumable batches.",
  },
  args: {
    action: {
      type: "positional",
      default: "list",
      description:
        "list | plan | from-source | import | get | command | build | export | resume | batch-status | download | proposal-context | propose | proposals | review-proposal | revise-proposal | accept-proposal | reject-proposal",
    },
    source: {
      type: "string",
      description: "Local source folder or public HTTPS GitHub repository URL.",
    },
    home: {
      type: "string",
      description: "Unified project data directory; defaults to VFLOW_DATA_HOME.",
    },
    id: { type: "string", description: "Project or batch ID." },
    intake: { type: "string", description: "Pinned source intake ID for proposal context." },
    proposal: {
      type: "string",
      description: "Saved proposal ID to review, revise, accept or reject.",
    },
    file: { type: "string", description: "Diagram JSON or revision-aware command JSON file." },
    output: {
      type: "string",
      description: "Copy verified MP4s and receipts to this folder, without overwriting files.",
    },
    render: {
      type: "boolean",
      default: false,
      description: "Export all projects created from this source.",
    },
    json: { type: "boolean", default: true, description: "Print structured results." },
  },
  async run({ args }) {
    const source = args.source || process.cwd();
    const service = new UnifiedProjectService({
      home: resolve(args.home || process.env.VFLOW_DATA_HOME || ".vflow"),
      sourceRoots: [
        {
          id: "source",
          label: "Selected local source",
          path: /^https:/.test(source) ? process.cwd() : resolve(source),
        },
      ],
    });
    const adapter: Pick<StudioApiAdapter, "startRender"> = {
      startRender(options) {
        const abort = new AbortController();
        const state: RenderJobState = {
          id: options.jobId,
          status: "rendering",
          progress: 0,
          outputPath: options.outputPath,
          cancel: () => abort.abort(),
        };
        void (async () => {
          try {
            const { createRenderJob, executeRenderJob } = await import("@hyperframes/producer");
            const job = createRenderJob({
              fps: options.fps,
              quality: "standard",
              format: "mp4",
              workers: 1,
            });
            await executeRenderJob(
              job,
              options.project.dir,
              options.outputPath,
              (progress) => {
                state.progress = progress.progress;
                state.stage = progress.currentStage;
              },
              abort.signal,
            );
            state.status = abort.signal.aborted ? "cancelled" : "complete";
          } catch (error) {
            state.status = abort.signal.aborted ? "cancelled" : "failed";
            state.error = error instanceof Error ? error.message : "Render failed.";
          }
        })();
        return state;
      },
    };
    const batches = new ProjectBatchService(service, adapter);
    let batchId: string | undefined;
    const cancel = () => {
      if (batchId) batches.cancel(batchId);
    };
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    try {
      let result: any;
      if (proposalActions.has(args.action)) result = await runProjectProposal(service, args);
      else if (args.action === "list") result = { projects: service.list() };
      else if (args.action === "plan" || args.action === "from-source") {
        const intake = await service.intake(
          /^https:/.test(source)
            ? { kind: "github", url: source }
            : { kind: "local", rootId: "source", path: "." },
        );
        result = { intake };
        if (args.action === "from-source") {
          result.projects = await service.acceptIntake(
            intake.id,
            intake.proposals.map((plan) => plan.id),
          );
          if (args.render)
            batchId = (await batches.start(result.projects.map((project: any) => project.id))).id;
        }
      } else if (args.action === "import")
        result = await service.importDiagram(JSON.parse(readFileSync(args.file!, "utf8")));
      else if (args.action === "get") result = service.get(args.id!);
      else if (args.action === "command")
        result = await service.command(args.id!, JSON.parse(readFileSync(args.file!, "utf8")));
      else if (args.action === "build") result = await service.build(args.id!);
      else if (args.action === "export")
        batchId = (
          await batches.start(
            args.id ? args.id.split(",") : service.list().map((project) => project.id),
          )
        ).id;
      else if (args.action === "resume") batchId = (await batches.resume(args.id!)).id;
      else if (args.action === "batch-status") result = batches.get(args.id!);
      else if (args.action === "download") {
        if (!args.output) throw new Error("download requires --output.");
        result = { batch: batches.get(args.id!) };
      } else throw new Error("Unknown project action. Run project --help for supported actions.");
      if (batchId) {
        console.error(JSON.stringify({ event: "batch-started", batchId }));
        let batch = batches.get(batchId);
        while (batch.status === "running") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          batch = batches.get(batchId);
        }
        result = { ...result, batch };
        if (batch.status !== "complete") setCommandExitCode(batch.status === "cancelled" ? 130 : 1);
      }
      if (args.output && result?.batch) {
        const destination = resolve(args.output);
        mkdirSync(destination, { recursive: true });
        const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
        const save = (path: string, bytes: Buffer) => {
          if (existsSync(path)) {
            if (hash(readFileSync(path)) !== hash(bytes))
              throw new Error(`Output already exists with different content: ${path}`);
          } else writeFileSync(path, bytes, { flag: "wx" });
        };
        result.downloads = [];
        for (const item of result.batch.items) {
          if (item.status !== "complete" || !item.outputPath) continue;
          const bytes = readFileSync(item.outputPath);
          if (hash(bytes) !== item.sha256) throw new Error("Output failed its committed checksum.");
          const name = `${item.projectId}-${item.sha256.slice(0, 12)}`;
          const path = join(destination, `${name}.mp4`);
          save(path, bytes);
          save(
            join(destination, `${name}.receipt.json`),
            Buffer.from(JSON.stringify(item, null, 2)),
          );
          result.downloads.push({ path, sha256: item.sha256 });
        }
      }
      await new Promise<void>((resolve, reject) =>
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`, (error) =>
          error ? reject(error) : resolve(),
        ),
      );
    } catch (error: any) {
      await new Promise<void>((resolve, reject) =>
        process.stdout.write(
          JSON.stringify({
            ok: false,
            error: error.message,
            code: error.code || "project/invalid",
            diagnostics: error.diagnostics || [],
          }) + "\n",
          (error) => (error ? reject(error) : resolve()),
        ),
      );
      setCommandExitCode(error.code === "project/revision-conflict" ? 3 : 1);
    } finally {
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
    }
  },
});
