# V-Flow EXAIS

One Studio for source-grounded diagrams and editable video production.
Inspect a public GitHub repository or a mounted local project, review three
video plans, edit their diagrams and scenes, and export MP4s as a batch.
The first real batch uses this repository: a project tour, a dependency story,
and developer entry points. Each is 19 seconds, 1280×720, H.264 at 30 fps.
See the [delivery evidence](evidence/tickets/AFM-099/result.json) and
[progress ledger](evidence/LEDGER.md) for measured results and remaining scope.

The current planner reads package declarations and source inventory. It makes
silent, editable drafts; it does not infer runtime architecture, run repository
scripts, generate AI narration, or prove the entire 134-ticket product complete.

## Develop in Docker

```sh
docker compose build
docker compose run --rm workspace bun install --frozen-lockfile
docker compose run --rm --service-ports studio
```

Open **http://127.0.0.1:5190**. The container listens on port 5190; Docker
publishes it only on the host's loopback interface. Stop it with Ctrl+C.
On installations with the standalone Compose executable, use `docker-compose`
in place of `docker compose`.

In Studio, choose **Local project** or **GitHub repository**, inspect the source,
review the three plans, and create the projects. Open one to rename diagram
objects, edit source, choose authored relationships, change timing, undo/redo,
and scrub the timeline. **Export all videos** produces individually verified
downloads. Changes made after a batch starts cannot change its pinned inputs.

To mount another Windows project, set the source before starting Studio:

```powershell
$env:VFLOW_SOURCE_DIR = 'C:/Projects/MyProject'
docker-compose run --rm --service-ports studio
```

The selected project is mounted read-only at `/input`. Use `.` in the folder
field. Private repositories can be cloned locally and mounted this way.

## One-command batch

After the image and workspace dependencies are installed:

```sh
docker compose run --rm workspace bun run build:owned-runtimes
docker compose run --rm workspace bun run vflow from-source --source https://github.com/owner/repo --render --output /workspace/out/videos
```

For the mounted local project, replace the URL with `/input`. CLI-generated
projects also appear in Studio. `plan` inspects without creating projects;
`export --id project-id,another-id` renders existing projects. `resume --id
batch-id` retries unfinished items from their original builds. `download --id
batch-id --output /workspace/out/videos` copies verified outputs and receipts
to the host. Existing files are never overwritten with different content.

Saved source, history and MP4s live in the **`v-flow-exais_project-data` Docker
volume**, shared by CLI and Studio. Preserve it. Source files stay on the host;
atomic project storage uses the Linux volume because Windows bind mounts do
not provide the required directory rename behavior. The example deliverables
are also copied to `out/vflow-demo/` on the host.

```sh
docker compose run --rm workspace bun run test:acceptance tests/acceptance/AFM-011.test.ts tests/acceptance/AFM-011.package.test.ts tests/acceptance/AFM-027.test.ts tests/acceptance/AFM-099.source.test.ts
docker compose run --rm workspace bun run --cwd packages/project-model test
docker compose run --rm workspace bun run --cwd packages/diagram-motion test
```

The acceptance suite is distinct from the inherited package test/build suites.
Do not infer full application acceptance from its passing count.

## Implementation instructions

Read [AGENTS.md](AGENTS.md), the actual [tickets](docs/implementation/tickets/),
[contracts](docs/implementation/docs/CONTRACTS.md), and
[definition of done](docs/DEFINITION_OF_DONE.md). The complete specification
ships under `docs/implementation/`; a clone does not need `_sources/` to read it.
Raw upstream snapshots remain frozen, optional provenance inputs, never runtime
dependencies. Source-drift checks require the original inputs and must report
them as unavailable when absent.

The current delivery target is a repository or local project producing several
source-grounded, editable videos with real, inspected MP4 exports. The full
local product remains in scope beyond the first successful video.
