import { useMemo, useState } from "react";
import type { RepositoryUnderstanding, SourceExcerpt } from "@hyperframes/studio-server";
import "./SourceReview.css";

function Excerpt({ evidence }: { evidence: SourceExcerpt }) {
  return (
    <div className="vf-source-excerpt">
      <p>
        <code>
          {evidence.path}:{evidence.startLine}–{evidence.endLine}
        </code>
      </p>
      <pre aria-label={`Source excerpt ${evidence.path}`}>
        <code>
          {evidence.text.split("\n").map((text, index) => (
            <span key={index}>
              <i aria-hidden="true">{evidence.startLine + index}</i>
              {text}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
      <small>
        Captured file SHA-256: <code>{evidence.sha256}</code>
      </small>
    </div>
  );
}

export function SourceReview({ understanding }: { understanding: RepositoryUnderstanding }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uncertaintyLimit, setUncertaintyLimit] = useState(20);
  const filtered = useMemo(
    () =>
      understanding.observations.filter(
        (item) =>
          (kind === "all" || item.kind === kind) &&
          `${item.name} ${item.summary} ${item.evidence.path}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [understanding, query, kind],
  );
  const selected = understanding.observations.find((item) => item.id === selectedId);
  const byId = useMemo(
    () => new Map(understanding.observations.map((item) => [item.id, item])),
    [understanding],
  );
  const relationships = selected
    ? understanding.relationships.filter(
        (item) => item.from === selected.id || item.to === selected.id,
      )
    : [];
  return (
    <section className="vf-source-review" aria-label="Repository understanding">
      <h3>What the source shows</h3>
      <p>
        {understanding.coverage.parsedFiles} implementation files parsed ·{" "}
        {understanding.coverage.documentedFiles} documentation files ·{" "}
        {understanding.relationships.length} source relationships
      </p>
      <p className="vf-muted">
        Review the captured lines behind each finding. Documentation describes the author’s claims.
        Source relationships show imports, call sites and handler registrations; runtime behavior
        still needs verification.
      </p>
      <div className="vf-source-filters">
        <label>
          Search source findings
          <input
            aria-label="Search source findings"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(30);
            }}
          />
        </label>
        <label>
          Finding type
          <select
            aria-label="Finding type"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setLimit(30);
            }}
          >
            <option value="all">All findings</option>
            {(
              [
                "api",
                "function",
                "model",
                "class",
                "entrypoint",
                "module",
                "documentation",
              ] as const
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="vf-source-columns">
        <div>
          <p role="status">{filtered.length} matching findings</p>
          <ul className="vf-source-findings">
            {filtered.slice(0, limit).map((item) => (
              <li key={item.id}>
                <button
                  aria-pressed={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <small>
                    {item.kind} · {item.basis}
                  </small>
                  <strong>{item.name}</strong>
                  <span>
                    {item.evidence.path}:{item.evidence.startLine}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > limit && (
            <button onClick={() => setLimit(limit + 30)}>Show 30 more findings</button>
          )}
        </div>
        <div className="vf-source-detail" aria-live="polite">
          {selected ? (
            <>
              <h4>{selected.name}</h4>
              <p>{selected.summary}</p>
              <Excerpt evidence={selected.evidence} />
              <h4>{relationships.length} related source observations</h4>
              {relationships.map((relationship) => (
                <details key={relationship.id}>
                  <summary>{relationship.description}</summary>
                  <p>
                    {byId.get(relationship.from)?.name} → {byId.get(relationship.to)?.name}
                  </p>
                  <Excerpt evidence={relationship.evidence} />
                  <button
                    onClick={() =>
                      setSelectedId(
                        relationship.from === selected.id ? relationship.to : relationship.from,
                      )
                    }
                  >
                    Inspect connected finding
                  </button>
                </details>
              ))}
            </>
          ) : (
            <p>Select a finding to read its source and inspect its relationships.</p>
          )}
        </div>
      </div>
      <details className="vf-source-uncertainties">
        <summary>{understanding.uncertainties.length} uncertainties and analysis limits</summary>
        <p>
          {understanding.coverage.capturedFiles} captured files.{" "}
          {understanding.coverage.unsupportedFiles.length} source files have no semantic language
          adapter yet.
        </p>
        <ul>
          {understanding.uncertainties.slice(0, uncertaintyLimit).map((item, index) => (
            <li key={index}>
              <strong>{item.code}</strong>
              {item.path && (
                <code>
                  {" "}
                  {item.path}
                  {item.line ? `:${item.line}` : ""}
                </code>
              )}
              <p>{item.message}</p>
            </li>
          ))}
        </ul>
        {understanding.uncertainties.length > uncertaintyLimit && (
          <button onClick={() => setUncertaintyLimit(uncertaintyLimit + 50)}>
            Show 50 more uncertainties
          </button>
        )}
      </details>
    </section>
  );
}
