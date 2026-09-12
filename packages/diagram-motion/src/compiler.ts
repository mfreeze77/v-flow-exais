import {
  compileDiagram,
  ENGINE_VERSION,
  type DiagramArtifact,
  type DiagramSource,
} from "@hyperframes/diagram-engine";
import {
  assertProject,
  compileSceneBindings,
  type ProjectSnapshot,
  type ProjectScene,
} from "@hyperframes/project-model";
import { scopeCssToComposition, validateHyperframeHtmlContract } from "@hyperframes/core/compiler";
import { namespaceSvg } from "./namespaceSvg";
import { frameDiagram } from "./camera";

export const MOTION_VERSION = "1.1.0";
const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const js = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
export type CompositionBuild = {
  files: Record<string, string>;
  artifacts: Record<string, DiagramArtifact>;
  receipt: Record<string, unknown>;
  ledger: { fps: number; seams: any[] };
};
const geometryCache = new Map<string, DiagramArtifact>();

function sceneHtml(
  scene: ProjectScene,
  artifact: DiagramArtifact,
  output: ProjectSnapshot["manifest"]["output"],
  id: string,
) {
  const { width, height, fps } = output;
  const duration = (scene.durationFrames * fps.denominator) / fps.numerator;
  if (duration < 1.5)
    throw new Error("A managed scene needs at least 1.5 seconds for readable motion.");
  const camera = frameDiagram(
    artifact,
    scene.presentation.focusObjectIds,
    width,
    height,
    scene.presentation.relationshipIds,
  );
  const selectedEdges = scene.presentation.relationshipIds.map((edgeId) => {
    const edge = artifact.relationships.find((item) => item.id === edgeId);
    if (!edge || !edge.path) throw new Error(`Authored edge ${edgeId} has no compiled route.`);
    return edge;
  });
  const overlays = selectedEdges
    .map(
      (edge, index) =>
        `<path id="${id}-signal-${index}" data-vflow-relationship-id="${esc(edge.id!)}" data-vflow-from="${esc(edge.from)}" data-vflow-to="${esc(edge.to)}" d="${esc(edge.path)}" fill="none" stroke="#5eead4" stroke-width="2.6" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`,
    )
    .join("");
  const svg = namespaceSvg(artifact.svg, id).replace("</svg>", `${overlays}</svg>`);
  const css = scopeCssToComposition(
    artifact.styles.replaceAll("JetBrains Mono", `${id} Diagram Mono`),
    id,
    `#${id}`,
    null,
    { scopeRootSelectors: true },
  );
  if (!css) throw new Error("Could not scope diagram stylesheet.");
  const timelines: string[] = [];
  const focus = scene.presentation.focusObjectIds.length
    ? scene.presentation.focusObjectIds
    : artifact.objects.map((node) => node.id);
  focus.forEach((nodeId, index) => {
    const selector = `#${id} [data-node-id=${JSON.stringify(nodeId)}]`;
    const start = 0.25 + Math.min(index, 6) * 0.09;
    timelines.push(
      `tl.fromTo(${js(selector)}, {opacity:0.2}, {opacity:1, duration:0.2, ease:"none", immediateRender:false}, ${start});`,
    );
  });
  selectedEdges.forEach((edge, index) => {
    const first = Math.min(1, duration * 0.25);
    const step = (duration - first - 0.4) / selectedEdges.length;
    const start = first + index * step;
    timelines.push(
      `tl.fromTo("#${id}-signal-${index}", {strokeDashoffset:1}, {strokeDashoffset:0, autoRound:false, duration:${Math.min(1.05, step * 0.9)}, ease:"none", immediateRender:false}, ${start});`,
    );
  });
  return `<!doctype html><html><head><meta charset="utf-8"><script src="assets/gsap.min.js"></script><style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#07101c}
${css}
#${id}{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(ellipse at 80% 0%,#123345,#07101c 64%);color:#e8f5f5;font-family:Arial,sans-serif}
#${id} .scene-heading{position:absolute;top:6%;left:6%;right:6%;z-index:3}
#${id} .scene-heading h1{font-size:${Math.round(width * 0.032)}px;line-height:1.15;letter-spacing:-1px;margin:8px 0 10px;font-weight:650}
#${id} .scene-heading p{font-size:${Math.round(width * 0.014)}px;color:#9bafbf;margin:0;max-width:92%}
#${id} .eyebrow{color:#5eead4;font-size:${Math.round(width * 0.009)}px;letter-spacing:3px;text-transform:uppercase}
#${id} .diagram-camera{position:absolute;left:0;top:0;transform-origin:0 0;transform:translate(${camera.x}px,${camera.y}px) scale(${camera.scale})}
#${id} .diagram-camera>svg{display:block;width:${artifact.viewBox[2]}px;height:${artifact.viewBox[3]}px}
#${id} .source-note{position:absolute;bottom:4%;left:6%;color:#607e91;font-size:${Math.round(width * 0.009)}px;letter-spacing:1px}
</style></head><body><div id="${id}" data-composition-id="${id}" data-width="${width}" data-height="${height}" data-start="0" data-duration="${duration}" data-vflow-scene-id="${esc(scene.id)}" data-vflow-source-hash="${artifact.sourceHash}">
<header class="scene-heading" data-vflow-owner="presentation"><div class="eyebrow">V-FLOW / SOURCE WALKTHROUGH</div><h1>${esc(scene.presentation.title)}</h1><p>${esc(scene.presentation.subtitle || "")}</p></header>
<div class="diagram-camera" data-vflow-owner="compiler" data-theme="${artifact.theme}" data-preset="${artifact.preset}">${svg}</div>
<div class="source-note">${artifact.kind.toUpperCase()} · ${artifact.objects.length} OBJECTS · ${artifact.relationships.length} AUTHORED RELATIONSHIPS</div>
<script>const tl=gsap.timeline({paused:true});
${timelines.join("\n")}
tl.to({}, {duration:${duration}}, 0);
window.__timelines=window.__timelines||{};window.__timelines[${js(id)}]=tl;
</script></div></body></html>`;
}

