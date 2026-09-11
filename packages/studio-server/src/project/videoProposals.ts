import { randomUUID } from "node:crypto";
import type { ProjectSnapshot, ProjectScene, DiagramSource } from "@hyperframes/project-model";
import type { RepositoryFacts, SourceFile, SourcePackage } from "./repositoryIntake";

export interface VideoProposal {
  id: string;
  title: string;
  angle: string;
  evidence: SourceFile[];
  snapshot: ProjectSnapshot;
}
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (name: string) => name.replace(/^@[^/]+\//, "").slice(0, 26);

export function nativeTitle(
  title: string,
  subtitle: string,
  width = 1280,
  height = 720,
  duration = 2.5,
) {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="assets/gsap.min.js"></script><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#07101c}#title{width:100%;height:100%;box-sizing:border-box;padding:10%;display:flex;justify-content:center;flex-direction:column;background:radial-gradient(ellipse at 100% 0%,#184356,#07101c 65%);color:#e8f5f5;font-family:Arial,sans-serif}#title .kicker{font-size:15px;color:#5eead4;letter-spacing:5px}#title h1{font-size:64px;line-height:1.04;letter-spacing:-3px;max-width:1000px;margin:28px 0}#title p{font-size:24px;color:#9bafbf;max-width:1000px;line-height:1.5}</style></head><body><div id="title" data-composition-id="title" data-width="${width}" data-height="${height}" data-start="0" data-duration="${duration}"><div class="kicker">V-FLOW / REPOSITORY STORIES</div><h1>${escape(title)}</h1><p>${escape(subtitle)}</p><script>const tl=gsap.timeline({paused:true});tl.fromTo("#title h1",{y:55},{y:0,duration:0.2,ease:"power4.out",immediateRender:false},0);tl.fromTo("#title p",{y:40,opacity:0},{y:0,opacity:1,duration:0.18,ease:"power4.out",immediateRender:false},0.18);tl.to({},{duration:${duration}},0);window.__timelines=window.__timelines||{};window.__timelines["title"]=tl;</script></div></body></html>`;
}

function diagram(
  title: string,
  labels: string[],
  edges: { from: number; to: number; label: string }[] = [],
): DiagramSource {
  const fan = edges.length > 0;
  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title, viewBox: [900, 570], legend: { mode: "hidden" } },
    components: labels.map((label, index) => ({
      id: `object-${index}`,
      type: index === 0 && fan ? "frontend" : "backend",
      label: short(label),
      pos: fan
        ? index === 0
          ? [50, 135]
          : [330, 85 + (index - 1) * 100]
        : [60 + (index % 2) * 240, 80 + Math.floor(index / 2) * 110],
      size: [180, 70],
    })),
    connections: edges.map((edge) => ({
      id: `relationship-${randomUUID()}`,
      from: `object-${edge.from}`,
      to: `object-${edge.to}`,
      label: edge.label,
    })),
    cards: [],
  };
}

function proposal(
  id: string,
  title: string,
  angle: string,
  chapters: { title: string; subtitle: string; source: DiagramSource }[],
  evidence: SourceFile[],
): VideoProposal {
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      id: `video-${randomUUID()}`,
      title,
      revision: 0,
      documents: [{ id: "title", kind: "native", path: "title.html", authoritative: true }],
      scenes: [
        {
          id: "title-scene",
          kind: "native",
          documentId: "title",
          startFrame: 0,
          durationFrames: 75,
          presentation: { title, subtitle: angle, focusObjectIds: [], relationshipIds: [] },
        },
      ],
      output: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 } },
      policy: { sourceSharing: "private", htmlTrust: "trusted-local" },
    },
    sources: { title: nativeTitle(title, angle) },
  };
  let start = 75;
  chapters.forEach((chapter, index) => {
    const documentId = `diagram-${index}`;
    snapshot.manifest.documents.push({
      id: documentId,
      kind: "architecture",
      path: `${documentId}.architecture.json`,
      authoritative: true,
    });
    snapshot.sources[documentId] = chapter.source;
    const objects = chapter.source.components as { id: string }[];
    const edges = chapter.source.connections as { id: string }[];
    const scene: ProjectScene = {
      id: `chapter-${index}`,
      kind: "diagram",
      documentId,
      startFrame: start,
      durationFrames: 165,
      presentation: {
        title: chapter.title,
        subtitle: chapter.subtitle,
        focusObjectIds: objects.map((node) => node.id),
        relationshipIds: edges.map((edge) => edge.id),
      },
    };
    snapshot.manifest.scenes.push(scene);
    start += scene.durationFrames;
  });
  return {
    id,
    title,
    angle,
    evidence: [...new Map(evidence.map((item) => [item.path, item])).values()],
    snapshot,
  };
}

