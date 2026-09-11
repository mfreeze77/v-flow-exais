import type { ProjectSnapshot } from "@hyperframes/project-model";
import type { RepositoryFacts, SourceFile } from "./repositoryIntake";
import { planRepositoryStories } from "./storyPlanning";
import { storyToProposal } from "./storyProject";
import type { StoryPlan, StoryEvidence } from "./storyTypes";
export interface VideoProposal {
  id: string;
  title: string;
  angle: string;
  evidence: SourceFile[];
  snapshot: ProjectSnapshot;
  story?: StoryPlan;
  storyEvidence?: StoryEvidence[];
  planHash?: string;
}
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function createVideoProposals(facts: RepositoryFacts, options?: unknown): VideoProposal[] {
  return planRepositoryStories(facts, options).stories.map(({ key, story }) =>
    storyToProposal(key, story, facts),
  );
}
export function nativeTitle(
  title: string,
  subtitle: string,
  width = 1280,
  height = 720,
  duration = 2.5,
) {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="assets/gsap.min.js"></script><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#07101c}#title{width:100%;height:100%;box-sizing:border-box;padding:10%;display:flex;justify-content:center;flex-direction:column;background:radial-gradient(ellipse at 100% 0%,#184356,#07101c 65%);color:#e8f5f5;font-family:Arial,sans-serif}#title .kicker{font-size:15px;color:#5eead4;letter-spacing:5px}#title h1{font-size:64px;line-height:1.04;letter-spacing:-3px;max-width:1000px;margin:28px 0}#title p{font-size:24px;color:#9bafbf;max-width:1000px;line-height:1.5}</style></head><body><div id="title" data-composition-id="title" data-width="${width}" data-height="${height}" data-start="0" data-duration="${duration}"><div class="kicker">V-FLOW / REPOSITORY STORIES</div><h1>${escape(title)}</h1><p>${escape(subtitle)}</p><script>const tl=gsap.timeline({paused:true});tl.fromTo("#title h1",{y:55},{y:0,duration:0.2,ease:"power4.out",immediateRender:false},0);tl.fromTo("#title p",{y:40,opacity:0},{y:0,opacity:1,duration:0.18,ease:"power4.out",immediateRender:false},0.18);tl.to({},{duration:${duration}},0);window.__timelines=window.__timelines||{};window.__timelines["title"]=tl;</script></div></body></html>`;
}
