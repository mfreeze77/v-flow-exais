import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { compileProject } from "@hyperframes/diagram-motion";
import {
  assertCommand,
  assertProject,
  migrateRelationshipIds,
  type ProjectSnapshot,
  type DiagramKind,
} from "@hyperframes/project-model";
import { initializeProject, executeProjectCommand } from "@hyperframes/project-model/storage";
import { readCommittedProject, readRevision } from "@hyperframes/project-model/revisions";
import { atomicJson, buildCommittedProject, type PinnedBuild } from "./projectBuild";
import {
  contained,
  createRepositoryIntake,
  type RepositoryIntake,
  type SourceRequest,
  type SourceRoot,
} from "./repositoryIntake";
import { nativeTitle } from "./videoProposals";
import { ProjectProposalService } from "./projectProposals";
import type { ProposalProvider } from "./proposalTypes";
import { assertStoryReview } from "./storyIntake";

const validId = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
export interface ProjectServiceOptions {
  home: string;
  sourceRoots: SourceRoot[];
  proposalProvider?: ProposalProvider;
}

export class UnifiedProjectService {
  readonly projectsDir: string;
  readonly intakesDir: string;
  readonly batchesDir: string;
  readonly proposals: ProjectProposalService;
  constructor(readonly options: ProjectServiceOptions) {
    this.projectsDir = join(options.home, "projects");
    this.intakesDir = join(options.home, "intakes");
    this.batchesDir = join(options.home, "batches");
    for (const dir of [this.projectsDir, this.intakesDir, this.batchesDir])
      mkdirSync(dir, { recursive: true });
    this.proposals = new ProjectProposalService(this, options.proposalProvider);
  }
  roots() {
    return this.options.sourceRoots.map(({ id, label }) => ({ id, label }));
  }
  root(id: string) {
    if (!validId(id)) throw new Error("Invalid project ID.");
    const root = contained(this.projectsDir, id);
    if (!existsSync(join(root, ".vflow/CURRENT"))) throw new Error("Project not found.");
    return root;
  }
  has(id: string) {
    try {
      this.root(id);
      return true;
    } catch {
      return false;
    }
  }
  list() {
    return readdirSync(this.projectsDir)
      .filter((id) => validId(id) && this.has(id))
      .map((id) => {
        try {
          const { snapshot } = readCommittedProject(this.root(id));
          return {
            id,
            title: snapshot.manifest.title,
            revision: snapshot.manifest.revision,
            managed: true,
          };
        } catch {
          return {
            id,
            title: id,
            revision: null,
            managed: true,
            error: "Project integrity check failed.",
          };
        }
      });
  }
  get(id: string) {
    const root = this.root(id);
    const current = readCommittedProject(root);
    return {
      snapshot: current.snapshot,
      canUndo: !!current.index.history?.undo.length,
      canRedo: !!current.index.history?.redo.length,
      evidence: existsSync(join(root, ".vflow/source-evidence.json"))
        ? JSON.parse(readFileSync(join(root, ".vflow/source-evidence.json"), "utf8"))
        : null,
    };
  }
  async command(id: string, command: unknown) {
    assertCommand(command);
    if (id !== command.projectId)
      throw new Error("Command project ID differs from the requested project.");
    const root = this.root(id);
    const result = await executeProjectCommand(root, command, async (snapshot) => {
      await compileProject(snapshot);
    });
    // Return this command's own committed snapshot, even if another client committed meanwhile.
    return { ...result, snapshot: readRevision(root, result.pointer).snapshot };
  }
  async build(id: string): Promise<PinnedBuild> {
    return buildCommittedProject(this.root(id));
  }
  async intake(request: SourceRequest) {
    return createRepositoryIntake(this.intakesDir, this.options.sourceRoots, request);
  }
  readIntake(id: string): RepositoryIntake {
    if (!/^intake-[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid intake ID.");
    const path = contained(this.intakesDir, `${id}/intake.json`);
    return JSON.parse(readFileSync(path, "utf8"));
  }
  async acceptIntake(
    id: string,
    selected: string[],
    review?: { hashes?: Record<string, string>; acknowledged?: boolean },
  ) {
    const intake = this.readIntake(id);
    if (
      !Array.isArray(selected) ||
      !selected.length ||
      selected.length > 6 ||
      selected.some((key) => !intake.proposals.some((plan) => plan.id === key))
    )
      throw new Error("Select valid video proposals.");
    assertStoryReview(this, intake, selected, review);
    const results = [];
    for (const key of [...new Set(selected)]) {
      const proposal = intake.proposals.find((plan) => plan.id === key)!;
      // Retry uses the stable proposal project identity; it never duplicates outputs.
      if (!this.has(proposal.snapshot.manifest.id)) {
        await this.create(proposal.snapshot, {
          schemaVersion: 1,
          intakeId: id,
          snapshotHash: intake.facts.snapshotHash,
          revision: intake.facts.revision,
          dirty: intake.facts.dirty,
          citations: proposal.evidence,
          limitations: intake.facts.limitations,
          story: proposal.story,
          planHash: proposal.planHash,
          editorialReviewed: !!review?.acknowledged,
        });
      }
      results.push({ id: proposal.snapshot.manifest.id, title: proposal.title });
    }
    return results;
  }
  async create(snapshot: ProjectSnapshot, evidence: unknown = null) {
    assertProject(snapshot);
    if (!validId(snapshot.manifest.id)) throw new Error("Invalid new project ID.");
    await compileProject(snapshot);
    const root = contained(this.projectsDir, snapshot.manifest.id);
    mkdirSync(root, { recursive: true });
    await initializeProject(root, snapshot);
    if (evidence) atomicJson(join(root, ".vflow/source-evidence.json"), evidence);
    return snapshot.manifest.id;
  }
  async importDiagram(source: any) {
    const kind = source?.diagram_type as DiagramKind;
    const migration = migrateRelationshipIds(source, kind);
    const projectId = `video-${randomUUID()}`;
    const snapshot: ProjectSnapshot = {
      manifest: {
        schemaVersion: 1,
        id: projectId,
        title: String(source.meta?.title || "Imported diagram"),
        revision: 0,
        documents: [
          { id: "title", kind: "native", path: "title.html", authoritative: true },
          { id: "diagram", kind, path: `source.${kind}.json`, authoritative: true },
        ],
        scenes: [
          {
            id: "title-scene",
            kind: "native",
            documentId: "title",
            startFrame: 0,
            durationFrames: 75,
            presentation: { title: source.meta.title, focusObjectIds: [], relationshipIds: [] },
          },
          {
            id: "diagram-scene",
            kind: "diagram",
            documentId: "diagram",
            startFrame: 75,
            durationFrames: 240,
            presentation: {
              title: source.meta.title,
              subtitle: source.meta.subtitle || "",
              focusObjectIds: [],
              relationshipIds: [],
            },
          },
        ],
        output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
        policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
      },
      sources: {
        title: nativeTitle(
          String(source.meta.title),
          "An editable diagram, compiled from authored source.",
        ),
        diagram: migration.source,
      },
    };
    // Preserve original bytes/IDs separately before making the imported state visible.
    const root = contained(this.projectsDir, projectId);
    mkdirSync(join(root, ".vflow/imports"), { recursive: true });
    writeFileSync(join(root, ".vflow/imports/original.json"), JSON.stringify(source, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    atomicJson(join(root, ".vflow/imports/migration.json"), migration);
    await this.create(snapshot);
    return { id: projectId, migration };
  }
}
