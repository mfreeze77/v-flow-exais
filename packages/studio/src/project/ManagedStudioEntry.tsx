import { useEffect, useState } from "react";
import { StudioApp } from "../App";
import { managedStudioHash, verifyManagedStudioAccess } from "./managedStudioAccess";

/** Opt-in entry until the real browser journey is accepted. Never mounts on failed preflight. */
export function ManagedStudioEntry({ id }: { id: string }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setReady(false);
    setError(null);
    void verifyManagedStudioAccess(id, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setReady(true);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => controller.abort();
  }, [id]);
  if (!ready)
    return (
      <section className="vf-app vf-loading" role={error ? "alert" : "status"}>
        <p>{error ?? "Checking managed editing authority…"}</p>
        <a href={managedStudioHash(id, false)}>Back to project workspace</a>
      </section>
    );
  return <StudioApp />;
}
