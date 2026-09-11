import { useEffect, useState } from "react";
import type { StoryPlan, VideoProposal, RepositoryIntake } from "@hyperframes/studio-server";
import { projectApi } from "./api";
import "./StoryPlanReview.css";

function StoryCard({
  plan,
  selected,
  onSelect,
  onSave,
  onDirty,
  disabled,
}: {
  plan: VideoProposal;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onSave: (story: StoryPlan) => void;
  onDirty: (dirty: boolean) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(plan.story!);
  const updateDraft = (story: StoryPlan) => {
    setDraft(story);
    onDirty(JSON.stringify(story) !== JSON.stringify(plan.story));
  };
  const updateBeat = (index: number, patch: Partial<StoryPlan["beats"][number]>) =>
    updateDraft({
      ...draft,
      beats: draft.beats.map((beat, i) => (i === index ? { ...beat, ...patch } : beat)),
    });
  const seconds = draft.beats.reduce((sum, beat) => sum + beat.durationFrames, 0) / 30;
  return (
    <article className="vf-plan vf-story-plan">
      <label className="vf-plan-choice">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(event.target.checked)}
        />
        <span>
          {draft.family.toUpperCase()} · {seconds.toFixed(1)}s
        </span>
      </label>
      <h3>{plan.title}</h3>
      <p>{draft.reason}</p>
      <p className="vf-story-question">{draft.question}</p>
      <details>
        <summary>Review and edit the script / {draft.beats.length} storyboard beats</summary>
        <label>
          Video title
          <input
            aria-label={`Video title ${plan.id}`}
            value={draft.title}
            onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <p>
          Script text is an editorial draft. Check its meaning against the source below; syntax
          alone does not prove runtime behavior.
        </p>
        <ol className="vf-story-beats">
          {draft.beats.map((beat, index) => (
            <li key={beat.id}>
              <div className="vf-row">
                <strong>
                  {beat.role} · {beat.visual}
                </strong>
                <label>
                  Seconds
                  <input
                    type="number"
                    min="2"
                    max="20"
                    step="0.01"
                    value={Number((beat.durationFrames / 30).toFixed(2))}
                    onChange={(event) =>
                      updateBeat(index, {
                        durationFrames: Math.round(Number(event.target.value) * 30),
                      })
                    }
                  />
                </label>
              </div>
              <label>
                On-screen heading
                <input
                  value={beat.heading}
                  onChange={(event) => updateBeat(index, { heading: event.target.value })}
                />
              </label>
              <label>
                Draft narration / script
                <textarea
                  value={beat.script}
                  onChange={(event) => updateBeat(index, { script: event.target.value })}
                />
              </label>
            </li>
          ))}
        </ol>
        <button disabled={disabled} onClick={() => onSave(draft)}>
          Save story edits
        </button>
      </details>
      <details>
        <summary>{plan.storyEvidence?.length || 0} source observations and citations</summary>
        {plan.storyEvidence?.map((item) => (
          <article className="vf-story-evidence" key={item.id}>
            <strong>{item.classification.replaceAll("-", " ")}</strong>
            <p>{item.statement}</p>
            <div>
              {item.excerpt.path}:{item.excerpt.startLine}–{item.excerpt.endLine}
            </div>
            <pre>{item.excerpt.text}</pre>
          </article>
        ))}
      </details>
      <details>
        <summary>Evidence limits</summary>
        <ul>
          {draft.limitations.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}
export function StoryPlanReview({
  intake,
  selected,
  onSelected,
  onIntake,
  act,
  busy,
  onCreated,
  onDraftDirty,
}: {
  intake: RepositoryIntake;
  selected: string[];
  onSelected: (ids: string[]) => void;
  onIntake: (intake: RepositoryIntake) => void;
  act: (label: string, action: () => Promise<void>) => Promise<void>;
  busy: boolean;
  onCreated: () => Promise<void>;
  onDraftDirty: (dirty: boolean) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const dirty = dirtyIds.length > 0;
  useEffect(() => onDraftDirty(dirty), [dirty, onDraftDirty]);
  return (
    <>
      {intake.planning?.warnings.map((warning) => (
        <p role="status" key={warning}>
          {warning}
        </p>
      ))}
      <div className="vf-plan-grid">
        {intake.proposals.map((plan) =>
          plan.story ? (
            <StoryCard
              key={`${plan.id}:${plan.planHash}`}
              plan={plan}
              selected={selected.includes(plan.id)}
              disabled={busy}
              onDirty={(changed) => {
                setDirtyIds((ids) =>
                  changed ? [...new Set([...ids, plan.id])] : ids.filter((id) => id !== plan.id),
                );
                setAcknowledged(false);
              }}
              onSelect={(value) => {
                setAcknowledged(false);
                onSelected(
                  value ? [...selected, plan.id] : selected.filter((id) => id !== plan.id),
                );
              }}
              onSave={(story) =>
                void act("Validating story edits…", async () => {
                  onIntake(
                    await projectApi(`/intakes/${intake.id}/stories/${plan.id}`, {
                      planHash: plan.planHash,
                      story,
                    }),
                  );
                  setAcknowledged(false);
                  setDirtyIds((ids) => ids.filter((id) => id !== plan.id));
                })
              }
            />
          ) : (
            <article className="vf-plan" key={plan.id}>
              <h3>{plan.title}</h3>
              <p>{plan.angle}</p>
              <p>Legacy plan. Inspect the source again to create an editable storyboard.</p>
            </article>
          ),
        )}
      </div>
      <label className="vf-story-ack">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I reviewed the selected scripts, source claims and evidence limits.
      </label>
      {dirty && <p role="status">Save your story edits before accepting the reviewed plans.</p>}
      <button
        className="vf-primary"
        disabled={busy || dirty || !selected.length || !acknowledged}
        onClick={() =>
          void act("Creating reviewed projects…", async () => {
            await projectApi(`/intakes/${intake.id}/accept`, {
              selected,
              review: {
                acknowledged,
                hashes: Object.fromEntries(
                  intake.proposals.map((plan) => [plan.id, plan.planHash]),
                ),
              },
            });
            await onCreated();
          })
        }
      >
        Create {selected.length} video projects
      </button>
    </>
  );
}
