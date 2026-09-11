import { SaxesParser } from "saxes";

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function namespaceSvg(svg: string, namespace: string): string {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(namespace)) throw new Error("Invalid scene namespace.");
  const ids = new Map<string, string>();
  const collect = new SaxesParser({ xmlns: false });
  collect.on("doctype", () => {
    throw new Error("SVG document declarations are unsupported.");
  });
  collect.on("opentag", (tag) => {
    if (
      ["script", "foreignObject", "animate", "animateMotion", "animateTransform", "set"].includes(
        tag.name,
      )
    )
      throw new Error(`Active SVG element ${tag.name} is unsupported.`);
    const id = tag.attributes.id;
    if (typeof id === "string") {
      if (ids.has(id)) throw new Error(`Duplicate SVG ID ${id}.`);
      ids.set(id, `${namespace}-${id}`);
    }
  });
  collect.write(svg).close();
  const referenced = (id: string) => {
    const next = ids.get(id);
    if (!next) throw new Error(`Unresolved SVG reference ${id}.`);
    return next;
  };
  const parser = new SaxesParser({ xmlns: false });
  let result = "";
  parser.on("opentag", (tag) => {
    result += `<${tag.name}`;
    for (const [name, raw] of Object.entries(tag.attributes)) {
      if (/^on/i.test(name)) throw new Error("SVG event handlers are unsupported.");
      let value = String(raw);
      if (name === "id") value = referenced(value);
      if (["aria-labelledby", "aria-describedby"].includes(name))
        value = value.split(/\s+/).map(referenced).join(" ");
      if (name === "href" || name === "xlink:href") {
        if (value.startsWith("#")) value = `#${referenced(value.slice(1))}`;
        else if (!/^data:image\/(png|jpeg|webp);base64,/.test(value))
          throw new Error("Only resolved local image bytes may enter a diagram scene.");
      }
      value = value.replace(
        /url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g,
        (_, id) => `url(#${referenced(id)})`,
      );
      if (/url\(\s*(?!#)/i.test(value)) throw new Error("External SVG references are unsupported.");
      result += ` ${name}="${xml(value)}"`;
    }
    result += ">";
  });
  parser.on("closetag", (tag) => {
    result += `</${tag.name}>`;
  });
  parser.on("text", (value) => {
    result += xml(value);
  });
  parser.on("cdata", () => {
    throw new Error("SVG CDATA is unsupported.");
  });
  parser.write(svg).close();
  return result;
}
