import { posix } from "node:path";
import type {
  RepositoryUnderstanding,
  SourceObservation,
  SourceRelationship,
} from "./repositoryUnderstanding";
import type { StoryCandidate, StoryOptions } from "./storyTypes";

const name = (item: SourceObservation) =>
  item.kind === "module" ? posix.basename(item.name) : item.name;
function neighborhood(subject: SourceObservation, source: RepositoryUnderstanding) {
  const edges: SourceRelationship[] = [];
  const ids = new Set([subject.id]);
  // This is an authored subgraph, never a sequence made from a focus list.
  for (const id of [...ids]) {
    for (const edge of source.relationships.filter((item) => item.from === id).slice(0, 3)) {
      if (ids.size >= 5 && !ids.has(edge.to)) continue;
      edges.push(edge);
      ids.add(edge.to);
    }
  }
  return { sourceIds: [...ids], relationshipIds: edges.map((edge) => edge.id) };
}
function connectionCandidate(
  subject: SourceObservation,
  source: RepositoryUnderstanding,
): StoryCandidate | null {
  const graph = neighborhood(subject, source);
  if (!graph.relationshipIds.length) return null;
  const api = subject.kind === "api";
  const module = subject.kind === "module";
  const entryWeight = subject.summary.includes(" exported as ")
    ? 10
    : subject.name.includes(".") || module || api
      ? 0
      : -20;
  return {
    key: `connections:${subject.id}`,
    family: api ? "feature" : "architecture",
    subjectId: subject.id,
    ...graph,
    score: (api ? 95 : module ? 68 : 78) + graph.relationshipIds.length * 4 + entryWeight,
    title: api
      ? `Inside ${name(subject)}`
      : module
        ? `The responsibilities around ${name(subject)}`
        : `What ${name(subject)} delegates`,
    question: api
      ? `Where is ${name(subject)} handled?`
      : `Which parts does ${name(subject)} rely on?`,
    reason: `${graph.relationshipIds.length} captured ${module ? "import" : "connection"} sites connect this entry to implementation you can inspect.`,
  };
}
function isolatedCandidate(subject: SourceObservation): StoryCandidate | null {
  const base = { subjectId: subject.id, sourceIds: [subject.id], relationshipIds: [] };
  if (subject.kind === "model" && subject.fields?.length)
    return {
      ...base,
      key: `model:${subject.id}`,
      family: "data-model",
      score: 75 + Math.min(12, subject.fields.length),
      title: `Read the ${subject.name} contract`,
      question: `What information does ${subject.name} carry?`,
      reason: `${subject.fields.length} declared fields give contributors a concrete data contract to learn.`,
    };
  if (subject.kind === "api")
    return {
      ...base,
      key: `api:${subject.id}`,
      family: "feature",
      score: 62,
      title: `Locate ${subject.name}`,
      question: `Where does the source register ${subject.name}?`,
      reason:
        "The registration is captured even though its runtime handler cannot yet be resolved.",
    };
  if (subject.kind === "documentation" && subject.evidence.text.length > 90)
    return {
      ...base,
      key: `docs:${subject.id}`,
      family: "product",
      score: /readme/i.test(subject.evidence.path) ? 85 : 50,
      title: `${subject.name}: the documented story`,
      question: `What does the project say about ${subject.name}?`,
      reason:
        "A product explanation can start from this documentation claim, subject to factual review.",
    };
  return null;
}
function relevance(candidate: StoryCandidate, options: StoryOptions) {
  const audience = options.audience === "new-users" && candidate.family === "product" ? 35 : 0;
  const onboarding = options.purpose === "onboard" && candidate.family === "data-model" ? 20 : 0;
  const maintainers =
    options.audience === "maintainers" && candidate.family === "architecture" ? 15 : 0;
  return candidate.score + audience + onboarding + maintainers;
}
export function discoverStoryCandidates(
  source: RepositoryUnderstanding,
  options: StoryOptions,
): StoryCandidate[] {
  const candidates = source.observations
    .flatMap((subject) => {
      const connected = connectionCandidate(subject, source);
      const isolated = isolatedCandidate(subject);
      return connected ? [connected] : isolated ? [isolated] : [];
    })
    .sort((a, b) => relevance(b, options) - relevance(a, options) || a.key.localeCompare(b.key));
  const selected: StoryCandidate[] = [];
  while (selected.length < options.count && candidates.length) {
    // Spend the next film on a different question and evidence, not a recolored copy.
    candidates.sort((a, b) => adjusted(b) - adjusted(a) || a.key.localeCompare(b.key));
    const next = candidates.shift()!;
    if (selected.some((item) => item.subjectId === next.subjectId)) continue;
    selected.push(next);
  }
  return selected;
  function adjusted(item: StoryCandidate) {
    const repeatedFamily =
      selected.filter((previous) => previous.family === item.family).length * 40;
    const overlap = selected.reduce(
      (sum, previous) =>
        sum + previous.sourceIds.filter((id) => item.sourceIds.includes(id)).length,
      0,
    );
    return relevance(item, options) - repeatedFamily - overlap * 14;
  }
}
