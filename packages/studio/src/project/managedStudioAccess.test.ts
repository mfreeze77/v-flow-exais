import { it } from "vitest";
import assert from "node:assert/strict";
import {
  verifyManagedStudioAccess,
  managedStudioHash,
  wantsManagedStudio,
  MANAGED_STUDIO_PROTOCOL,
} from "./managedStudioAccess";
const good = () => ({
  protocol: MANAGED_STUDIO_PROTOCOL,
  projectId: "project-test",
  nativeRoutes: "blocked-except-authoring-reads",
  history: "project-journal",
});
it("mode is explicit and round-trips an encoded identity", () => {
  assert.equal(wantsManagedStudio(managedStudioHash("project-test", false)), false);
  assert.equal(wantsManagedStudio(managedStudioHash("project-test", true)), true);
  assert.equal(wantsManagedStudio("#project/project-test?editor=other"), false);
});
it("preflight requires the server-installed fence response", async () => {
  const signal = new AbortController().signal;
  const calls: unknown[] = [];
  await verifyManagedStudioAccess("project-test", signal, async (url, init) => {
    calls.push([url, init]);
    return Response.json(good());
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    "/api/vflow/projects/project-test/editor/studio-access",
    { signal, cache: "no-store" },
  ]);
});
for (const field of ["protocol", "projectId", "nativeRoutes", "history"] as const)
  it(`refuses mismatched ${field}`, async () => {
    await assert.rejects(
      verifyManagedStudioAccess("project-test", new AbortController().signal, async () =>
        Response.json({ ...good(), [field]: "wrong" }),
      ),
    );
  });
it("hostile managed identity rejects asynchronously without touching transport", async () => {
  let called = 0;
  const promise = verifyManagedStudioAccess("../bad", new AbortController().signal, async () => {
    called++;
    return Response.json(good());
  });
  assert(promise instanceof Promise);
  await assert.rejects(promise);
  assert.equal(called, 0);
});
it("non-2xx success-shaped data is not a capability", async () => {
  await assert.rejects(
    verifyManagedStudioAccess("project-test", new AbortController().signal, async () =>
      Response.json(good(), { status: 404 }),
    ),
  );
});
it("an aborted acknowledgement never enables the editor", async () => {
  const controller = new AbortController();
  await assert.rejects(
    verifyManagedStudioAccess("project-test", controller.signal, async () => {
      controller.abort();
      return Response.json(good());
    }),
  );
});
it("bad JSON is a rejected preflight", async () => {
  await assert.rejects(
    verifyManagedStudioAccess(
      "project-test",
      new AbortController().signal,
      async () => new Response("{"),
    ),
  );
});
