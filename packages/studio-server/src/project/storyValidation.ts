import type { RepositoryUnderstanding } from "./repositoryUnderstanding";
import type { StoryPlan, StoryBeat } from "./storyTypes";
import { parseStoryOptions } from "./storyTypes";
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const need = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
function validateBeat(beat: StoryBeat, source: RepositoryUnderstanding) {
  need(beat && typeof beat === "object", "Each story beat must be an object.");
  need(
    text(beat.id, 80) && text(beat.heading, 240) && text(beat.script, 2400),
    "Beat ID, heading and script are required and must fit the editorial limits.",
  );
  need(
    ["opening", "context", "mechanism", "payoff"].includes(beat.role),
    "Unknown story beat role.",
  );
  need(
    ["title", "source", "diagram", "model", "takeaway"].includes(beat.visual),
    "Unknown story visual.",
  );
  need(
    Number.isSafeInteger(beat.durationFrames) &&
      beat.durationFrames >= 60 &&
      beat.durationFrames <= 600,
    "Each beat needs 2 to 20 seconds in integer frames.",
  );
  need(
    Array.isArray(beat.sourceIds) && beat.sourceIds.length > 0 && beat.sourceIds.length <= 5,
    "Select 1 to 5 source subjects per beat.",
  );
  need(
    Array.isArray(beat.relationshipIds) && beat.relationshipIds.length <= 6,
    "Select at most 6 source relationships per beat.",
  );
  for (const id of beat.sourceIds)
    need(
      source.observations.some((item) => item.id === id),
      `Unknown story source identity: ${id}`,
    );
  for (const id of beat.relationshipIds) {
    const edge = source.relationships.find((item) => item.id === id);
    need(edge, `Unknown story relationship: ${id}`);
    if (beat.visual === "diagram")
      need(
        beat.sourceIds.includes(edge!.from) && beat.sourceIds.includes(edge!.to),
        "A diagram must include both captured relationship endpoints.",
      );
  }
  if (beat.visual === "model")
    need(
      source.observations.find((item) => item.id === beat.sourceIds[0])?.kind === "model",
      "A model scene needs a captured data type.",
    );
}
export function validateStoryPlan(
  value: unknown,
  source: RepositoryUnderstanding,
): asserts value is StoryPlan {
  const plan = value as StoryPlan;
  need(plan && typeof plan === "object" && plan.version === 1, "Unsupported story plan.");
  need(
    ["architecture", "feature", "data-model", "product"].includes(plan.family),
    "Unknown story family.",
  );
  need(
    text(plan.title, 240) && text(plan.question, 320) && text(plan.reason, 600),
    "Provide a title, opening question and reason for this story.",
  );
  parseStoryOptions({
    audience: plan.audience,
    purpose: plan.purpose,
    durationSeconds: plan.targetDurationSeconds,
    count: 1,
  });
  need(
    plan.fps?.numerator === 30 && plan.fps.denominator === 1,
    "Story drafts currently use 30/1 fps.",
  );
  need(
    plan.scriptStatus === "editorial-draft",
    "Script text remains an editorial draft until reviewed; it cannot certify itself as fact.",
  );
  need(
    Array.isArray(plan.beats) && plan.beats.length >= 3 && plan.beats.length <= 12,
    "A story needs 3 to 12 beats.",
  );
  need(
    plan.beats[0]?.role === "opening" && plan.beats.at(-1)?.role === "payoff",
    "A story must open with a question and finish with a payoff.",
  );
  need(
    new Set(plan.beats.map((beat) => beat.id)).size === plan.beats.length,
    "Story beat IDs must be unique.",
  );
  need(
    Array.isArray(plan.limitations) && plan.limitations.every((item) => text(item, 1200)),
    "Retain readable story limitations.",
  );
  plan.beats.forEach((beat) => validateBeat(beat, source));
}
