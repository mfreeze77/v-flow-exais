/** Read-only browser probes for the managed Studio journey.
 * Kept self-contained so the exact functions can execute in page.evaluate.
 * They do not issue HTTP requests, invoke application callbacks, or change selection.
 */
export function sampleManagedStudio(request = {}) {
  const truncate = (text, limit = 4000) => String(text ?? "").slice(0, limit);
  const describe = (element) =>
    element && element.nodeType === 1
      ? {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          clipId: element.getAttribute("data-el-id"),
          testId: element.getAttribute("data-testid"),
          label: element.getAttribute("aria-label"),
        }
      : null;
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  // The player owns an iframe in a shadow root. Light-DOM queries miss it.
  const roots = [document];
  const frames = [];
  let rootLimitReached = false;
  for (let i = 0; i < roots.length; i++) {
    for (const node of roots[i].querySelectorAll("*")) {
      if (node.shadowRoot) {
        if (roots.length < 64) roots.push(node.shadowRoot);
        else rootLimitReached = true;
      }
      if (node.tagName !== "IFRAME" || frames.length >= 16) continue;
      const frame = { src: node.src, visible: visible(node), accessible: false };
      try {
        const doc = node.contentDocument;
        frame.accessible = !!doc;
        if (doc) {
          const html = doc.documentElement;
          frame.url = doc.URL;
          frame.readyState = doc.readyState;
          frame.projectId = html?.getAttribute("data-vflow-project-id");
          frame.buildHash = html?.getAttribute("data-vflow-build-hash");
          frame.revisionHash = html?.getAttribute("data-vflow-revision-hash");
          frame.scenes = [...doc.querySelectorAll("[data-vflow-scene-id]")]
            .slice(0, 30)
            .map((element) => ({
              sceneId: element.getAttribute("data-vflow-scene-id"),
              documentId: element.getAttribute("data-vflow-document-id"),
              sourcePath: element.getAttribute("data-vflow-source-path"),
            }));
          frame.headingCount = doc.querySelectorAll("h1").length;
          const expected = request.expected;
          if (expected) {
            const address = new URL(doc.URL, location.href);
            const requested = new URL(node.src, location.href);
            const path = `/api/vflow/projects/${encodeURIComponent(expected.projectId)}/editor/previews/${expected.buildHash}/view`;
            const sceneId = expected.sceneId ?? null;
            frame.matchesExpected =
              frame.visible &&
              frame.projectId === expected.projectId &&
              frame.buildHash === expected.buildHash &&
              frame.revisionHash === expected.revisionHash &&
              address.origin === location.origin &&
              address.pathname === path &&
              requested.origin === location.origin &&
              requested.pathname === path &&
              address.searchParams.get("sceneId") === sceneId &&
              requested.searchParams.get("sceneId") === sceneId &&
              (!sceneId || frame.scenes.some((scene) => scene.sceneId === sceneId));
          }
        }
      } catch (error) {
        frame.error = truncate(error, 500);
      }
      frames.push(frame);
    }
  }
  const clips = [...document.querySelectorAll('[aria-label="Timeline"] [data-clip][data-el-id]')];
  const matches = clips.filter((clip) => clip.getAttribute("data-el-id") === request.clipId);
  const clip = matches.length === 1 ? matches[0] : null;
  let hit = null;
  let hitWithinClip = false;
  let point = null;
  let bounds = null;
  let disabled = false;
  if (clip) {
    const rect = clip.getBoundingClientRect();
    bounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    // Use the same point for the readiness check and the eventual physical click.
    point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    if (point.x >= 0 && point.y >= 0 && point.x < innerWidth && point.y < innerHeight) {
      let target = document.elementFromPoint(point.x, point.y);
      for (let depth = 0; depth < 10 && target?.shadowRoot; depth++) {
        const inner = target.shadowRoot.elementFromPoint(point.x, point.y);
        if (!inner || inner === target) break;
        target = inner;
      }
      hit = describe(target);
      hitWithinClip = !!target && (target === clip || clip.contains(target));
    }
    disabled = !!clip.closest('[aria-disabled="true"], [inert], [disabled]');
  }
  const inspector = document.querySelector('[aria-label="Managed authoring inspector"]');
  const targetSelect = inspector?.querySelector('[aria-label="Authoring target"]');
  const nonempty = [...(targetSelect?.querySelectorAll("option") ?? [])]
    .filter((option) => option.value !== "")
    .map((option) => ({ value: option.value, text: truncate(option.textContent, 150) }));
  const loaded = frames.some((frame) => frame.matchesExpected && frame.readyState === "complete");
  const overlay = [
    ...document.querySelectorAll('[data-testid="timeline-loading-disabled-overlay"]'),
  ]
    .filter(visible)
    .map((element) => ({ ...describe(element), text: truncate(element.textContent, 200) }));
  const trace = window.__vflowManagedStudioHarnessTrace_v1;
  const events = trace?.events?.slice(-64) ?? [];
  return {
    url: location.href,
    expected: request.expected ?? null,
    frames,
    rootLimitReached,
    clips: clips.slice(0, 100).map((element) => ({
      key: element.getAttribute("data-el-id"),
      visible: visible(element),
      text: truncate(element.textContent, 160),
    })),
    target: {
      id: request.clipId ?? null,
      matches: matches.length,
      bounds,
      point,
      visible: visible(clip),
      disabled,
      hit,
      hitWithinClip,
      interactable: !!clip && visible(clip) && !disabled && hitWithinClip,
    },
    overlays: overlay,
    inspector: {
      present: !!inspector,
      text: truncate(inspector?.textContent),
      selectPresent: !!targetSelect,
      selectDisabled: targetSelect?.disabled ?? null,
      selected: targetSelect?.value ?? null,
      targets: nonempty.slice(0, 100),
    },
    alerts: [...document.querySelectorAll('[role="alert"]')]
      .filter(visible)
      .slice(0, 20)
      .map((element) => truncate(element.textContent, 1500)),
    events,
    ready: {
      "clip-interactable": loaded && !!clip && visible(clip) && !disabled && hitWithinClip,
      "double-click-delivered": events.some(
        (event) => event.type === "dblclick" && event.isTrusted && event.clipId === request.clipId,
      ),
      "scene-loaded": loaded,
      "authoring-targets":
        loaded && !!targetSelect && !targetSelect.disabled && nonempty.length > 0,
    },
  };
}

