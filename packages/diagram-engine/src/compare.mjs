import { createHash } from "node:crypto";
import { compileDiagram } from "./compile.mjs";
import { parseRepositoryRemote } from "../renderers/shared/repository-location.mjs";
import {
  compareArchitecture,
  canonicalArchitectureJson,
  annotateArchitectureSideSvg,
  buildDeltaSvg,
} from "../delta/architecture-delta.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
export const repositoryIdentity = (url) =>
  parseRepositoryRemote(url, { authored: true })?.identity || null;

/** Compare validated authored snapshots using stable IDs and the owned comparator.
 * Source resolver authority is injected; no repository discovery or IO occurs here.
 */
export async function compareDiagrams({ before, head, resolveEvidence } = {}) {
  try {
    const sources = {};
    const artifacts = {};
    for (const [side, raw] of Object.entries({ before, head })) {
      if (typeof raw !== "string" || Buffer.byteLength(raw) > 512_000)
        throw new Error(`${side} must contain at most 512 KB of authored JSON.`);
      const source = JSON.parse(raw);
      sources[side] = source;
      const compiled = await compileDiagram({
        kind: "architecture",
        source,
        resolveEvidence: resolveEvidence
          ? (request) => resolveEvidence({ ...request, side })
          : undefined,
      });
      if (!compiled.ok)
        return {
          ok: false,
          diagnostics: compiled.diagnostics.map((entry) => ({ ...entry, side })),
        };
      artifacts[side] = compiled.artifact;
    }
    const receipt = compareArchitecture(sources.before, sources.head, {
      baseRawSha256: digest(before),
      headRawSha256: digest(head),
      baseSemanticSha256: digest(canonicalArchitectureJson(sources.before)),
      headSemanticSha256: digest(canonicalArchitectureJson(sources.head)),
      baseBytes: Buffer.byteLength(before),
      headBytes: Buffer.byteLength(head),
      baseVerified: artifacts.before.evidence?.verified === true,
      headVerified: artifacts.head.evidence?.verified === true,
    });
    // Consume the compiler artifacts directly. The standalone viewer is not scraped.
    const views = {
      before: annotateArchitectureSideSvg(artifacts.before.svg, receipt, "base"),
      delta: buildDeltaSvg(artifacts.before.svg, artifacts.head.svg, receipt),
      head: annotateArchitectureSideSvg(artifacts.head.svg, receipt, "head"),
    };
    return JSON.parse(
      JSON.stringify({
        ok: true,
        receipt,
        receiptHash: digest(JSON.stringify(receipt)),
        before: artifacts.before,
        head: artifacts.head,
        views,
      }),
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: error.code || "delta/invalid",
          severity: "error",
          message: error.message,
          details: error.details,
        },
      ],
    };
  }
}
