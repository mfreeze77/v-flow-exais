import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnifiedProjectService } from "../../packages/studio-server/src/project/projectService";
import {
  replanIntakeStories,
  reviseIntakeStory,
} from "../../packages/studio-server/src/project/storyIntake";
import { createStudioApi } from "../../packages/studio-server/src/createStudioApi";

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "story-plan-"));
  const source = join(dir, "source");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({ name: "Order desk", scripts: { start: "do-not-execute" } }),
  );
  writeFileSync(
    join(source, "README.md"),
    "# Order desk\nOrder desk helps a team receive purchase requests and record their status. The interface keeps a reviewable order before it is submitted.\n",
  );
  writeFileSync(
    join(source, "store.ts"),
    "export interface Order { id: string; amount: number; status: string; }\nexport function saveOrder(order: Order) { return order.id; }\n",
  );
  writeFileSync(
    join(source, "orders.ts"),
    "import {saveOrder} from './store';\nexport function validateOrder(order) { return order.amount > 0; }\nexport function submitOrder(order) { if (validateOrder(order)) return saveOrder(order); }\n",
  );
  writeFileSync(
    join(source, "api.ts"),
    "import {Hono} from 'hono';\nimport {submitOrder} from './orders';\nconst app = new Hono();\napp.post('/orders', submitOrder);\n",
  );
  const service = new UnifiedProjectService({
    home: join(dir, "data"),
    sourceRoots: [{ id: "source", label: "Source", path: source }],
  });
  const intake = await service.intake({
    kind: "local",
    rootId: "source",
    path: ".",
    story: { audience: "developers", purpose: "explain", durationSeconds: 35, count: 3 },
  });
  return {
    dir,
    source,
    service,
    intake,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
const review = (intake: Awaited<ReturnType<typeof fixture>>["intake"]) => ({
  acknowledged: true,
  hashes: Object.fromEntries(intake.proposals.map((plan) => [plan.id, plan.planHash!])),
});

it("plans distinct implementation stories with authored scripts, exact integer timing and captured relationships", async () => {
  const f = await fixture();
  try {
    expect(f.intake.proposals).toHaveLength(3);
    expect(new Set(f.intake.proposals.map((plan) => plan.story!.family)).size).toBe(3);
    expect(f.intake.proposals.some((plan) => plan.story!.family === "feature")).toBe(true);
    expect(
      f.intake.proposals.every((plan) =>
        plan.evidence.some((item) => item.path !== "package.json"),
      ),
    ).toBe(true);
    await expect(f.service.acceptIntake(f.intake.id, [f.intake.proposals[0]!.id])).rejects.toThrow(
      "Review the story",
    );
    const projects = await f.service.acceptIntake(
      f.intake.id,
      f.intake.proposals.map((plan) => plan.id),
      review(f.intake),
    );
    for (const [index, project] of projects.entries()) {
      const plan = f.intake.proposals[index]!;
      expect(plan.story!.beats[0]!.role).toBe("opening");
      expect(plan.story!.beats.at(-1)!.role).toBe("payoff");
      expect(
        plan.story!.beats.reduce((sum, beat) => sum + beat.durationFrames, 0),
      ).toBeLessThanOrEqual(35 * 30);
      expect(
        plan.story!.beats.every(
          (beat) => Number.isInteger(beat.durationFrames) && beat.script.length > 20,
        ),
      ).toBe(true);
      const build = await f.service.build(project.id);
      expect(existsSync(join(build.dir, "index.html"))).toBe(true);
      const retained = JSON.parse(
        readFileSync(join(f.service.root(project.id), ".vflow/source-evidence.json"), "utf8"),
      );
      expect(retained.planHash).toBe(plan.planHash);
      expect(retained.editorialReviewed).toBe(true);
      for (const doc of plan.snapshot.manifest.documents.filter(
        (item) => item.kind === "architecture",
      )) {
        const graph = plan.snapshot.sources[doc.id] as any;
        for (const edge of graph.connections)
          expect(
            f.intake.facts.understanding.relationships.some((item) => item.id === edge.id),
          ).toBe(true);
      }
    }
  } finally {
    f.cleanup();
  }
});
it("replans for audience/count, refuses invented evidence, repairs scripts and protects reviewed or existing project versions", async () => {
  const f = await fixture();
  try {
    const previous = f.intake.proposals[0]!;
    const [created] = await f.service.acceptIntake(f.intake.id, [previous.id], review(f.intake));
    const before = f.service.get(created!.id).snapshot;
    const replacement = structuredClone(previous.story!);
    replacement.title = "Where an order enters the implementation";
    replacement.beats[0]!.script =
      "Where does an order enter this implementation? Follow its registered handler and inspect the captured source.";
    const revised = await reviseIntakeStory(
      f.service,
      f.intake.id,
      previous.id,
      previous.planHash!,
      replacement,
    );
    expect(revised.proposals[0]!.planHash).not.toBe(previous.planHash);
    expect(revised.proposals[0]!.snapshot.manifest.id).not.toBe(created!.id);
    expect(f.service.get(created!.id).snapshot).toEqual(before);
    await expect(
      f.service.acceptIntake(f.intake.id, [previous.id], review(f.intake)),
    ).rejects.toThrow("changed after review");
    const invented = structuredClone(replacement);
    invented.beats[0]!.sourceIds = ["made-up"];
    await expect(
      reviseIntakeStory(
        f.service,
        f.intake.id,
        previous.id,
        revised.proposals[0]!.planHash!,
        invented,
      ),
    ).rejects.toThrow("Unknown story source");
    const audience = replanIntakeStories(f.service, f.intake.id, {
      audience: "new-users",
      purpose: "onboard",
      durationSeconds: 25,
      count: 1,
    });
    expect(audience.proposals).toHaveLength(1);
    expect(audience.proposals[0]!.story!.family).toBe("product");
    expect(f.service.get(created!.id).snapshot).toEqual(before);
    const app = createStudioApi({ projectService: f.service } as any);
    const response = await app.request(`http://localhost/vflow/intakes/${f.intake.id}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({ count: 0 }),
    });
    expect(response.status).toBe(400);
  } finally {
    f.cleanup();
  }
});
it("does not pad a manifest-only repository into multiple films", async () => {
  const dir = mkdtempSync(join(tmpdir(), "empty-story-"));
  try {
    const source = join(dir, "source");
    mkdirSync(source);
    writeFileSync(join(source, "package.json"), '{"name":"nothing-to-explain"}');
    const service = new UnifiedProjectService({
      home: join(dir, "data"),
      sourceRoots: [{ id: "source", label: "Source", path: source }],
    });
    const intake = await service.intake({ kind: "local", rootId: "source", path: "." });
    expect(intake.proposals).toHaveLength(0);
    expect(intake.planning!.warnings.join(" ")).toContain("Found 0 distinct");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("keeps concurrent edits to different stories and diversifies maintainer plans", async () => {
  const f = await fixture();
  try {
    const intake = replanIntakeStories(f.service, f.intake.id, {
      audience: "maintainers",
      purpose: "explain",
      durationSeconds: 25,
      count: 3,
    });
    expect(new Set(intake.proposals.map((plan) => plan.story!.family)).size).toBe(3);
    await Promise.all(
      intake.proposals.slice(0, 2).map((proposal, index) => {
        const story = structuredClone(proposal.story!);
        story.title = `Reviewed story ${index}`;
        return reviseIntakeStory(f.service, intake.id, proposal.id, proposal.planHash!, story);
      }),
    );
    expect(
      f.service
        .readIntake(intake.id)
        .proposals.slice(0, 2)
        .map((proposal) => proposal.title),
    ).toEqual(["Reviewed story 0", "Reviewed story 1"]);
  } finally {
    f.cleanup();
  }
});

it("frames a call beyond a long source-line prefix without changing the captured evidence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "long-story-"));
  try {
    const source = join(dir, "source");
    mkdirSync(source);
    const line = `export function orchestration() { const payload = "${"x".repeat(1000)}"; return targetOperation(payload); }`;
    writeFileSync(
      join(source, "flow.ts"),
      `function targetOperation(input) { return input; }\n${line}\n`,
    );
    const service = new UnifiedProjectService({
      home: join(dir, "data"),
      sourceRoots: [{ id: "source", label: "Source", path: source }],
    });
    const intake = await service.intake({
      kind: "local",
      rootId: "source",
      path: ".",
      story: { count: 1, durationSeconds: 25 },
    });
    const edge = intake.facts.understanding.relationships.find((item) => item.kind === "calls")!;
    expect(edge.evidence.text).toBe(line);
    expect(edge.evidence.focusColumn).toBe(line.indexOf("targetOperation(payload)"));
    const scene = intake.proposals[0]!.snapshot.sources["story-2"] as string;
    expect(scene).toContain("targetOperation(payload)");
    expect(scene).not.toContain("x".repeat(1000));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
