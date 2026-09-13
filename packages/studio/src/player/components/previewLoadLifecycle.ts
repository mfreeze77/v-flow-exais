/**
 * The inner iframe is connected before the custom element's connectedCallback
 * assigns its source. Browsers may deliver an about:blank load in that gap.
 *
 * This is deliberately NOT a readiness or identity bypass. Once src or srcdoc
 * has been assigned, even an empty/error/cross-origin document is not ignored;
 * it must go through the normal owner validation and loading/error handling.
 */
export function isInitialBlankPreviewLoad(
  iframe: Pick<HTMLIFrameElement, "contentDocument" | "hasAttribute">,
): boolean {
  if (iframe.hasAttribute("src") || iframe.hasAttribute("srcdoc")) return false;
  try {
    return iframe.contentDocument?.URL === "about:blank";
  } catch {
    return false;
  }
}
