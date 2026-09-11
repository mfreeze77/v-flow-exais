import type { SourceExcerpt } from "./repositoryUnderstanding";

export interface StoryOptions {
  audience: "developers" | "new-users" | "maintainers";
  purpose: "explain" | "onboard" | "review";
  durationSeconds: number;
  count: number;
}
export const DEFAULT_STORY_OPTIONS: StoryOptions = {
  audience: "developers",
  purpose: "explain",
  durationSeconds: 40,
  count: 3,
};
export type StoryFamily = "architecture" | "feature" | "data-model" | "product";
export interface StoryCandidate {
  key: string;
  family: StoryFamily;
  subjectId: string;
  sourceIds: string[];
  relationshipIds: string[];
  score: number;
  title: string;
  question: string;
  reason: string;
}
export interface StoryBeat {
  id: string;
  role: "opening" | "context" | "mechanism" | "payoff";
  visual: "title" | "diagram" | "source" | "model" | "takeaway";
  heading: string;
  script: string;
  durationFrames: number;
  sourceIds: string[];
  relationshipIds: string[];
}
export interface StoryPlan {
  version: 1;
  family: StoryFamily;
  title: string;
  question: string;
  reason: string;
  audience: StoryOptions["audience"];
  purpose: StoryOptions["purpose"];
  targetDurationSeconds: number;
  fps: { numerator: number; denominator: number };
  beats: StoryBeat[];
  // Script and headings are reviewable editorial drafts, never verified claims.
  scriptStatus: "editorial-draft";
  limitations: string[];
}
export interface StoryEvidence {
  id: string;
  name: string;
  statement: string;
  classification: "source-observation" | "documented-claim" | "source-relationship";
  excerpt: SourceExcerpt;
}

export function parseStoryOptions(input: unknown = DEFAULT_STORY_OPTIONS): StoryOptions {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Supply story settings.");
  const value = { ...DEFAULT_STORY_OPTIONS, ...input };
  if (!Object.keys(value).every((key) => Object.hasOwn(DEFAULT_STORY_OPTIONS, key)))
    throw new Error("Unknown story setting.");
  if (!["developers", "new-users", "maintainers"].includes(value.audience))
    throw new Error("Choose a supported audience.");
  if (!["explain", "onboard", "review"].includes(value.purpose))
    throw new Error("Choose a supported purpose.");
  if (!Number.isInteger(value.count) || value.count < 1 || value.count > 6)
    throw new Error("Choose 1 to 6 videos.");
  if (
    !Number.isInteger(value.durationSeconds) ||
    value.durationSeconds < 20 ||
    value.durationSeconds > 120
  )
    throw new Error("Choose a target length between 20 and 120 seconds.");
  return value;
}
