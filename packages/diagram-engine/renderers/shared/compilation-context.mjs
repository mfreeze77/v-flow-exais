import { AsyncLocalStorage } from "node:async_hooks";

const compilations = new AsyncLocalStorage();
export const compilationContext = () => compilations.getStore();
export const withCompilationContext = (context, callback) => compilations.run(context, callback);

export function requestedQualityProfile(authored) {
  const context = compilationContext();
  // Environment compatibility belongs only to callers outside the library.
  return context
    ? (context.qualityProfile ?? authored)
    : process.env.ARCHIFY_QUALITY_PROFILE || authored;
}
