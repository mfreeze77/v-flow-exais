import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compareDiagrams } from "../../packages/diagram-engine/src/index.mjs";
import { createHash } from "node:crypto";

const fixture = (side: "base" | "head") =>
  readFileSync(
    `packages/diagram-engine/examples/checkout-platform.${side}.architecture.json`,
    "utf8",
  );
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

it("compares exact authored snapshots, retains removed objects and distinct SVG namespaces", async () => {
  const before = fixture("base"),
    head = fixture("head");
  const result = await compareDiagrams({ before, head });
  expect(result.ok).toBe(true);
  if (!result.ok) throw result;
  expect(result.receipt.base.rawSha256).toBe(hash(before));
  expect(result.receipt.head.rawSha256).toBe(hash(head));
  expect(result.receipt.changes.components.find((item) => item.id === "cache")?.status).toBe(
    "removed",
  );
  expect(
    result.receipt.changes.connections.find((item) => item.id === "session-read")?.status,
  ).toBe("removed");
  expect(result.before.objects.some((item) => item.id === "cache")).toBe(true);
  expect(result.head.objects.some((item) => item.id === "cache")).toBe(false);
  expect(result.views.delta).toContain('data-node-id="cache"');
  expect(result.views.delta).toContain('data-delta-state="removed"');
  const ids = Object.values(result.views).flatMap((svg) =>
    [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
  );
  expect(new Set(ids).size).toBe(ids.length);
  expect(result.receipt.proofLevel).toBe("authored");
  expect(result.receipt.limitations.join(" ")).toContain("no runtime impact");
});

it("matches parallel edges by IDs across reordering and label changes", async () => {
  const before = JSON.parse(fixture("base"));
  before.connections.push({
    ...before.connections[0],
    id: "buyer-retry",
    label: "Retry",
    labelAt: [190, 330],
  });
  const head = structuredClone(before);
  head.connections.reverse();
  head.connections.find((item: any) => item.id === "buyer-retry").label = "Retry request";
  head.components.find((item: any) => item.id === "checkout").label = "Checkout service";
  const result = await compareDiagrams({
    before: JSON.stringify(before),
    head: JSON.stringify(head),
  });
  if (!result.ok) throw result;
  expect(result.receipt.changes.connections.map((item) => item.id)).toEqual(["buyer-retry"]);
  expect(result.receipt.changes.connections[0]?.classifications).toEqual(["semantic"]);
  expect(result.receipt.changes.components[0]).toMatchObject({
    id: "checkout",
    status: "changed",
    changedFields: ["/label"],
  });
});

it("distinguishes moves, reroutes and unchanged snapshots without semantic claims", async () => {
  const before = JSON.parse(fixture("base")),
    head = structuredClone(before);
  head.components.find((item: any) => item.id === "queue").pos = [420, 405];
  head.connections.find((item: any) => item.id === "publish-order").labelDy = 70;
  const result = await compareDiagrams({
    before: JSON.stringify(before),
    head: JSON.stringify(head),
  });
  if (!result.ok) throw result;
  expect(result.receipt.changes.components[0]).toMatchObject({
    id: "queue",
    status: "moved",
    classifications: ["geometry"],
  });
  expect(result.receipt.changes.connections[0]).toMatchObject({
    id: "publish-order",
    status: "rerouted",
    classifications: ["geometry"],
  });
  const same = await compareDiagrams({ before: fixture("base"), head: fixture("base") });
  if (!same.ok) throw same;
  expect(Object.values(same.receipt.changes).flat()).toEqual([]);
});

it("rejects missing/duplicate relationship IDs, malformed inputs and invalid diagrams", async () => {
  const noId = JSON.parse(fixture("base"));
  delete noId.connections[0].id;
  const missing = await compareDiagrams({ before: fixture("base"), head: JSON.stringify(noId) });
  expect(missing).toMatchObject({
    ok: false,
    diagnostics: [{ code: "delta/relationship-id-required" }],
  });
  const duplicate = JSON.parse(fixture("base"));
  duplicate.connections[1].id = duplicate.connections[0].id;
  expect(
    (await compareDiagrams({ before: fixture("base"), head: JSON.stringify(duplicate) })).ok,
  ).toBe(false);
  expect((await compareDiagrams({ before: "{", head: fixture("base") })).ok).toBe(false);
  expect((await compareDiagrams({ before: "{}", head: fixture("base") })).ok).toBe(false);
});
