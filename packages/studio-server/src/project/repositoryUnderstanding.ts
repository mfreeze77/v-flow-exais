import { createHash } from "node:crypto";
import { posix } from "node:path";
import { inspectRepositorySyntax, type RepositorySyntax } from "@hyperframes/parsers";
import type { SourceFile } from "./repositoryIntake";

export interface SourceExcerpt extends SourceFile {
  startLine: number;
  endLine: number;
  text: string;
  /** Zero-based call-site column, retained so long source lines can be framed accurately. */
  focusColumn?: number;
}
export interface SourceObservation {
  id: string;
  kind: "module" | "function" | "class" | "model" | "api" | "documentation" | "entrypoint";
  name: string;
  summary: string;
  basis: "syntax" | "documented" | "manifest";
  evidence: SourceExcerpt;
  fields?: string[];
}
export interface SourceRelationship {
  id: string;
  kind: "imports" | "calls" | "registers-handler";
  from: string;
  to: string;
  evidence: SourceExcerpt;
  description: string;
}
export interface RepositoryUnderstanding {
  version: 1;
  observations: SourceObservation[];
  relationships: SourceRelationship[];
  uncertainties: { code: string; message: string; path?: string; line?: number }[];
  coverage: {
    capturedFiles: number;
    parsedFiles: number;
    documentedFiles: number;
    unsupportedFiles: string[];
  };
}
export interface CapturedSource {
  file: SourceFile;
  content: string;
}
const identity = (...parts: string[]) =>
  `source-${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24)}`;
const implementation = /\.[cm]?[jt]sx?$/i;
const sourceLanguages = /\.(py|go|rs|java|cs|rb|php|swift|kt|c|cpp|h)$/i;

function sourceExcerpt(
  source: CapturedSource,
  startLine: number,
  endLine = startLine,
): SourceExcerpt {
  const lines = source.content.split(/\r\n|\n|\r/);
  const end = Math.min(lines.length, endLine, startLine + 11);
  return {
    ...source.file,
    startLine,
    endLine: end,
    text: lines.slice(startLine - 1, end).join("\n"),
  };
}

