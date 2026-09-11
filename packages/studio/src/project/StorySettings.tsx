import type { StoryOptions } from "@hyperframes/studio-server";
export function StorySettings({
  value,
  onChange,
}: {
  value: StoryOptions;
  onChange: (value: StoryOptions) => void;
}) {
  return (
    <fieldset className="vf-story-settings">
      <legend>Shape the stories</legend>
      <label>
        Audience
        <select
          aria-label="Story audience"
          value={value.audience}
          onChange={(event) =>
            onChange({ ...value, audience: event.target.value as StoryOptions["audience"] })
          }
        >
          <option value="developers">Developers</option>
          <option value="new-users">New users</option>
          <option value="maintainers">Maintainers</option>
        </select>
      </label>
      <label>
        Purpose
        <select
          aria-label="Story purpose"
          value={value.purpose}
          onChange={(event) =>
            onChange({ ...value, purpose: event.target.value as StoryOptions["purpose"] })
          }
        >
          <option value="explain">Explain how it works</option>
          <option value="onboard">Help someone get started</option>
          <option value="review">Review the source</option>
        </select>
      </label>
      <label>
        Target seconds per video
        <input
          aria-label="Story target seconds"
          type="number"
          min="20"
          max="120"
          step="1"
          value={value.durationSeconds}
          onChange={(event) => onChange({ ...value, durationSeconds: Number(event.target.value) })}
        />
      </label>
      <label>
        Video count
        <input
          aria-label="Story video count"
          type="number"
          min="1"
          max="6"
          step="1"
          value={value.count}
          onChange={(event) => onChange({ ...value, count: Number(event.target.value) })}
        />
      </label>
    </fieldset>
  );
}
