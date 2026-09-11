import { readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  canonicalJson,
  readCommittedProject,
  readRevision,
  sha256,
} from "@hyperframes/project-model/revisions";
import { assertProposal } from "./proposalSchema";
import {
  archiveProposal,
  proposalDirectory,
  readProposal,
  withProposalLock,
  writeProposal,
} from "./proposalStore";
import { loadProposalEvidence, previewProposal, proposalCommand } from "./proposalPreview";
import {
  ProposalError,
  type ProposalProvider,
  type ProposalRecord,
  type ProposedProjectEdit,
} from "./proposalTypes";
import type { UnifiedProjectService } from "./projectService";

export class ProjectProposalService {
  constructor(
    private readonly service: UnifiedProjectService,
    private readonly provider?: ProposalProvider,
  ) {}
  providerStatus() {
    return {
      available: !!this.provider,
      id: this.provider?.id ?? null,
      alternatives: [
        "Import typed proposal JSON",
        "Submit proposals through the project API or CLI",
      ],
    };
  }
  context(projectId: string, intakeId: string) {
    const intake = this.service.readIntake(intakeId);
    return {
      project: this.service.get(projectId).snapshot,
      source: loadProposalEvidence(this.service, {
        source: { intakeId, snapshotHash: intake.facts.snapshotHash },
      } as ProposedProjectEdit),
      intakeId,
      snapshotHash: intake.facts.snapshotHash,
    };
  }
  async generate(projectId: string, intakeId: string, brief: string) {
    if (!this.provider)
      throw new ProposalError(
        "proposal/provider-unavailable",
        "No proposal provider is configured. Import an agent's typed proposal or use the local proposal API.",
      );
    if (typeof brief !== "string" || !brief.trim() || brief.length > 4000)
      throw new ProposalError(
        "proposal/invalid-brief",
        "Supply a brief of up to 4,000 characters.",
      );
    const context = structuredClone(this.context(projectId, intakeId));
    const timeout = AbortSignal.timeout(60_000);
    const output = await Promise.race([
      this.provider.generate({ ...context, brief }, timeout),
      new Promise<never>((_, reject) =>
        timeout.addEventListener(
          "abort",
          () =>
            reject(
              new ProposalError("proposal/provider-unavailable", "Proposal provider timed out."),
            ),
          { once: true },
        ),
      ),
    ]).catch(() => {
      throw new ProposalError(
        "proposal/provider-unavailable",
        "Proposal provider did not return a result. Retry or import an agent proposal.",
      );
    });
    assertProposal(output);
    if (
      output.projectId !== projectId ||
      output.expectedRevision !== context.project.manifest.revision ||
      output.source.intakeId !== intakeId ||
      output.source.snapshotHash !== context.snapshotHash
    )
      throw new ProposalError(
        "proposal/provider-context-mismatch",
        "Provider output targets a different project, revision or source snapshot.",
      );
    return this.create(output);
  }
  async create(input: unknown) {
    assertProposal(input);
    const record: ProposalRecord = {
      schemaVersion: 1,
      id: `proposal-${randomUUID()}`,
      version: 1,
      contentHash: sha256(canonicalJson(input)),
      createdAt: new Date().toISOString(),
      status: "draft",
      proposal: structuredClone(input),
    };
    const root = this.service.root(input.projectId);
    const preview = await previewProposal(this.service, record);
    writeProposal(root, record);
    return { record, preview };
  }
  list(projectId: string) {
    const root = this.service.root(projectId);
    return readdirSync(proposalDirectory(root))
      .filter((name) => /^proposal-[a-f0-9-]{36}\.json$/.test(name))
      .map((name) => this.reconcile(root, readProposal(root, name.slice(0, -5))));
  }
  async get(projectId: string, id: string) {
    const root = this.service.root(projectId);
    const record = this.reconcile(root, readProposal(root, id));
    const committed =
      readCommittedProject(root).index.commands[sha256(proposalCommand(record).commandId)];
    const previous = committed ? readRevision(root, committed.pointer).index.previous : null;
    return {
      record,
      preview: await previewProposal(
        this.service,
        record,
        previous ? readRevision(root, previous).snapshot : undefined,
      ),
    };
  }
  private reconcile(root: string, record: ProposalRecord) {
    const command = proposalCommand(record);
    const committed = readCommittedProject(root).index.commands[sha256(command.commandId)];
    if (committed) {
      if (committed.fingerprint !== sha256(canonicalJson(command)))
        throw new ProposalError(
          "proposal/integrity",
          "Proposal command receipt does not match its content.",
        );
      return {
        ...record,
        status: "accepted" as const,
        acceptedRevision: committed.pointer.revision,
      };
    }
    if (record.status === "accepted")
      throw new ProposalError(
        "proposal/integrity",
        "Accepted proposal has no corresponding committed project receipt.",
      );
    return record;
  }
  async revise(
    projectId: string,
    id: string,
    version: number,
    contentHash: string,
    input: unknown,
  ) {
    assertProposal(input);
    if (input.projectId !== projectId)
      throw new ProposalError(
        "proposal/wrong-project",
        "Revision must remain in the same project.",
      );
    const root = this.service.root(projectId);
    return withProposalLock(root, id, async () => {
      const record = this.reconcile(root, readProposal(root, id));
      this.assertReview(record, version, contentHash);
      archiveProposal(root, record);
      const next = {
        ...record,
        version: record.version + 1,
        contentHash: sha256(canonicalJson(input)),
        proposal: structuredClone(input),
      };
      const preview = await previewProposal(this.service, next);
      writeProposal(root, next);
      return { record: next, preview };
    });
  }
  async reject(projectId: string, id: string, version: number, contentHash: string) {
    const root = this.service.root(projectId);
    return withProposalLock(root, id, async () => {
      const record = this.reconcile(root, readProposal(root, id));
      this.assertReview(record, version, contentHash);
      const next = { ...record, status: "rejected" as const };
      writeProposal(root, next);
      return next;
    });
  }
  async accept(
    projectId: string,
    id: string,
    version: number,
    contentHash: string,
    acknowledgedClaimIds: string[],
  ) {
    const root = this.service.root(projectId);
    return withProposalLock(root, id, async () => {
      const record = this.reconcile(root, readProposal(root, id));
      this.assertVersion(record, version, contentHash);
      if (record.status === "accepted") return record;
      this.assertReview(record, version, contentHash);
      const preview = await previewProposal(this.service, record);
      if (!preview.valid)
        throw new ProposalError(
          "proposal/invalid",
          "Resolve proposal diagnostics before accepting.",
          preview.diagnostics,
        );
      const required = preview.claims
        .filter((claim) => claim.requiresAcknowledgement)
        .map((claim) => claim.id);
      if (
        !Array.isArray(acknowledgedClaimIds) ||
        required.some((id) => !acknowledgedClaimIds.includes(id))
      )
        throw new ProposalError(
          "proposal/acknowledgement-required",
          "Review and acknowledge each documentation claim, interpretation and editorial wording.",
        );
      // Save the exact review before dispatch. If the process dies after the
      // project commits, reconcile() recovers acceptance from the project journal.
      writeProposal(root, { ...record, acknowledgedClaimIds: required });
      const result = await this.service.command(projectId, proposalCommand(record));
      const accepted = {
        ...record,
        status: "accepted" as const,
        acceptedRevision: result.pointer.revision,
        acknowledgedClaimIds: required,
      };
      writeProposal(root, accepted);
      return accepted;
    });
  }
  private assertVersion(record: ProposalRecord, version: number, contentHash: string) {
    if (record.version !== version || record.contentHash !== contentHash)
      throw new ProposalError(
        "proposal/review-conflict",
        "Proposal changed after this review. Reload the latest version.",
      );
  }
  private assertReview(record: ProposalRecord, version: number, contentHash: string) {
    this.assertVersion(record, version, contentHash);
    if (record.status !== "draft")
      throw new ProposalError("proposal/closed", `Proposal is already ${record.status}.`);
  }
}
