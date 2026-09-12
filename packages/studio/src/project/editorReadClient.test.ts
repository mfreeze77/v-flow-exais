import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { editorFixture } from "../../../studio-server/src/project/editorRead.fixture";
import {
  projectEditorDocument,
  projectEditorView,
} from "../../../studio-server/src/project/editorProjection";
import {
  createManagedEditorReader,
  createProjectReadClient,
  type EditorFetch,
} from "./editorReadClient";

function transport() {
  const current = editorFixture();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const view = projectEditorView(current);
  const original = projectEditorDocument(current, view, "title");
  let document: unknown = original;
  let onRead: (() => Response) | undefined;
  const fetcher: EditorFetch = async (url, init) => {
    calls.push({ url, init });
    if (!url.includes("/documents/")) return Response.json(view);
    return onRead ? onRead() : Response.json(document);
  };
  return {
    current,
    calls,
    view,
    original,
    fetcher,
    setDocument: (value: unknown) => {
      document = value;
    },
    setResponse: (fn: () => Response) => {
      onRead = fn;
    },
  };
}

describe("AFM-059/060 managed reader", () => {
  it("reads native bytes through the managed gateway, using document identity and revision pin", async () => {
    const t = transport();
    const reader = createManagedEditorReader("editor-test", t.fetcher);
    assert.equal((await reader.readDocument("title.html"))?.content, t.original.content);
    assert.equal(t.calls.length, 2);
    const requested = new URL(t.calls[1]!.url, "http://localhost");
    assert.equal(requested.pathname, "/api/vflow/projects/editor-test/editor/documents/title");
    assert.equal(requested.searchParams.get("revision"), "4");
    assert.equal(requested.searchParams.get("revisionHash"), "a".repeat(64));
    assert.equal(
      t.calls.some((c) => c.url.startsWith("/api/projects/")),
      false,
    );
  });
  it("accepts portable Windows separators without interpreting a filesystem root", async () => {
    const t = transport();
    t.view.documents[0]!.path = "cards/title.html";
    t.setDocument({ ...t.original, path: "cards/title.html" });
    assert.ok(
      await createManagedEditorReader("editor-test", t.fetcher).readDocument("cards\\title.html"),
    );
  });
  it("reuses an explicit view without another discovery read", async () => {
    const t = transport();
    const reader = createManagedEditorReader("editor-test", t.fetcher);
    await reader.readDocument("title.html", { view: t.view });
    assert.equal(t.calls.length, 1);
  });
  it("optional absence is only absence from a successfully validated authored manifest", async () => {
    const t = transport();
    assert.equal(
      await createManagedEditorReader("editor-test", t.fetcher).readDocument("absent.html", {
        optional: true,
      }),
      undefined,
    );
    assert.equal(t.calls.length, 1);
  });
  it("required absence throws rather than consulting the native file endpoint", async () => {
    const t = transport();
    await assert.rejects(
      createManagedEditorReader("editor-test", t.fetcher).readDocument("absent.html"),
      /No authoritative/,
    );
    assert.equal(t.calls.length, 1);
  });
  it("does not request generated HTML or hidden revision-store paths", async () => {
    const t = transport(),
      r = createManagedEditorReader("editor-test", t.fetcher);
    await assert.rejects(r.readDocument("scene-0-intro.html"), /No authoritative/);
    await assert.rejects(r.readDocument(".vflow/CURRENT"), /authoring reference/);
    assert.equal(t.calls.length, 1);
  });
  for (const path of [
    "../title.html",
    "/etc/passwd",
    "C:\\title.html",
    "a//title.html",
    "generated/title.html",
    "a\0.html",
  ])
    it(`rejects non-authoring path ${JSON.stringify(path)} before a request`, async () => {
      const t = transport();
      await assert.rejects(createManagedEditorReader("editor-test", t.fetcher).readDocument(path));
      assert.equal(t.calls.length, 0);
    });
  for (const [field, value] of [
    ["projectId", "different"],
    ["revision", 5],
    ["revisionHash", "b".repeat(64)],
    ["documentId", "system"],
    ["path", "other.html"],
    ["kind", "architecture"],
    ["contentHash", "c".repeat(64)],
  ] as const)
    it(`rejects mismatched document ${field}`, async () => {
      const t = transport();
      t.setDocument({ ...t.original, [field]: value });
      await assert.rejects(
        createManagedEditorReader("editor-test", t.fetcher).readDocument("title.html"),
        /does not belong/,
      );
    });
  it("checks content bytes, not just a matching claimed hash", async () => {
    const t = transport();
    t.setDocument({ ...t.original, content: "<h1>different</h1>" });
    await assert.rejects(
      createManagedEditorReader("editor-test", t.fetcher).readDocument("title.html"),
      /do not match/,
    );
  });
  it("retains CRLF and all native whitespace", async () => {
    const t = transport();
    const doc = await createManagedEditorReader("editor-test", t.fetcher).readDocument(
      "title.html",
    );
    assert.ok(doc?.content.includes("\r\n"));
    assert.ok(doc?.content.includes("Keep  my"));
  });
  it("does not suppress HTTP 409 or retry against a fresher revision", async () => {
    const t = transport();
    t.setResponse(() =>
      Response.json({ code: "editor/stale-read", error: "stale" }, { status: 409 }),
    );
    await assert.rejects(
      createManagedEditorReader("editor-test", t.fetcher).readDocument("title.html", {
        optional: true,
      }),
      /stale/,
    );
    assert.equal(t.calls.length, 2);
  });
  it("does not suppress a missing document after discovery claimed it existed", async () => {
    const t = transport();
    t.setResponse(() => Response.json({ error: "missing committed document" }, { status: 404 }));
    await assert.rejects(
      createManagedEditorReader("editor-test", t.fetcher).readDocument("title.html", {
        optional: true,
      }),
      /missing/,
    );
  });
  it("rejects an optional read on an unavailable project", async () => {
    const reader = createManagedEditorReader(
      "editor-test",
      async () => new Response("offline", { status: 503 }),
    );
    await assert.rejects(reader.readDocument("title.html", { optional: true }), /503/);
  });
  it("rejects malformed discovery JSON", async () => {
    await assert.rejects(
      createManagedEditorReader("editor-test", async () => new Response("{")).view(),
      /invalid JSON/,
    );
  });
  it("rejects a view for a different project", async () => {
    const t = transport();
    t.view.projectId = "other";
    await assert.rejects(
      createManagedEditorReader("editor-test", t.fetcher).view(),
      /another project/,
    );
  });
  it("checks a supplied view instead of trusting a caller's cast", async () => {
    const t = transport();
    t.view.generatedOutputEditable = true as false;
    await assert.rejects(
      createManagedEditorReader("editor-test", t.fetcher).readDocument("title.html", {
        view: t.view,
      }),
      /invalid-view/,
    );
    assert.equal(t.calls.length, 0);
  });
  it("does not treat discovery failure as an empty project", async () => {
    const reader = createProjectReadClient("editor-test", "managed", async () =>
      Response.json({}, { status: 500 }),
    );
    await assert.rejects(reader.fetchListing(), /500/);
  });
  it("propagates abort signals and stops before an already aborted request", async () => {
    const t = transport(),
      controller = new AbortController();
    controller.abort();
    await assert.rejects(
      createManagedEditorReader("editor-test", t.fetcher).readDocument("title.html", {
        signal: controller.signal,
      }),
    );
    assert.equal(t.calls.length, 0);
  });
  it("never changes or normalizes a native response", async () => {
    const response = Response.json({ content: "A\r\n B", version: "native-version" });
    const seen: string[] = [];
    const reader = createProjectReadClient("native", "native", async (url) => {
      seen.push(url);
      return response;
    });
    assert.equal(await reader.fetchFile(".studio/motion.json", { optional: true }), response);
    assert.equal(seen[0], "/api/projects/native/files/.studio%2Fmotion.json?optional=1");
  });
  it("preserves legacy listing status, headers and body", async () => {
    const response = new Response("unavailable", { status: 503 });
    assert.equal(
      await createProjectReadClient("native", "native", async () => response).fetchListing(),
      response,
    );
  });
  it("does not use native filesystem endpoints on managed failure", async () => {
    const urls: string[] = [];
    const reader = createProjectReadClient("editor-test", "managed", async (url) => {
      urls.push(url);
      return new Response("not found", { status: 404 });
    });
    await assert.rejects(reader.fetchFile("title.html"));
    assert.equal(urls.length, 1);
    assert.ok(urls[0]!.startsWith("/api/vflow/"));
  });
  it("projects file-tree entries without a workstation directory or generated files", async () => {
    const t = transport();
    const result = await createProjectReadClient(
      "editor-test",
      "managed",
      t.fetcher,
    ).fetchListing();
    const listing = await result.json();
    assert.deepEqual(listing.files, ["title.html", "system.architecture.json"]);
    assert.deepEqual(listing.compositions, ["title.html"]);
    assert.equal(listing.dir, null);
  });
  it("supplies content and version in the retained reader's response shape", async () => {
    const t = transport();
    const response = await createProjectReadClient("editor-test", "managed", t.fetcher).fetchFile(
      "title.html",
    );
    const data = await response.json();
    assert.equal(data.content, t.original.content);
    assert.equal(data.version, t.original.contentHash);
  });
  it("requires explicit project ownership", () => {
    assert.throws(() => createProjectReadClient("editor-test", "unknown" as "native"), /ownership/);
  });
  for (const name of ["My Project", "révision 日本語", "demo.v1", "title#cut"])
    it(`preserves native project identity ${name}`, async () => {
      const urls: string[] = [];
      const client = createProjectReadClient(name, "native", async (url) => {
        urls.push(url);
        return Response.json({ content: "unchanged" });
      });
      await client.fetchFile("title.html");
      assert.equal(urls[0], `/api/projects/${encodeURIComponent(name)}/files/title.html`);
    });
});