/** Observe trusted physical events. No dispatchEvent(), synthetic click or app API. */
export function installManagedClickTrace() {
  const key = "__vflowManagedStudioHarnessTrace_v1";
  if (Object.hasOwn(window, key)) throw new Error("Harness click trace is already installed.");
  const events = [];
  const observe = (event) => {
    const path = event.composedPath();
    const clip = path.find((node) => node instanceof Element && node.hasAttribute("data-clip"));
    const target = path.find((node) => node instanceof Element);
    events.push({
      type: event.type,
      isTrusted: event.isTrusted,
      detail: event.detail ?? null,
      clipId: clip?.getAttribute("data-el-id") ?? null,
      target: target?.tagName.toLowerCase() ?? null,
      targetTestId: target?.getAttribute("data-testid") ?? null,
      at: performance.now(),
    });
    if (events.length > 64) events.shift();
  };
  for (const type of ["pointerdown", "click", "dblclick"])
    document.addEventListener(type, observe, true);
  Object.defineProperty(window, key, { value: { events }, configurable: true });
}

/** Serialize one self-contained predicate; all identities remain arguments, not interpolated code. */
export function managedPhasePredicate(stage) {
  if (
    !["clip-interactable", "double-click-delivered", "scene-loaded", "authoring-targets"].includes(
      stage,
    )
  )
    throw new Error(`Unknown managed browser phase: ${stage}`);
  return new Function(
    "request",
    `return (${sampleManagedStudio.toString()})(request).ready[${JSON.stringify(stage)}];`,
  );
}
