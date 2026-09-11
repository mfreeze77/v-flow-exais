/**
 * @hyperframes/diagram-motion — semantic intent to deterministic motion.
 *
 * Compiles guided-view intent into paused, seekable motion on the composition
 * timeline (contract C06). Implementation lands in E05, starting at AFM-039.
 *
 * Two rules this package exists to enforce, recorded here so they are visible
 * before any code depends on them:
 *   - Motion is generated only from authored relationships. Guided-view focus
 *     order is not graph connectivity, and a fabricated edge must never animate.
 *   - Time is integer frames with a rational frame rate; conversion to seconds
 *     happens at the emitter, never in stored data.
 */

/** Story time. Integers only — never a float and never seconds. */
export interface FrameRange {
  startFrame: number;
  durationFrames: number;
}

/** Frame rate as an exact rational, so 24000/1001 survives a roundtrip. */
export interface FrameRate {
  numerator: number;
  denominator: number;
}

/** Semantic intents allowed at this stage of contract C06. */
export type MotionIntent =
  | { kind: "frame-group"; objectIds: readonly string[] }
  | { kind: "focus-object"; objectIds: readonly string[] }
  | { kind: "reveal-authored-edge"; relationshipIds: readonly string[] }
  | { kind: "authored-route-signal"; relationshipIds: readonly string[] }
  | { kind: "presentation-callout"; text: string };

export { compileProject, MOTION_VERSION, type CompositionBuild } from "./compiler";
export { namespaceSvg } from "./namespaceSvg";
export { frameDiagram } from "./camera";