/** Emit standard external compositions; the retained inliner owns child clocks. */
export async function compileProject(snapshot: ProjectSnapshot): Promise<CompositionBuild> {
  assertProject(snapshot);
  const { manifest } = snapshot;
  const files: Record<string, string> = {};
  const artifacts: Record<string, DiagramArtifact> = {};
  for (const doc of manifest.documents) {
    if (doc.kind === "native") continue;
    const source = snapshot.sources[doc.id] as DiagramSource;
    const key = JSON.stringify(source);
    const cached = geometryCache.get(key);
    const result = cached
      ? { ok: true as const, artifact: structuredClone(cached) }
      : await compileDiagram({ kind: doc.kind, source });
    if (!result.ok)
      throw Object.assign(new Error(result.diagnostics.map((entry) => entry.message).join("\n")), {
        diagnostics: result.diagnostics,
      });
    artifacts[doc.id] = result.artifact;
    if (!cached) {
      geometryCache.set(key, structuredClone(result.artifact));
      if (geometryCache.size > 32) geometryCache.delete(geometryCache.keys().next().value!);
    }
  }
  const second = (frame: number) =>
    (frame * manifest.output.fps.denominator) / manifest.output.fps.numerator;
  const durationFrames = Math.max(
    ...manifest.scenes.map((scene) => scene.startFrame + scene.durationFrames),
  );
  const duration = second(durationFrames);
  const ledger: CompositionBuild["ledger"] = {
    fps: manifest.output.fps.numerator / manifest.output.fps.denominator,
    seams: [],
  };
  const sceneBindings = compileSceneBindings(snapshot);
  const wrappers: string[] = [];
  const motion: string[] = [];
  for (const [index, scene] of manifest.scenes.entries()) {
    const binding = sceneBindings[index]!;
    const id = binding.renderId;
    const file = binding.outputPath;
    if (scene.kind === "diagram")
      files[file] = sceneHtml(scene, artifacts[scene.documentId]!, manifest.output, id);
    else {
      if (manifest.policy.htmlTrust !== "trusted-local")
        throw new Error("Trust local native HTML before compiling active content.");
      files[file] = String(snapshot.sources[scene.documentId]);
      const contract = await validateHyperframeHtmlContract(files[file]);
      if (!contract.isValid)
        throw new Error(
          `Native composition violates the retained contract: ${contract.missingKeys.join(" ")}`,
        );
    }
    wrappers.push(
      `<div id="el-${index}" data-composition-id="slot-${index}" data-composition-src="${file}" data-start="${second(scene.startFrame)}" data-duration="${second(scene.durationFrames)}" data-track-index="${index % 2}" data-vflow-scene-id="${esc(scene.id)}" data-vflow-document-id="${esc(scene.documentId)}" data-vflow-edit-owner="${binding.editOwner}" style="position:absolute;inset:0"></div>`,
    );
    motion.push(`gsap.set("#el-${index}", {autoAlpha:${index ? 0 : 1}, xPercent:0});`);
    if (index > 0) {
      const cut = second(scene.startFrame);
      ledger.seams.push({
        id: `${manifest.scenes[index - 1]!.id}→${scene.id}`,
        cut,
        technique: "cut-the-curve LEFT",
        exit: { selector: `#el-${index - 1}`, axis: "x", dir: -1, dur: 0.34 },
        entry: { selector: `#el-${index}`, axis: "x", dir: -1, dur: 0.34, travel: 12 },
      });
      motion.push(`tl.to("#el-${index - 1}", {xPercent:-12,autoAlpha:0,duration:0.34,ease:"power4.in"}, ${cut - 0.34});
tl.set("#el-${index - 1}", {autoAlpha:0}, ${cut});
tl.fromTo("#el-${index}", {xPercent:12,autoAlpha:0.35}, {xPercent:0,autoAlpha:1,duration:0.34,ease:"power4.out",immediateRender:false}, ${cut});`);
    }
  }
  files["index.html"] =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="vflow-project" content="${esc(manifest.id)}"><meta name="vflow-revision" content="${manifest.revision}"><script src="assets/gsap.min.js"></script><style>html,body{margin:0;width:${manifest.output.width}px;height:${manifest.output.height}px;overflow:hidden;background:#07101c}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#07101c}</style></head><body><div id="root" data-composition-id="main" data-width="${manifest.output.width}" data-height="${manifest.output.height}" data-start="0" data-duration="${duration}">${wrappers.join("\n")}<script>const tl=gsap.timeline({paused:true});
${motion.join("\n")}
tl.to({}, {duration:${duration}}, 0);
window.__timelines=window.__timelines||{};window.__timelines["main"]=tl;
</script></div></body></html>`;
  files["ledger.json"] = JSON.stringify(ledger, null, 2);
  return {
    files,
    artifacts,
    ledger,
    receipt: {
      schemaVersion: 1,
      projectId: manifest.id,
      revision: manifest.revision,
      durationFrames,
      output: manifest.output,
      engineVersion: ENGINE_VERSION,
      motionVersion: MOTION_VERSION,
      sources: Object.fromEntries(
        Object.entries(artifacts).map(([id, artifact]) => [
          id,
          { sourceHash: artifact.sourceHash, artifactHash: artifact.artifactHash },
        ]),
      ),
      sceneIds: manifest.scenes.map((scene) => scene.id),
      sceneBindings,
    },
  };
}