/** Analyze the captured bytes, never live files or executable repository policy. */
export function understandRepository(sources: CapturedSource[]): RepositoryUnderstanding {
  const result: RepositoryUnderstanding = {
    version: 1,
    observations: [],
    relationships: [],
    uncertainties: [
      {
        code: "static-only",
        message:
          "Imports, call sites and route registrations describe source structure. Execution order, deployed routes, runtime traffic and product effectiveness require separate evidence.",
      },
    ],
    coverage: {
      capturedFiles: sources.length,
      parsedFiles: 0,
      documentedFiles: 0,
      unsupportedFiles: [],
    },
  };
  const captured = new Map(sources.map((item) => [item.file.path, item]));
  const parsed = new Map<string, RepositorySyntax>();
  const declarations = new Map<string, SourceObservation>();
  const moduleId = (path: string) => identity(path, "module");
  const add = (item: SourceObservation) => {
    result.observations.push(item);
    return item;
  };
  for (const source of sources) {
    const path = source.file.path;
    if (implementation.test(path)) {
      const syntax = inspectRepositorySyntax(path, source.content);
      parsed.set(path, syntax);
      if (!syntax.diagnostics.length) result.coverage.parsedFiles++;
      for (const message of syntax.diagnostics)
        result.uncertainties.push({ code: "syntax-unavailable", path, message });
      add({
        id: moduleId(path),
        kind: "module",
        name: path,
        summary: `${path}: ${syntax.declarations.length} declarations, ${syntax.routes.length} route registration sites.`,
        basis: "syntax",
        evidence: sourceExcerpt(source, 1, 4),
      });
      for (const declaration of syntax.declarations) {
        const key = `${path}#${declaration.name}`;
        // Duplicate declarations/overloads are explicitly ambiguous and cannot
        // be silently paired by endpoint/name alone.
        const observation = add({
          id: identity(path, declaration.kind, declaration.name, String(declaration.line)),
          kind: declaration.kind,
          name: declaration.name,
          summary: `${declaration.kind === "model" ? "Data type" : declaration.kind} ${declaration.name}${declaration.exportedAs.length ? ` exported as ${declaration.exportedAs.join(", ")}` : ""}${declaration.fields.length ? `; fields: ${declaration.fields.join(", ")}` : ""}.`,
          basis: "syntax",
          evidence: sourceExcerpt(source, declaration.line, declaration.endLine),
          fields: declaration.fields,
        });
        if (declarations.has(key)) {
          declarations.delete(key);
          result.uncertainties.push({
            code: "ambiguous-declaration",
            path,
            line: declaration.line,
            message: `${declaration.name} has multiple declarations; call target resolution is withheld.`,
          });
        } else if (
          !result.uncertainties.some(
            (item) =>
              item.code === "ambiguous-declaration" &&
              item.path === path &&
              item.message.startsWith(`${declaration.name} `),
          )
        )
          declarations.set(key, observation);
      }
    } else if (/\.(md|mdx|rst)$/i.test(path)) {
      result.coverage.documentedFiles++;
      const lines = source.content.split(/\r\n|\n|\r/);
      let fenced = false;
      for (let index = 0; index < lines.length; index++) {
        if (/^\s*(```|~~~)/.test(lines[index]!)) {
          fenced = !fenced;
          continue;
        }
        if (fenced || !/^#{1,3}\s+/.test(lines[index]!)) continue;
        const heading = lines[index]!.replace(/^#+\s+/, "").trim();
        let end = index + 1;
        while (end < Math.min(lines.length, index + 9) && !/^#|^\s*(```|~~~)/.test(lines[end]!))
          end++;
        add({
          id: identity(path, "documentation", String(index + 1)),
          kind: "documentation",
          name: heading,
          summary: `Documentation section: ${heading}. Contents are repository-authored claims requiring review.`,
          basis: "documented",
          evidence: sourceExcerpt(source, index + 1, end),
        });
      }
    } else if (sourceLanguages.test(path)) result.coverage.unsupportedFiles.push(path);
  }
  function resolveModule(path: string, specifier: string): string | null {
    if (!specifier.startsWith(".")) return null;
    const target = posix.normalize(posix.join(posix.dirname(path), specifier));
    const stem = target.replace(/\.[cm]?jsx?$/, "");
    const candidates = [
      ...new Set([
        target,
        ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", ".cts", ".cjs"].flatMap((ext) => [
          `${stem}${ext}`,
          `${target}/index${ext}`,
        ]),
      ]),
    ].filter((candidate) => parsed.has(candidate));
    if (candidates.includes(target)) return target;
    return candidates.length === 1 ? candidates[0]! : null;
  }
  const occurrences = new Map<string, number>();
  const addRelationship = (
    kind: SourceRelationship["kind"],
    from: string,
    to: string,
    source: CapturedSource,
    at: number,
    description: string,
    focusColumn?: number,
  ) => {
    const key = JSON.stringify([source.file.path, kind, at]);
    const occurrence = occurrences.get(key) || 0;
    occurrences.set(key, occurrence + 1);
    result.relationships.push({
      id: identity(source.file.path, kind, from, to, String(at), String(occurrence)),
      kind,
      from,
      to,
      evidence: {
        ...sourceExcerpt(source, at),
        ...(focusColumn === undefined ? {} : { focusColumn }),
      },
      description,
    });
  };
  for (const [path, syntax] of parsed) {
    const source = captured.get(path)!;
    const resolveCall = (target: string): SourceObservation | undefined => {
      if (syntax.unstableBindings.includes(target.split(".")[0]!)) return;
      if (!target.includes(".") && declarations.has(`${path}#${target}`))
        return declarations.get(`${path}#${target}`);
      const [local, member] = target.split(".");
      if (target.split(".").length > 2) return;
      const imported = syntax.imports.find((item) => item.local === local && !item.typeOnly);
      if (!imported || (member && imported.imported !== "*")) return;
      const destination = resolveModule(path, imported.module);
      if (!destination) return;
      const exportedName = imported.imported === "*" ? member : imported.imported;
      const matches = parsed
        .get(destination)!
        .declarations.filter((item) => item.exportedAs.includes(exportedName || ""));
      if (
        matches.length === 1 &&
        !parsed.get(destination)!.unstableBindings.includes(matches[0]!.name)
      )
        return declarations.get(`${destination}#${matches[0]!.name}`);
    };
    for (const imported of syntax.imports) {
      const target = resolveModule(path, imported.module);
      if (target)
        addRelationship(
          "imports",
          moduleId(path),
          moduleId(target),
          source,
          imported.line,
          `${imported.typeOnly ? "Type-only import" : "Import"} of ${imported.imported} from ${imported.module}.`,
        );
      else
        result.uncertainties.push({
          code: "unresolved-import",
          path,
          line: imported.line,
          message: `${imported.module}: external, alias, absent, or ambiguous module; no local relationship asserted.`,
        });
    }
    for (const declaration of syntax.declarations) {
      const from = declarations.get(`${path}#${declaration.name}`);
      if (!from) continue;
      for (const call of declaration.calls) {
        const to = call.shadowed ? undefined : resolveCall(call.target);
        if (to?.kind === "function")
          addRelationship(
            "calls",
            from.id,
            to.id,
            source,
            call.line,
            `${declaration.name} contains ${call.awaited ? "an awaited" : "a"} call to ${call.target}; this is not an execution trace.`,
            call.column,
          );
        else
          result.uncertainties.push({
            code: "unresolved-call",
            path,
            line: call.line,
            message: `${call.target}: ${call.shadowed ? "shadowed/local binding" : "dynamic, external or unresolved target"}; no call relationship asserted.`,
          });
      }
    }
    for (const route of syntax.routes) {
      const item = add({
        id: identity(path, "api", route.method, route.path, String(route.line)),
        kind: "api",
        name: `${route.method} ${route.path}`,
        summary: `${route.framework} registration ${route.method} ${route.path} on ${route.receiver}. Mount prefixes and deployment availability are unverified.`,
        basis: "syntax",
        evidence: sourceExcerpt(source, route.line, route.line + 4),
      });
      const handler = route.handler ? resolveCall(route.handler) : undefined;
      if (handler?.kind === "function")
        addRelationship(
          "registers-handler",
          item.id,
          handler.id,
          source,
          route.line,
          `Registration references handler ${route.handler}.`,
        );
    }
  }
  for (const source of sources.filter(
    (item) => posix.basename(item.file.path) === "package.json",
  )) {
    try {
      const manifest = JSON.parse(source.content);
      const entries: [string, unknown][] = [
        ["main", manifest.main],
        ["module", manifest.module],
        ...Object.entries(
          typeof manifest.bin === "object" && manifest.bin ? manifest.bin : { bin: manifest.bin },
        ),
      ];
      for (const [kind, value] of entries) {
        if (typeof value !== "string") continue;
        const index = source.content
          .split(/\r\n|\n|\r/)
          .findIndex((text) => text.includes(JSON.stringify(value)));
        add({
          id: identity(source.file.path, "entrypoint", kind, value),
          kind: "entrypoint",
          name: `${kind}: ${value}`,
          summary: `Manifest declares ${kind} entry ${value}. Availability and execution are unverified.`,
          basis: "manifest",
          evidence: sourceExcerpt(source, index + 1),
        });
      }
    } catch {
      result.uncertainties.push({
        code: "invalid-manifest",
        path: source.file.path,
        message: "Package manifest could not be parsed.",
      });
    }
  }
  if (result.coverage.unsupportedFiles.length)
    result.uncertainties.push({
      code: "unsupported-language",
      message:
        "Non-JavaScript/TypeScript source bytes were captured, but semantic language adapters are not yet available for the listed files.",
    });
  return result;
}