/** Deterministic source proposals. Repository prose is data, never instructions. */
export function createVideoProposals(facts: RepositoryFacts): VideoProposal[] {
  const title = short(facts.title);
  const owned = facts.packages.filter((item) => item.path !== "package.json").slice(0, 24);
  const inventory = owned.length ? owned : facts.packages;
  const names = inventory.length
    ? inventory.map((item) => item.name)
    : Object.keys(facts.languages);
  if (!names.length) names.push("Source project");
  const overview = Array.from({ length: Math.min(3, Math.ceil(names.length / 4)) }, (_, page) => ({
    title: page === 0 ? "What is in this project?" : `Source map / ${page + 1}`,
    subtitle: inventory.length
      ? `Package highlights from ${names.length} discovered packages. Each box comes from a source manifest.`
      : "Languages identified from source file extensions.",
    source: diagram("Source inventory", names.slice(page * 4, page * 4 + 4)),
  }));
  const byName = new Map(facts.packages.map((item) => [item.name, item]));
  const hubs = [...inventory]
    .sort(
      (a, b) =>
        b.dependencies.filter((name) => byName.has(name)).length -
        a.dependencies.filter((name) => byName.has(name)).length,
    )
    .slice(0, 3);
  const dependencies = hubs.map((hub) => {
    const deps = hub.dependencies.filter((name) => byName.has(name)).slice(0, 2);
    return {
      title: `${short(hub.name)} / dependencies`,
      subtitle: deps.length
        ? "Selected declared dependencies. Arrows mean “depends on”; they do not imply live traffic."
        : "This manifest declares no dependency on another discovered package.",
      source: diagram(
        "Declared dependencies",
        [hub.name, ...deps],
        deps.map((_, index) => ({ from: 0, to: index + 1, label: "depends on" })),
      ),
    };
  });
  const scriptPackages = [...facts.packages]
    .filter((item) => item.scripts.length)
    .sort((a, b) => (a.path === "package.json" ? -1 : b.scripts.length - a.scripts.length))
    .slice(0, 3);
  const commands = scriptPackages.map((item) => {
    const scripts = [...item.scripts]
      .sort(
        (a, b) =>
          Number(/^(build|test|studio|dev)/.test(b)) - Number(/^(build|test|studio|dev)/.test(a)),
      )
      .slice(0, 2);
    return {
      title: `${short(item.name)} / available commands`,
      subtitle: `Script names declared in ${item.path}. Source inspection does not execute them.`,
      source: diagram(
        "Declared scripts",
        [item.name, ...scripts],
        scripts.map((_, index) => ({ from: 0, to: index + 1, label: "defines" })),
      ),
    };
  });
  const evidence = inventory.map((item) => item.citation);
  const fallback = [
    {
      title: "Source languages",
      subtitle: `${facts.fileCount} admitted source paths. Counts describe the inspected snapshot.`,
      source: diagram(
        "Languages",
        Object.entries(facts.languages)
          .slice(0, 6)
          .map(([name, count]) => `${name}: ${count}`),
      ),
    },
  ];
  return [
    proposal(
      "overview",
      `${title} / project tour`,
      "A visual tour of the inspected source snapshot.",
      overview,
      evidence,
    ),
    proposal(
      "dependencies",
      `${title} / dependency story`,
      "Follow relationships that are explicitly declared in source.",
      dependencies.length ? dependencies : fallback,
      hubs.map((item) => item.citation),
    ),
    proposal(
      "commands",
      `${title} / developer entry points`,
      "Explore the commands and languages available to a contributor.",
      commands.length ? commands : fallback,
      scriptPackages.map((item) => item.citation),
    ),
  ];
}
