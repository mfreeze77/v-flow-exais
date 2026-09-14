/** Read-only, self-contained page.evaluate probe. Invoked AFTER the mount wait, not during it. */
export function sampleManagedStartup() {
  const rectangle = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      connected: node.isConnected,
    };
  };
  const limit = (v, n = 2000) => String(v ?? "").slice(0, n);
  const own = (object, key) => {
    if (!object) return undefined;
    try {
      // Do not invoke a getter or a playback method just to inspect readiness.
      const d = Object.getOwnPropertyDescriptor(object, key);
      return d && "value" in d ? d.value : undefined;
    } catch {
      return undefined;
    }
  };
  const phases = [...document.querySelectorAll("[data-vflow-timeline-phase]")];
  const timelines = [...document.querySelectorAll('[aria-label="Timeline"]')];
  const roots = [document],
    frames = [];
  let truncated = false;
  for (let i = 0; i < roots.length; i++)
    for (const node of roots[i].querySelectorAll("*")) {
      if (node.shadowRoot) {
        if (roots.length < 64) roots.push(node.shadowRoot);
        else truncated = true;
      }
      if (node.tagName !== "IFRAME") continue;
      if (frames.length >= 16) {
        truncated = true;
        continue;
      }
      const item = {
        src: node.src,
        srcAttribute: node.getAttribute("src"),
        layout: rectangle(node),
      };
      try {
        const doc = node.contentDocument,
          win = node.contentWindow,
          html = doc?.documentElement;
        item.documentUrl = doc?.URL ?? null;
        item.readyState = doc?.readyState ?? null;
        item.projectId = html?.getAttribute("data-vflow-project-id") ?? null;
        item.buildHash = html?.getAttribute("data-vflow-build-hash") ?? null;
        item.revisionHash = html?.getAttribute("data-vflow-revision-hash") ?? null;
        item.revision = html?.getAttribute("data-vflow-revision") ?? null;
        const manifest = own(win, "__clipManifest");
        const clips = own(manifest, "clips");
        item.manifestClipCount = Array.isArray(clips) ? clips.length : null;
        item.domTimedElements = doc?.querySelectorAll("[data-start][data-duration]").length ?? null;
        const timelines = own(win, "__timelines");
        item.registeredTimelines =
          timelines && typeof timelines === "object" ? Object.keys(timelines).slice(0, 100) : [];
        item.playerObjectPresent = !!own(win, "__player");
        item.rootCompositionId =
          doc?.querySelector("[data-composition-id]")?.getAttribute("data-composition-id") ?? null;
      } catch (error) {
        item.error = limit(error);
      }
      frames.push(item);
    }
  return {
    url: location.href,
    visibilityState: document.visibilityState,
    focused: document.hasFocus(),
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    readyState: document.readyState,
    headerPresent: !!document.querySelector('header[aria-label="Managed Studio"]'),
    timelinePhase: phases.length === 1 ? phases[0].getAttribute("data-vflow-timeline-phase") : null,
    phaseElements: phases.map((n) => ({
      value: n.getAttribute("data-vflow-timeline-phase"),
      layout: rectangle(n),
    })),
    timelineRoots: timelines.map((n) => ({
      elementCount: n.getAttribute("data-timeline-element-count"),
      renderedClips: n.querySelectorAll("[data-clip]").length,
      clipKeys: [...n.querySelectorAll("[data-clip][data-el-id]")]
        .slice(0, 100)
        .map((e) => e.getAttribute("data-el-id")),
      layout: rectangle(n),
    })),
    renderedClipCount: document.querySelectorAll('[aria-label="Timeline"] [data-clip]').length,
    globalClipCount: document.querySelectorAll("[data-clip]").length,
    overlays: [
      ...document.querySelectorAll('[data-testid="timeline-loading-disabled-overlay"]'),
    ].map((n) => ({ text: limit(n.textContent), layout: rectangle(n) })),
    alerts: [...document.querySelectorAll('[role="alert"]')]
      .slice(0, 20)
      .map((n) => limit(n.textContent)),
    inspectorPresent: !!document.querySelector('[aria-label="Managed authoring inspector"]'),
    targetCount: document.querySelector('[aria-label="Authoring target"]')?.options?.length ?? null,
    frames,
    truncated,
  };
}

export function startupIdentityMatches(snapshot, expected) {
  if (
    !snapshot ||
    snapshot.truncated ||
    snapshot.timelinePhase !== "ready" ||
    !snapshot.headerPresent ||
    snapshot.timelineRoots?.length !== 1 ||
    snapshot.renderedClipCount < 1 ||
    snapshot.timelineRoots[0].layout?.width <= 0 ||
    snapshot.timelineRoots[0].layout?.height <= 0 ||
    snapshot.overlays?.some(
      (o) =>
        o.layout?.display !== "none" &&
        o.layout?.visibility !== "hidden" &&
        o.layout?.width > 0 &&
        o.layout?.height > 0,
    )
  )
    return false;
  const matching = (snapshot.frames ?? []).filter((frame) => {
    try {
      const actual = new URL(frame.documentUrl),
        requested = new URL(frame.src);
      const wanted = `/api/vflow/projects/${encodeURIComponent(expected.projectId)}/editor/previews/${frame.buildHash}/view`;
      return (
        frame.readyState === "complete" &&
        frame.projectId === expected.projectId &&
        frame.revisionHash === expected.revisionHash &&
        String(expected.revision) === frame.revision &&
        /^[0-9a-f]{64}$/.test(frame.buildHash ?? "") &&
        actual.origin === expected.origin &&
        requested.origin === expected.origin &&
        actual.pathname === wanted &&
        requested.pathname === wanted &&
        !actual.searchParams.has("sceneId") &&
        !requested.searchParams.has("sceneId") &&
        frame.layout?.connected &&
        frame.layout.width > 0 &&
        frame.layout.height > 0
      );
    } catch {
      return false;
    }
  });
  return matching.length === 1;
}
