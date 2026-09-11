import type { DiagramArtifact, Bounds } from "@hyperframes/diagram-engine";

export function frameDiagram(
  artifact: DiagramArtifact,
  focus: string[],
  width: number,
  height: number,
  relationships: string[] = [],
) {
  const bounds: Bounds[] = focus.length
    ? focus.map((id) => {
        const node = artifact.objects.find((item) => item.id === id);
        if (!node) throw new Error(`Missing focus object ${id}.`);
        return node.bounds;
      })
    : [{ x: 0, y: 0, width: artifact.viewBox[2], height: artifact.viewBox[3] }];
  for (const id of relationships) {
    const edge = artifact.relationships.find((item) => item.id === id);
    if (!edge) throw new Error(`Missing authored relationship ${id}.`);
    bounds.push(...edge.points.map(([x, y]) => ({ x, y, width: 0, height: 0 })));
  }
  const minX = Math.min(...bounds.map((b) => b.x)) - 30;
  const minY = Math.min(...bounds.map((b) => b.y)) - 32;
  const maxX = Math.max(...bounds.map((b) => b.x + b.width)) + 30;
  const maxY = Math.max(...bounds.map((b) => b.y + b.height)) + 32;
  const scale = Math.min(3.6, (width * 0.88) / (maxX - minX), (height * 0.68) / (maxY - minY));
  return {
    scale,
    x: (width - (maxX - minX) * scale) / 2 - minX * scale,
    y: height * 0.22 + (height * 0.68 - (maxY - minY) * scale) / 2 - minY * scale,
  };
}
