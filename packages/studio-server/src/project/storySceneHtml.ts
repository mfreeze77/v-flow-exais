import type { StoryPlan, StoryBeat, StoryEvidence } from "./storyTypes";

const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const js = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
const palette = {
  architecture: "#91e6d1",
  feature: "#cfb8ff",
  "data-model": "#f5c780",
  product: "#a7c8ff",
};
function excerptBody(evidence: StoryEvidence) {
  const lines: string[] = [];
  let rows = 0;
  const sourceLines = evidence.excerpt.text.split("\n");
  if (sourceLines[0]!.length > 300) {
    const start = Math.max(0, (evidence.excerpt.focusColumn || 0) - 70);
    sourceLines[0] = `${start ? "… " : ""}${sourceLines[0]!.slice(start, start + 300)}${start + 300 < sourceLines[0]!.length ? " …" : ""}`;
  }
  for (const line of sourceLines.slice(0, 6)) {
    const cost = Math.max(1, Math.ceil(line.length / 54));
    if (rows + cost > 8) break;
    lines.push(line);
    rows += cost;
  }
  if (!lines.length) lines.push(evidence.excerpt.text.slice(0, 300) + " …");
  return `<div class="source-window"><div class="file-tab">${esc(evidence.excerpt.path)}</div><div class="code">${lines.map((line, index) => `<div class="source-line reveal"><span>${evidence.excerpt.startLine + index}</span><code>${esc(line)}</code></div>`).join("")}</div></div><aside><div class="label">${evidence.classification === "documented-claim" ? "DOCUMENTATION CLAIM" : "CAPTURED SOURCE"}</div><h2>${esc(evidence.name)}</h2><p class="reveal">${esc(evidence.statement)}</p><div class="location reveal">${esc(evidence.excerpt.path)}<br>Lines ${evidence.excerpt.startLine}–${evidence.excerpt.endLine}</div></aside>`;
}
function sceneBody(beat: StoryBeat, evidence: StoryEvidence[], fields: string[]) {
  const first = evidence[0]!;
  if (beat.visual === "source") return `<div class="source-layout">${excerptBody(first)}</div>`;
  if (beat.visual === "model")
    return `<div class="contract-layout"><div><div class="label">DATA CONTRACT</div><h2>${esc(first.name)}</h2><p>${esc(first.statement)}</p></div><div class="fields">${fields
      .slice(0, 6)
      .map(
        (field, index) =>
          `<div class="field reveal"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(field)}</strong></div>`,
      )
      .join("")}</div></div>`;
  if (beat.visual === "takeaway")
    return `<div class="takeaway"><div class="label">TAKE IT BACK TO THE SOURCE</div><h2 class="reveal">${esc(first.name)}</h2><p class="reveal">${esc(beat.script)}</p><div class="location reveal">${esc(first.excerpt.path)}:${first.excerpt.startLine}</div></div>`;
  return `<div class="opening"><div class="label reveal">ONE QUESTION · REAL SOURCE</div><h2 class="reveal">${esc(beat.heading)}</h2><div class="opening-source reveal"><span>Start here</span><strong>${esc(first.excerpt.path)}</strong></div></div>`;
}
/** Native editorial surfaces remain editable source; all quoted content is escaped. */
export function storySceneHtml(
  story: StoryPlan,
  beat: StoryBeat,
  evidence: StoryEvidence[],
  fields: string[],
  index: number,
) {
  const id = `story-${index}`;
  const seconds = (beat.durationFrames * story.fps.denominator) / story.fps.numerator;
  const body = sceneBody(beat, evidence, fields);
  const reveals = (body.match(/reveal/g) || []).length;
  const step = Math.min(0.8, Math.max(0.08, (seconds - 2.4) / Math.max(1, reveals - 1)));
  return `<!doctype html><html><head><meta charset="utf-8"><script src="assets/gsap.min.js"></script><style>
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#101722}
#${id}{position:relative;box-sizing:border-box;width:1280px;height:720px;padding:48px 64px;color:#edf0f5;background:#101722;font-family:Arial,sans-serif;--accent:${palette[story.family]}}
#${id} *{box-sizing:border-box}#${id} header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff25;padding-bottom:17px;font-size:15px;letter-spacing:2px;color:#b3bfd0}
#${id} header b{color:var(--accent)}#${id} .heading{font-size:34px;line-height:1.16;letter-spacing:-.8px;margin:24px 0;max-width:1152px;overflow-wrap:anywhere}
#${id} .label{font-size:14px;letter-spacing:2px;color:var(--accent);margin-bottom:18px}#${id} p{font-size:23px;line-height:1.4;color:#c4cedd;overflow-wrap:anywhere}#${id} h2{margin:0 0 20px;overflow-wrap:anywhere}
#${id} .source-layout{display:grid;grid-template-columns:760px 1fr;gap:32px;align-items:start}#${id} .source-window{background:#080e16;border:1px solid #455165;border-radius:10px;overflow:hidden}#${id} .file-tab{padding:15px 22px;border-bottom:1px solid #455165;font-size:17px;color:var(--accent);overflow-wrap:anywhere}
#${id} .code{padding:22px 12px;max-height:360px;overflow:hidden}#${id} .source-line{display:grid;grid-template-columns:38px minmax(0,1fr);gap:12px;min-height:34px;line-height:1.55;font-family:monospace;font-size:19px}#${id} .source-line>span{text-align:right;color:#788da5}#${id} code{white-space:pre-wrap;overflow-wrap:anywhere}#${id} aside h2{font-size:30px}#${id} aside p{font-size:20px;margin:14px 0}
#${id} .location{font-family:monospace;font-size:17px;line-height:1.5;color:var(--accent);overflow-wrap:anywhere;border-left:3px solid var(--accent);padding-left:14px;margin-top:24px}
#${id} .opening{padding:48px 28px 0;max-width:1110px}#${id} .opening h2{font-size:62px;line-height:1.09;letter-spacing:-2px;max-width:1020px}#${id} .opening-source{display:flex;flex-direction:column;gap:14px;margin-top:42px;font-size:23px;overflow-wrap:anywhere}#${id} .opening-source span{font-size:16px;color:#9cacc0}#${id} .opening-source strong{font-weight:500;color:var(--accent)}
#${id} .contract-layout{display:grid;grid-template-columns:1fr 1.2fr;gap:60px;margin-top:28px}#${id} .contract-layout h2{font-size:46px}#${id} .fields{display:grid;gap:12px}#${id} .field{border-bottom:1px solid #ffffff25;padding:12px;display:flex;align-items:center;gap:30px;font-size:28px}#${id} .field span{font-size:16px;color:var(--accent)}#${id} .field strong{overflow-wrap:anywhere}
#${id} .takeaway{padding:40px 36px;max-width:1080px}#${id} .takeaway h2{font-size:58px;line-height:1.08;letter-spacing:-1.5px;color:var(--accent)}#${id} .takeaway p{font-size:29px;max-width:1000px}
#${id} footer{position:absolute;bottom:28px;left:64px;right:64px;display:flex;justify-content:space-between;font-size:13px;color:#a6b5c9;letter-spacing:1px}
</style></head><body><div id="${id}" data-composition-id="${id}" data-width="1280" data-height="720" data-start="0" data-duration="${seconds}"><header><b>V-FLOW / ${esc(story.family.toUpperCase())}</b><span>${String(index + 1).padStart(2, "0")} / ${String(story.beats.length).padStart(2, "0")}</span></header>${beat.visual === "title" ? "" : `<h1 class="heading">${esc(beat.heading)}</h1>`}${body}<footer><span>${esc(story.audience.toUpperCase())} · ${esc(story.purpose.toUpperCase())}</span><span>${beat.visual === "source" ? "SOURCE READING · CAPTURED SNAPSHOT" : "SOURCE-BASED EDITORIAL DRAFT"}</span></footer><script>
const tl=gsap.timeline({paused:true});
gsap.set(${js(`#${id} .reveal`)},{y:22,opacity:0});
tl.fromTo(${js(`#${id} .reveal`)},{y:22,opacity:0},{y:0,opacity:1,duration:0.2,stagger:${step},ease:"power4.out",immediateRender:false},0.4);
tl.to({},{duration:${seconds}},0);window.__timelines=window.__timelines||{};window.__timelines[${js(id)}]=tl;
</script></div></body></html>`;
}
