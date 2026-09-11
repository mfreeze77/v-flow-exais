import { readFileSync } from "node:fs";
import type { UnifiedProjectService } from "@hyperframes/studio-server";

export const reviewActions = new Set(["compare-revisions", "get-review", "compare-diagrams"]);
export async function runProjectReview(
  service: UnifiedProjectService,
  args: { action: string; id?: string; file?: string; before?: string; head?: string },
) {
  if (args.action === "compare-revisions") {
    if (!args.before || !args.head)
      throw new Error("compare-revisions requires --before and --head.");
    return service.reviewRevisions({
      rootId: "source",
      path: ".",
      before: args.before,
      head: args.head,
    });
  }
  if (!args.id) throw new Error("Review commands require --id.");
  if (args.action === "get-review") return service.readReview(args.id);
  if (!args.file)
    throw new Error("compare-diagrams requires --file with reviewHash, beforePath and headPath.");
  const result = await service.compareReview(args.id, JSON.parse(readFileSync(args.file, "utf8")));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result;
}
