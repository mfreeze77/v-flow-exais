/** TEST DOUBLE ONLY. This is copied into a disposable test workspace as puppeteer-core.
 * No real browser/network/UI is executed and no production CLI selects this module.
 */
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

const statePath = process.env.VFLOW_FRESHNESS_TEST_STATE;
if (!statePath) throw new Error("Fake Puppeteer requires the test-only state path.");
const trace = (entry) => {
  if (process.env.VFLOW_FRESHNESS_TEST_TRACE)
    appendFileSync(process.env.VFLOW_FRESHNESS_TEST_TRACE, JSON.stringify(entry) + "\n");
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
function readState() {
  return existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : { imports: 0, projects: {} };
}
function writeState(state) {
  writeFileSync(statePath, JSON.stringify(state));
}

class Page extends EventEmitter {
  urlValue = "about:blank";
  projectId = null;
  importedHere = false;
  primed = false;
  mounted = false;
  mountReady = false;
  constructor() {
    super();
    trace({ event: "newPage" });
  }
  on(name, handler) {
    trace({ event: "listen", name });
    return super.on(name, handler);
  }
  async setViewport(value) {
    trace({ event: "viewport", value });
  }
  async setRequestInterception(value) {
    trace({ event: "interception", value });
  }
  network(url, method = "GET", type = "fetch") {
    const request = {
      url: () => url,
      method: () => method,
      resourceType: () => type,
      continue: async () => {},
      abort: async () => {},
      failure: () => null,
    };
    this.emit("request", request);
    this.emit("response", { request: () => request, url: () => url, status: () => 200 });
    this.emit("requestfinished", request);
  }
  async goto(url, options) {
    trace({ event: "goto", url: url.replace(/video-test-\d+/g, "PROJECT"), options });
    this.urlValue = url;
    this.network(url, "GET", "document");
    const address = new URL(url);
    if (address.hash.startsWith("#project/")) {
      this.projectId = decodeURIComponent(address.hash.slice(9).split("?")[0]);
      this.mounted = true;
      const pattern = process.env.VFLOW_FRESHNESS_TEST_PATTERN ?? "pass";
      this.mountReady =
        pattern === "fail"
          ? false
          : pattern === "fresh-fail"
            ? !this.importedHere
            : pattern === "prime-fix"
              ? this.primed || !this.importedHere
              : true;
    }
    return null;
  }
  async fetch(url, options = {}) {
    const address = new URL(url, this.urlValue);
    trace({
      event: "fetch",
      path: address.pathname.replace(/video-test-\d+/g, "PROJECT"),
      method: options.method ?? "GET",
      payload: options.body ? JSON.parse(options.body) : null,
    });
    this.network(address.href, options.method ?? "GET");
    const state = readState();
    if (address.pathname === "/api/vflow/import-diagram") {
      state.imports++;
      const id = `video-test-${state.imports}`;
      const diagram = JSON.parse(options.body);
      state.projects[id] = {
        manifest: { id, revision: 0 },
        sources: {
          title: "<h1>Managed Studio browser fixture</h1>",
          diagram,
        },
      };
      this.importedHere = true;
      this.projectId = id;
      writeState(state);
      return { ok: true, status: 200, json: async () => ({ id }) };
    }
    const match = /^\/api\/vflow\/projects\/([^/]+)(\/.*)?$/.exec(address.pathname);
    if (!match) throw new Error(`Fake transport has no route ${address.pathname}`);
    const id = match[1];
    const snapshot = state.projects[id];
    if (!snapshot) return { ok: false, status: 404, json: async () => ({ error: "missing" }) };
    if (!match[2]) {
      if (this.mounted && process.env.VFLOW_FRESHNESS_TEST_PATTERN === "drift") {
        snapshot.sources.title = "changed after mount";
        writeState(state);
      }
      return { ok: true, status: 200, json: async () => ({ snapshot }) };
    }
    if (match[2] === "/editor") {
      if (!this.mounted) this.primed = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({ projectId: id, revision: 0, revisionHash: "a".repeat(64) }),
      };
    }
    // Default full-journey compatibility tests stop here, without simulating any edit.
    if (match[2] === "/editor/previews")
      throw new Error("TEST DOUBLE: stop after startup; no editing evidence");
    throw new Error(`Unexpected test transport request ${address.pathname}`);
  }
  document() {
    return {
      querySelectorAll: (selector) =>
        selector.includes("[data-clip]") && this.mountReady ? [{}] : [],
      querySelector: (selector) =>
        selector.includes('header[aria-label="Managed Studio"]') && this.mounted ? {} : null,
    };
  }
  async evaluate(fn, ...args) {
    trace({ event: "evaluate", functionHash: hash(fn.toString()) });
    if (fn.name === "sampleManagedStartup") return this.probe();
    if (fn.name === "sampleManagedStudio") return { frames: [], clips: [], alerts: [], ready: {} };
    const page = this;
    return runInNewContext(`(${fn.toString()})(...args)`, {
      args,
      fetch: (url, opts) => page.fetch(url, opts),
      document: this.document(),
      location: new URL(this.urlValue),
      URL,
      console,
      setTimeout,
      clearTimeout,
    });
  }
  async waitForSelector(selector) {
    trace({ event: "waitSelector", selector });
    if (!this.mounted) throw new Error("Fake header missing");
    return { dispose: async () => {} };
  }
  async waitForFunction(fn, options, ...args) {
    trace({ event: "waitFunction", functionHash: hash(fn.toString()), options });
    const result = await runInNewContext(`(${fn.toString()})(...args)`, {
      args,
      document: this.document(),
    });
    if (!result) {
      const error = new Error("Waiting failed: 60000ms exceeded (INJECTED TEST TIMEOUT)");
      error.name = "TimeoutError";
      throw error;
    }
    return { dispose: async () => {} };
  }
  probe() {
    const address = new URL(this.urlValue);
    const preview = `${address.origin}/api/vflow/projects/${this.projectId}/editor/previews/${"b".repeat(64)}/view`;
    const layout = {
      connected: true,
      display: "block",
      visibility: "visible",
      width: 600,
      height: 300,
    };
    return {
      url: this.urlValue,
      truncated: false,
      headerPresent: this.mounted,
      timelinePhase: this.mountReady ? "ready" : "runtime-pending",
      renderedClipCount: this.mountReady ? 3 : 0,
      timelineRoots: [{ elementCount: this.mountReady ? "3" : "0", layout }],
      overlays: this.mountReady ? [] : [{ layout }],
      frames: [
        {
          readyState: "complete",
          projectId: this.projectId,
          buildHash: "b".repeat(64),
          revisionHash: "a".repeat(64),
          revision: "0",
          src: preview,
          documentUrl: preview,
          layout,
        },
      ],
    };
  }
  async screenshot() {
    trace({ event: "fakeScreenshot", note: "No image is created by this test double" });
  }
  frames() {
    return [];
  }
}
export default {
  async launch(options) {
    trace({ event: "launch", args: options.args, headless: options.headless });
    return {
      version: async () => "FakeBrowser/fixture-tests-NOT-browser-evidence",
      newPage: async () => new Page(),
      close: async () => trace({ event: "browserClosed" }),
    };
  },
};
