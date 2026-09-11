import type { RepositoryFacts } from "./repositoryIntake";
import type { RepositoryUnderstanding } from "./repositoryUnderstanding";
import { discoverStoryCandidates } from "./storyCandidates";
import {
  parseStoryOptions,
  type StoryOptions,
  type StoryCandidate,
  type StoryPlan,
  type StoryBeat,
  type StoryEvidence,
} from "./storyTypes";

export function storyEvidence(ids: string[], source: RepositoryUnderstanding): StoryEvidence[] {
  return [...new Set(ids)].map((id) => {
    const observed = source.observations.find((item) => item.id === id);
    if (observed)
      return {
        id,
        name: observed.name,
        statement: observed.summary,
        classification: observed.basis === "documented" ? "documented-claim" : "source-observation",
        excerpt: observed.evidence,
      } as StoryEvidence;
    const edge = source.relationships.find((item) => item.id === id);
    if (!edge) throw new Error(`Unavailable story evidence: ${id}`);
    return {
      id,
      name: edge.kind,
      statement: edge.description,
      classification: "source-relationship",
      excerpt: edge.evidence,
    };
  });
}
function composeStory(
  candidate: StoryCandidate,
  facts: RepositoryFacts,
  options: StoryOptions,
): StoryPlan {
  const source = facts.understanding;
  const subject = source.observations.find((item) => item.id === candidate.subjectId)!;
  const beats: StoryBeat[] = [];
  const add = (beat: Omit<StoryBeat, "id" | "durationFrames">) =>
    beats.push({ ...beat, id: `beat-${beats.length}`, durationFrames: 0 });
  add({
    role: "opening",
    visual: "title",
    heading: candidate.question,
    script: `${candidate.question} We will use ${subject.evidence.path} to answer it.`,
    sourceIds: [subject.id],
    relationshipIds: [],
  });
  if (candidate.relationshipIds.length)
    add({
      role: "context",
      visual: "diagram",
      heading: candidate.title,
      script: candidate.relationshipIds
        .map((id) => source.relationships.find((item) => item.id === id)!.description)
        .join(" "),
      sourceIds: candidate.sourceIds,
      relationshipIds: candidate.relationshipIds,
    });
  else if (candidate.family === "data-model")
    add({
      role: "context",
      visual: "model",
      heading: `${subject.name}: the declared fields`,
      script: subject.summary,
      sourceIds: [subject.id],
      relationshipIds: [],
    });
  const detailIds = candidate.sourceIds.slice(
    0,
    Math.min(4, Math.max(1, Math.floor(options.durationSeconds / 10))),
  );
  for (const [index, id] of detailIds.entries()) {
    const item = source.observations.find((entry) => entry.id === id)!;
    const connection = source.relationships.find(
      (entry) => entry.id === candidate.relationshipIds[index],
    );
    if (connection) {
      const target = source.observations.find((entry) => entry.id === connection.to)!;
      add({
        role: "mechanism",
        visual: "source",
        heading: `The reference to ${target.name}`,
        script: connection.description,
        sourceIds: [...new Set([connection.from, connection.to])],
        relationshipIds: [connection.id],
      });
      continue;
    }
    add({
      role: "mechanism",
      visual: "source",
      heading:
        item.kind === "documentation" ? "The project's own explanation" : `Read ${item.name}`,
      script:
        item.basis === "documented"
          ? `The documentation says: ${item.evidence.text}`
          : `${item.summary} The highlighted source is ${item.evidence.path}, beginning at line ${item.evidence.startLine}.`,
      sourceIds: [id],
      relationshipIds: [],
    });
  }
  const payoff =
    candidate.family === "data-model"
      ? `Start with ${subject.name} when reading this data contract.`
      : candidate.relationshipIds.length
        ? `Use these captured connections to navigate outward from ${subject.name}.`
        : `You can now locate the source behind ${subject.name}.`;
  add({
    role: "payoff",
    visual: "takeaway",
    heading: "Your next step",
    script: `${payoff} Confirm runtime behavior separately before relying on it.`,
    sourceIds: [subject.id],
    relationshipIds: candidate.relationshipIds,
  });
  const actualSeconds = Math.min(options.durationSeconds, beats.length * 10);
  const weights = beats.map((beat) =>
    beat.visual === "source" ? 1.7 : beat.visual === "title" ? 0.8 : 1.2,
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  let allocated = 0;
  beats.forEach((beat, index) => {
    beat.durationFrames =
      index === beats.length - 1
        ? actualSeconds * 30 - allocated
        : Math.floor((actualSeconds * 30 * weights[index]!) / sum);
    allocated += beat.durationFrames;
  });
  return {
    version: 1,
    family: candidate.family,
    title: candidate.title,
    question: candidate.question,
    reason: candidate.reason,
    audience: options.audience,
    purpose: options.purpose,
    targetDurationSeconds: options.durationSeconds,
    fps: { numerator: 30, denominator: 1 },
    beats,
    scriptStatus: "editorial-draft",
    limitations: [
      "Scripts and headings are editorial drafts. Review their usefulness and factual meaning before creating the film.",
      "Source relationships describe captured structure, not execution order, deployed architecture or measured outcomes.",
      ...(actualSeconds < options.durationSeconds
        ? [
            `Evidence supports a ${actualSeconds}-second draft; the requested ${options.durationSeconds} seconds needs more authored content.`,
          ]
        : []),
      ...(options.purpose === "review"
        ? ["This is a source review. Before/head change analysis has not been supplied."]
        : []),
      ...source.uncertainties
        .filter(
          (item) =>
            !item.path ||
            candidate.sourceIds.some(
              (id) =>
                source.observations.find((entry) => entry.id === id)?.evidence.path === item.path,
            ),
        )
        .slice(0, 6)
        .map((item) => item.message),
    ],
  };
}
export function planRepositoryStories(facts: RepositoryFacts, input?: unknown) {
  const options = parseStoryOptions(input);
  const candidates = discoverStoryCandidates(facts.understanding, options);
  return {
    options,
    stories: candidates.map((candidate) => ({
      key: candidate.key,
      story: composeStory(candidate, facts, options),
    })),
    warnings:
      candidates.length < options.count
        ? [
            `Found ${candidates.length} distinct source-supported stories for ${options.count} requested videos. Add implementation or richer documentation instead of duplicating a story.`,
          ]
        : [],
  };
}
