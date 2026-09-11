import { randomUUID } from "node:crypto";
import type { ProjectSnapshot, DiagramSource } from "@hyperframes/project-model";
import { canonicalJson, sha256 } from "@hyperframes/project-model/revisions";
import type { RepositoryFacts } from "./repositoryIntake";
import { storyEvidence } from "./storyPlanning";
import { storySceneHtml } from "./storySceneHtml";
import type { StoryPlan, StoryBeat } from "./storyTypes";
import type { VideoProposal } from "./videoProposals";

function diagramSource(beat: StoryBeat, facts: RepositoryFacts): DiagramSource {
  const nodes = beat.sourceIds.map(
    (id) => facts.understanding.observations.find((item) => item.id === id)!,
  );
  const ids = new Map(nodes.map((item, index) => [item.id, `object-${index}`]));
  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title: beat.heading, viewBox: [1050, 590], legend: { mode: "hidden" } },
    components: nodes.map((item, index) => ({
      id: ids.get(item.id),
      type: index ? "backend" : "frontend",
      label: item.name,
      pos: index ? [520, 70 + (index - 1) * 115] : [90, 170],
      size: [340, 84],
    })),
    connections: beat.relationshipIds.map((id) => {
      const edge = facts.understanding.relationships.find((item) => item.id === id)!;
      return { id, from: ids.get(edge.from), to: ids.get(edge.to), label: edge.kind };
    }),
    cards: [],
  };
}
export function storyToProposal(
  key: string,
  story: StoryPlan,
  facts: RepositoryFacts,
  projectId = `video-${randomUUID()}`,
): VideoProposal {
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      id: projectId,
      revision: 0,
      title: story.title,
      documents: [],
      scenes: [],
      output: { width: 1280, height: 720, fps: story.fps },
      policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
    },
    sources: {},
  };
  let startFrame = 0;
  story.beats.forEach((beat, index) => {
    const docId = `story-${index}`;
    const diagram = beat.visual === "diagram";
    snapshot.manifest.documents.push({
      id: docId,
      kind: diagram ? "architecture" : "native",
      path: diagram ? `${docId}.architecture.json` : `${docId}.html`,
      authoritative: true,
    });
    const sceneEvidence =
      beat.visual === "source" ? [...beat.relationshipIds, ...beat.sourceIds] : beat.sourceIds;
    snapshot.sources[docId] = diagram
      ? diagramSource(beat, facts)
      : storySceneHtml(
          story,
          beat,
          storyEvidence(sceneEvidence, facts.understanding),
          facts.understanding.observations.find((item) => item.id === beat.sourceIds[0])?.fields ||
            [],
          index,
        );
    snapshot.manifest.scenes.push({
      id: beat.id,
      kind: diagram ? "diagram" : "native",
      documentId: docId,
      startFrame,
      durationFrames: beat.durationFrames,
      presentation: {
        title: beat.heading,
        subtitle: diagram
          ? "Arrows show captured source relationships. They do not assert runtime order."
          : "",
        focusObjectIds: diagram ? beat.sourceIds.map((_, i) => `object-${i}`) : [],
        relationshipIds: diagram ? beat.relationshipIds : [],
      },
    });
    startFrame += beat.durationFrames;
  });
  const evidence = storyEvidence(
    story.beats.flatMap((beat) => [...beat.sourceIds, ...beat.relationshipIds]),
    facts.understanding,
  );
  const hash = sha256(canonicalJson(story));
  return {
    id: `story-${sha256(key).slice(0, 20)}`,
    title: story.title,
    angle: story.reason,
    evidence: [...new Map(evidence.map((item) => [item.excerpt.path, item.excerpt])).values()],
    snapshot,
    story,
    storyEvidence: evidence,
    planHash: hash,
  };
}
