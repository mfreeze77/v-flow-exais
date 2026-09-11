import { useState } from "react";
import { useMountEffect } from "../hooks/useMountEffect";
import { projectApi } from "./api";

export function BatchPanel({ batchId }: { batchId: string }) {
  const [batch, setBatch] = useState<any>(null);
  const [error, setError] = useState("");
  useMountEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const result = await projectApi(`/batches/${batchId}`);
        if (active) {
          setBatch(result);
          if (result.status === "running") timer = setTimeout(refresh, 1000);
        }
      } catch (reason) {
        if (active) setError((reason as Error).message);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  });
  if (error)
    return (
      <p role="alert" className="vf-error">
        {error}
      </p>
    );
  if (!batch) return <p role="status">Opening render batch…</p>;
  return (
    <section className="vf-batch" aria-label="Render batch">
      <div className="vf-row">
        <h3>Video exports</h3>
        <span className="vf-tag">{batch.status}</span>
        {batch.status === "running" && (
          <button
            onClick={() =>
              void projectApi(`/batches/${batchId}/cancel`, {}).catch((reason) =>
                setError(reason.message),
              )
            }
          >
            Cancel batch
          </button>
        )}
        {["interrupted", "failed", "partial", "cancelled"].includes(batch.status) && (
          <button
            onClick={async () => {
              await projectApi(`/batches/${batchId}/resume`, {});
              window.location.reload();
            }}
          >
            Resume unfinished
          </button>
        )}
      </div>
      {batch.items.map((item: any, index: number) => (
        <div className="vf-export" key={item.projectId}>
          <div className="vf-row">
            <strong>Video {index + 1}</strong>
            <span>
              {item.status}
              {item.reused ? " · verified output reused" : ""}
            </span>
            {item.downloadUrl && (
              <a className="vf-button" href={item.downloadUrl}>
                Download MP4
              </a>
            )}
          </div>
          <progress max={100} value={item.progress} aria-label={`Video ${index + 1} progress`} />
          {item.probe && (
            <p>
              {item.probe.width} × {item.probe.height} · {item.probe.frames} frames ·{" "}
              {item.probe.duration.toFixed(1)}s
            </p>
          )}
          {item.error && (
            <p className="vf-error" role="alert">
              {item.error}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
