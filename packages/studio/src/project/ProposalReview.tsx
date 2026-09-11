import { useCallback, useEffect, useRef, useState } from "react";
import type { ProposalRecord, ProposalPreview } from "@hyperframes/studio-server";
import { projectApi } from "./api";
import "./ProposalReview.css";

type Review = { record: ProposalRecord; preview: ProposalPreview };
export function ProposalReview({
  projectId,
  intakeId,
  currentRevision,
  onAccepted,
  onClose,
}: {
  projectId: string;
  intakeId?: string;
  currentRevision: number;
  onAccepted: () => Promise<void>;
  onClose: () => void;
}) {
  const [records, setRecords] = useState<ProposalRecord[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [draft, setDraft] = useState("");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [provider, setProvider] = useState<{ available: boolean; id: string | null } | null>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const base = `/projects/${projectId}/proposals`;
  const refresh = useCallback(async () => {
    const data = await projectApi<{ proposals: ProposalRecord[] }>(base);
    setRecords(data.proposals);
  }, [base]);
  const select = (value: Review) => {
    setReview(value);
    setDraft(JSON.stringify(value.record.proposal, null, 2));
    setAcknowledged([]);
  };
  const act = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    void act(async () => {
      await refresh();
      setProvider(await projectApi("/proposal-provider"));
    });
    return () => element?.close();
  }, [act, refresh]);
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const required =
    review?.preview.claims
      .filter((claim) => claim.requiresAcknowledgement)
      .map((claim) => claim.id) || [];
  const canAccept =
    review?.record.status === "draft" &&
    review.preview.valid &&
    review.record.proposal.expectedRevision === currentRevision &&
    required.every((id) => acknowledged.includes(id));
  return (
    <dialog
      ref={dialog}
      className="vf-proposal-dialog"
      aria-label="Proposal review"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <h2>Review proposed changes</h2>
          <p>Project revision {currentRevision}. Accepted edits become one undoable revision.</p>
        </div>
        <button aria-label="Close proposal review" onClick={close}>
          Close
        </button>
      </header>
      {error && (
        <p className="vf-error" role="alert">
          {error}
        </p>
      )}
      <div className="vf-proposal-layout">
        <aside>
          <label className="vf-button">
            Import agent proposal JSON
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void act(async () => {
                  if (file.size > 5_000_000) throw new Error("Proposal exceeds 5 MB.");
                  select(await projectApi(base, JSON.parse(await file.text())));
                  await refresh();
                });
                event.target.value = "";
              }}
            />
          </label>
          {intakeId && (
            <a
              className="vf-button"
              href={`/api/vflow/projects/${projectId}/proposal-context?intakeId=${encodeURIComponent(intakeId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open agent source context
            </a>
          )}
          <p className="vf-muted">
            {provider?.available
              ? `Configured provider: ${provider.id}`
              : "No generation provider is configured. You can import an agent proposal and review it locally."}
          </p>
          <label>
            Story or editing brief
            <textarea
              aria-label="Proposal brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              maxLength={4000}
            />
          </label>
          <button
            disabled={busy || !provider?.available || !intakeId || !brief.trim()}
            onClick={() =>
              void act(async () => {
                select(await projectApi(`${base}/generate`, { intakeId, brief }));
                await refresh();
              })
            }
          >
            Generate proposal
          </button>
          <h3>Saved proposals</h3>
          {records.map((record) => (
            <button
              className="vf-proposal-choice"
              key={record.id}
              disabled={busy}
              aria-pressed={review?.record.id === record.id}
              onClick={() => void act(async () => select(await projectApi(`${base}/${record.id}`)))}
            >
              <strong>{record.proposal.title}</strong>
              <span>
                {record.status} · version {record.version}
              </span>
            </button>
          ))}
          {!records.length && <p>No proposed changes yet.</p>}
        </aside>
        <section className="vf-proposal-detail">
          {review ? (
            <>
              <h3>{review.record.proposal.title}</h3>
              <p>
                {review.record.status} · based on project revision{" "}
                {review.record.proposal.expectedRevision} · source snapshot{" "}
                <code>{review.record.proposal.source.snapshotHash.slice(0, 16)}</code>
              </p>
              {review.record.status === "accepted" && (
                <p>
                  Accepted at revision {review.record.acceptedRevision}. Later edits and undo may
                  change the current project.
                </p>
              )}
              <h4>Claims and wording</h4>
              {review.preview.claims.map((claim) => (
                <article className="vf-proposal-claim" key={claim.id}>
                  <strong>{claim.classification.replaceAll("-", " ")}</strong>
                  <p>{claim.text}</p>
                  {claim.evidence.map((evidence, index) => (
                    <details key={index}>
                      <summary>
                        {evidence.path}:{evidence.startLine}–{evidence.endLine}
                      </summary>
                      <pre>{evidence.text}</pre>
                      <small>SHA-256 {evidence.sha256}</small>
                    </details>
                  ))}
                  {claim.requiresAcknowledgement && review.record.status === "draft" && (
                    <label className="vf-proposal-ack">
                      <input
                        type="checkbox"
                        checked={acknowledged.includes(claim.id)}
                        onChange={(event) =>
                          setAcknowledged(
                            event.target.checked
                              ? [...acknowledged, claim.id]
                              : acknowledged.filter((id) => id !== claim.id),
                          )
                        }
                      />
                      I reviewed this {claim.classification.replaceAll("-", " ")}; source truth is
                      not automatically verified.
                    </label>
                  )}
                </article>
              ))}
              <h4>Validation</h4>
              {review.preview.valid ? (
                <p>
                  Proposed command and source bindings validate. This does not prove runtime
                  behavior.
                </p>
              ) : (
                <ul>
                  {review.preview.diagnostics.map((item, index) => (
                    <li key={index}>
                      <code>
                        {item.code} {item.pointer}
                      </code>
                      <p>{item.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              <h4>{review.preview.changes.length} proposed field changes</h4>
              {review.preview.changes.map((change) => (
                <details key={change.pointer}>
                  <summary>{change.pointer}</summary>
                  <div className="vf-proposal-diff">
                    <div>
                      <strong>Before</strong>
                      <pre>{JSON.stringify(change.before, null, 2)}</pre>
                    </div>
                    <div>
                      <strong>Proposed</strong>
                      <pre>{JSON.stringify(change.after, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              ))}
              {review.record.status === "draft" && (
                <>
                  <details>
                    <summary>Revise typed proposal</summary>
                    <label>
                      Proposal JSON
                      <textarea
                        aria-label="Proposal JSON"
                        spellCheck={false}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          select(
                            await projectApi(`${base}/${review.record.id}/revise`, {
                              version: review.record.version,
                              contentHash: review.record.contentHash,
                              proposal: JSON.parse(draft),
                            }),
                          );
                          await refresh();
                        })
                      }
                    >
                      Save revised proposal
                    </button>
                  </details>
                  <footer>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await projectApi(`${base}/${review.record.id}/reject`, {
                            version: review.record.version,
                            contentHash: review.record.contentHash,
                          });
                          select(await projectApi(`${base}/${review.record.id}`));
                          await refresh();
                        })
                      }
                    >
                      Reject proposal
                    </button>
                    <button
                      className="vf-primary"
                      disabled={busy || !canAccept}
                      onClick={() =>
                        void act(async () => {
                          await projectApi(`${base}/${review.record.id}/accept`, {
                            version: review.record.version,
                            contentHash: review.record.contentHash,
                            acknowledgedClaimIds: acknowledged,
                          });
                          await onAccepted();
                          select(await projectApi(`${base}/${review.record.id}`));
                          await refresh();
                        })
                      }
                    >
                      Accept as one revision
                    </button>
                  </footer>
                </>
              )}
            </>
          ) : (
            <p>Select a proposal to compare its wording, evidence and edits before accepting.</p>
          )}
        </section>
      </div>
    </dialog>
  );
}
