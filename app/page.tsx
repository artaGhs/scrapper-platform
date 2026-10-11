/*
THESIS: One description becomes a few conversations worth reviewing; the input is the demonstration.
OWN-WORLD: Pale green desk, green ink, white writing surface, ruled result list, connected stage rail.
STORY: Explain what you offer, run a bounded scan, inspect original words and fit, choose whether to join.
FIRST VIEWPORT: Wordmark above large left-hand sentence; form on the right; sample disclosure next to Run.
FORM: Conversation desk, grounded candidate four, seed 4652c18f; input-to-list staging, no raster assets.
*/
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  terminalStages,
  sourceNames,
  type Source,
  type Mode,
  type Opportunity,
  type PublicScan,
  type Stage,
} from "@/lib/types";

const examples = [
  {
    name: "Food photo app",
    text: "Our app estimates calories from a food photo, so people can track meals without manually entering every ingredient.",
  },
  {
    name: "Shopify app",
    text: "We help Shopify stores send automatic unique discount codes in welcome emails, instead of manually creating a code for every subscriber.",
  },
  {
    name: "Uptime monitor",
    text: "Our website uptime monitor sends a Slack alert when a site goes down, so small teams notice downtime quickly.",
  },
];
const stages = ["Understand", "Search", "Review"] as const;
const stageIndex: Record<Stage, number> = {
  interpreting: 0,
  preparing: 0,
  searching: 1,
  reviewing: 2,
  ranking: 2,
  complete: 3,
  empty: 3,
  partial: 3,
  failed: -1,
};
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {diagonal ? (
        <path d="M7 17 17 7M7 7h10v10" />
      ) : (
        <path d="M4 12h16m-6-6 6 6-6 6" />
      )}
    </svg>
  );
}
function Mark() {
  return (
    <svg
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
    >
      <path
        d="M3 5h22v15H14l-8 5v-5H3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h12M8 15h7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request could not finish. Try again.");
  return data;
}
function when(value: string | null) {
  if (!value) return "Time unknown";
  return (
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value)) +
    ` · ${Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86400_000))} days ago`
  );
}
function Result({
  item,
  index,
  onFeedback,
  pending,
}: {
  item: Opportunity;
  index: number;
  onFeedback: (item: Opportunity, action: "save" | "irrelevant") => void;
  pending: boolean;
}) {
  return (
    <article className={`result ${item.irrelevant ? "muted-result" : ""}`}>
      <div className="result-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="result-content">
        <div className="result-meta">
          <span className={`tag ${item.synthetic ? "sample-tag" : ""}`}>
            {item.synthetic
              ? "Fictional example"
              : sourceNames[item.source || "reddit"]}
          </span>
          {item.synthetic && (
            <span>{sourceNames[item.source || "reddit"]} sample</span>
          )}
          <span>
            {item.synthetic ? "No publication date" : when(item.publishedAt)}
          </span>
          {item.community && <span>{item.community}</span>}
        </div>
        <h3>{item.title || item.evidence}</h3>
        <blockquote>{item.text || item.title}</blockquote>
        <div className="fit">
          <span className="fit-label">
            {item.need}
            {!item.synthetic && item.reviewMethod
              ? ` · ${item.reviewMethod}`
              : ""}
          </span>
          <p>{item.reason}</p>
        </div>
        <div className="result-actions">
          {item.url ? (
            <a
              className="original-link"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original <Arrow diagonal />
            </a>
          ) : (
            <span className="sample-source">
              Illustrative text · no original post
            </span>
          )}
          <div className="feedback-actions">
            <button
              aria-pressed={item.saved}
              disabled={pending}
              onClick={() => onFeedback(item, "save")}
              className={item.saved ? "selected" : ""}
            >
              <svg
                aria-hidden="true"
                width="15"
                height="17"
                viewBox="0 0 16 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 2h10v14l-5-3-5 3z" />
              </svg>
              {item.saved ? "Saved" : "Save"}
            </button>
            <button
              aria-pressed={item.irrelevant}
              disabled={pending}
              onClick={() => onFeedback(item, "irrelevant")}
            >
              {item.irrelevant ? "Undo feedback" : "Not relevant"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [description, setDescription] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const progressSection = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>("sample");
  const [scan, setScan] = useState<PublicScan | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [ready, setReady] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState(false);
  const [filter, setFilter] = useState<"all" | "saved">("all");
  const [pollPaused, setPollPaused] = useState(false);
  const runKey = useRef<string | null>(null);
  const submitLock = useRef(false);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const busy = starting || (!!scan && !terminalStages.includes(scan.stage));

  const remember = useCallback((next: PublicScan) => {
    setScan(next);
    try {
      localStorage.setItem("scrapper-scan", JSON.stringify({ id: next.id }));
    } catch {
      /* The server state still works without browser storage. */
    }
    if (terminalStages.includes(next.stage)) runKey.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        await request("/api/session");
        if (!active) return;
        setReady(true);
        let cached: { id?: string } = {};
        try {
          cached = JSON.parse(localStorage.getItem("scrapper-scan") || "{}");
        } catch {
          /* Optional storage. */
        }
        if (cached.id) {
          try {
            const previous = await request<PublicScan>(
              `/api/scans/${encodeURIComponent(cached.id)}`,
            );
            if (active) {
              remember(previous);
              setDescription(previous.description);
              setMode(previous.mode);
            }
          } catch {
            try {
              localStorage.removeItem("scrapper-scan");
            } catch {
              /* Optional storage. */
            }
          }
        }
      } catch {
        if (active)
          setError(
            "Could not connect to the server. Reload the page to try again.",
          );
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [remember]);

  useEffect(() => {
    if (!scan || terminalStages.includes(scan.stage) || pollPaused) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const id = scan.id;
    async function poll() {
      try {
        const next = await request<PublicScan>(`/api/scans/${id}`, {
          method: "POST",
        });
        if (stopped) return;
        remember(next);
        if (terminalStages.includes(next.stage)) {
          setTimeout(() => resultsHeading.current?.focus(), 0);
        } else
          timer = setTimeout(
            poll,
            next.mode === "live" && next.stage === "searching" ? 2500 : 650,
          );
      } catch (issue) {
        if (!stopped) {
          setError(
            issue instanceof Error ? issue.message : "Search connection lost.",
          );
          setPollPaused(true);
        }
      }
    }
    timer = setTimeout(poll, 650);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // One polling loop per ID. It reads successive server states without recreating a job.
  }, [scan?.id, pollPaused, remember]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current || busy || !ready) return;
    submitLock.current = true;
    setStarting(true);
    setError("");
    setFilter("all");
    setPollPaused(false);
    runKey.current ??= crypto.randomUUID();
    try {
      const next = await request<PublicScan>("/api/scans", {
        method: "POST",
        headers: mode === "live" ? { "x-live-access": accessCode } : {},
        body: JSON.stringify({
          description,
          mode,
          sources: ["reddit"],
          key: runKey.current,
        }),
      });
      remember(next);
      requestAnimationFrame(() =>
        progressSection.current?.scrollIntoView({
          block: "start",
          behavior: "auto",
        }),
      );
      if (terminalStages.includes(next.stage)) resultsHeading.current?.focus();
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Could not start this search.",
      );
    } finally {
      setStarting(false);
      submitLock.current = false;
    }
  }
  function changeDescription(value: string) {
    setDescription(value);
    runKey.current = null;
  }
  async function feedback(item: Opportunity, action: "save" | "irrelevant") {
    if (!scan || pendingFeedback) return;
    setPendingFeedback(true);
    setError("");
    try {
      remember(
        await request<PublicScan>(`/api/scans/${scan.id}/feedback`, {
          method: "POST",
          body: JSON.stringify({
            resultId: item.id,
            action,
            value: action === "save" ? !item.saved : !item.irrelevant,
          }),
        }),
      );
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Feedback could not be saved.",
      );
    } finally {
      setPendingFeedback(false);
    }
  }
  function reset() {
    setScan(null);
    setError("");
    setPollPaused(false);
    setFilter("all");
    runKey.current = null;
    try {
      localStorage.removeItem("scrapper-scan");
    } catch {
      /* Optional storage. */
    }
    document.getElementById("description")?.focus();
  }
  const visibleResults =
    scan?.results.filter((item) => filter === "all" || item.saved) || [];
  const finished = !!scan && terminalStages.includes(scan.stage);
  const currentStep = scan ? stageIndex[scan.stage] : -1;
  const status =
    scan?.stage === "interpreting"
      ? "Reading your description"
      : scan?.stage === "preparing"
        ? "Preparing focused search phrases"
        : scan?.stage === "searching"
          ? scan.mode === "sample"
            ? "Loading fictional examples"
            : "Waiting for source jobs"
          : scan?.stage === "reviewing"
            ? `Reviewing ${scan.retrieved ?? 0} returned records`
            : scan?.stage === "ranking"
              ? "Checking requests against your description"
              : "";

  return (
    <>
      <a className="skip-link" href="#description">
        Skip to business description
      </a>
      <header className="site-header">
        <Link href="/" className="wordmark" aria-label="Scrapper home">
          <Mark />
          <span>
            scrapper<span className="wordmark-period">.</span>
          </span>
        </Link>
        <span className="header-note">
          <span className="status-dot" />A conversation discovery prototype
        </span>
      </header>
      <main>
        <section className="workspace" aria-labelledby="page-heading">
          <div className="intro">
            <p className="intro-label">
              <span className="small-line" />
              Good opportunities start with listening
            </p>
            <h1 id="page-heading">
              Someone’s asking.
              <br />
              <span>You can help.</span>
            </h1>
            <p className="intro-copy">
              Find Reddit conversations about the problem your business solves.
              Describe it, review the original words, and decide where to join
              in.
            </p>
            <div className="intro-note">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m4 10 4 4 8-8" />
              </svg>
              <span>Original words. Clear reasons. You make the call.</span>
            </div>
          </div>
          <div className="compose-panel">
            <div className="panel-heading">
              <h2>Your business, in a few words.</h2>
              <span className="tag">
                {mode === "sample" ? "Sample mode" : "Live search"}
              </span>
            </div>
            <form onSubmit={run}>
              <label htmlFor="description" className="field-label">
                Tell us what your business does
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => changeDescription(event.target.value)}
                placeholder="We estimate calories from a food photo, so people can track meals without logging every ingredient…"
                rows={5}
                minLength={20}
                maxLength={1500}
                required
                disabled={busy}
                aria-describedby="description-hint"
              />
              <div className="input-hint" id="description-hint">
                <span>A specific problem makes a better search.</span>
                <span>{description.length}/1,500</span>
              </div>
              <div className="examples">
                <span>Try a description</span>
                <div>
                  {examples.map((example) => (
                    <button
                      key={example.name}
                      type="button"
                      disabled={busy}
                      onClick={() => changeDescription(example.text)}
                    >
                      {example.name}
                      <span aria-hidden="true"> +</span>
                    </button>
                  ))}
                </div>
              </div>
              <fieldset className="mode-options" disabled={busy}>
                <legend>Search mode</legend>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="sample"
                    checked={mode === "sample"}
                    onChange={() => {
                      setMode("sample");
                      runKey.current = null;
                    }}
                  />
                  <span>Sample examples</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="live"
                    checked={mode === "live"}
                    onChange={() => {
                      setMode("live");
                      runKey.current = null;
                    }}
                  />
                  <span>Live search</span>
                </label>
              </fieldset>
              {mode === "live" && (
                <div className="pilot-access">
                  <label htmlFor="access-code" className="field-label">
                    Pilot access code
                  </label>
                  <input
                    id="access-code"
                    type="password"
                    autoComplete="off"
                    value={accessCode}
                    onChange={(event) => setAccessCode(event.target.value)}
                    disabled={busy}
                    placeholder="Provided by the operator"
                  />
                </div>
              )}
              <div className="run-row">
                <p>
                  {mode === "sample"
                    ? "Fictional examples. No live search or original post links."
                    : "Reddit: up to 50 records. Access code required."}
                </p>
                <button
                  className="run-button"
                  disabled={busy || !ready || description.trim().length < 20}
                  type="submit"
                >
                  {busy ? "Working" : "Run research"}
                  {busy ? (
                    <span className="button-spinner" aria-hidden="true" />
                  ) : (
                    <Arrow />
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        {error && (
          <div className="error-message" role="alert">
            <p>{error}</p>
            {pollPaused && (
              <button
                onClick={() => {
                  setError("");
                  setPollPaused(false);
                }}
              >
                Resume this search
              </button>
            )}
          </div>
        )}

        {scan && (
          <section
            ref={progressSection}
            className="scan-section"
            aria-label="Search progress and results"
          >
            <div className={`progress-rail ${busy ? "is-running" : ""}`}>
              {stages.map((label, index) => (
                <div
                  key={label}
                  className={`stage ${index < currentStep ? "done" : ""} ${index === currentStep ? "active" : ""}`}
                >
                  <span className="stage-node" aria-hidden="true">
                    {index < currentStep ? "✓" : index + 1}
                  </span>
                  <span>{label}</span>
                </div>
              ))}
              <span className="rail-mode">
                {scan.mode === "sample"
                  ? "Sample examples"
                  : (scan.sources || ["reddit"])
                      .map((source) => sourceNames[source])
                      .join(" + ")}
              </span>
            </div>
            {!!scan.sourceRuns?.length && (
              <ul className="source-progress" aria-label="Source progress">
                {scan.sourceRuns.map((run) => (
                  <li key={run.source}>
                    <strong>{sourceNames[run.source]}</strong>
                    <span>
                      {scan.mode === "sample" ? "Sample · " : ""}
                      {run.status === "queued"
                        ? "Waiting to start"
                        : run.status === "searching"
                          ? scan.mode === "sample"
                            ? "Loading examples"
                            : "Searching"
                          : run.status === "complete"
                            ? `${run.retrieved} records returned`
                            : run.status === "partial"
                              ? `${run.retrieved} records · stopped early`
                              : "Could not finish"}
                    </span>
                    {run.error && <p>{run.error}</p>}
                  </li>
                ))}
              </ul>
            )}
            {busy && (
              <div className="working-state">
                <div className="working-line" aria-hidden="true" />
                <p role="status" aria-live="polite">
                  {pollPaused
                    ? "Search paused · resume when connected"
                    : status}
                </p>
                <span>
                  {scan.business
                    ? `Using product terms from your description`
                    : "Your input stays here while we work."}
                </span>
              </div>
            )}
            {scan.business?.communities?.length ? (
              <p className="sample-disclosure">
                {scan.mode === "sample"
                  ? "Example community scope"
                  : finished
                    ? "Searched these communities"
                    : "Searching these communities"}
                :{" "}
                {scan.business.communities
                  .map((name) => `r/${name}`)
                  .join(", ")}
                . Community membership alone does not establish fit.
              </p>
            ) : scan.business ? (
              <p className="sample-disclosure">
                {scan.mode === "sample"
                  ? "Example broader Reddit scope"
                  : finished
                    ? "Searched broader Reddit"
                    : "Searching broader Reddit"}
                : no curated community is available for this category.
              </p>
            ) : null}
            {scan.business && (
              <details className="strategy">
                <summary>
                  Search phrases <span>{scan.business.category}</span>
                </summary>
                <div>
                  {(scan.sourceRuns?.length
                    ? scan.sourceRuns
                    : [
                        {
                          source: "reddit" as Source,
                          queries: scan.business.queries,
                        },
                      ]
                  )
                    .flatMap((run) =>
                      (run.queries || []).map(
                        (query) => `${sourceNames[run.source]}: ${query}`,
                      ),
                    )
                    .map((query) => (
                      <span key={query}>{query}</span>
                    ))}
                </div>
                {scan.sourceRuns?.flatMap((run) =>
                  (run.queryPlans || []).map((plan) => (
                    <p key={`${run.source}:${plan.phrase}`}>
                      <strong>{plan.phrase}</strong> — {plan.rationale}
                    </p>
                  )),
                )}
                <p>
                  Reddit searches the past year. Category and problem phrases
                  find candidates, then context and fit checks qualify them.
                  {scan.modelReview === "Gemini + keyword rules"
                    ? " Gemini assessed up to five candidates; remaining candidates use keyword rules."
                    : " Keyword rules check the returned context."}{" "}
                  Dates show the age of each discussion. A match does not prove
                  purchase intent.
                </p>
              </details>
            )}
            {finished && (
              <>
                <div className="results-heading">
                  <div>
                    <p className="section-label">
                      {scan.mode === "sample"
                        ? "An example of your results"
                        : "Conversations to review"}
                    </p>
                    <h2 ref={resultsHeading} tabIndex={-1}>
                      {scan.stage === "failed"
                        ? "This search couldn’t finish."
                        : scan.results.length
                          ? `${scan.results.length} ${scan.mode === "sample" ? (scan.results.length === 1 ? "example" : "examples") : scan.results.length === 1 ? "match" : "matches"} worth a closer look.`
                          : scan.stage === "partial"
                            ? "Search finished with gaps."
                            : "No strong matches this time."}
                    </h2>
                  </div>
                  <button className="text-button" onClick={reset}>
                    Start over <Arrow />
                  </button>
                </div>
                {scan.mode === "sample" && (
                  <p className="sample-disclosure">
                    These are fictional discussions that demonstrate matching.
                    They were not found on Reddit, have no original URLs or
                    dates, and are not leads.
                  </p>
                )}
                {scan.notice && (
                  <p className="notice" role="status">
                    {scan.notice}
                  </p>
                )}
                {scan.error && (
                  <p className="error-message" role="alert">
                    {scan.error}
                  </p>
                )}
                {!!scan.results.length && (
                  <div className="results-toolbar">
                    <div className="filters" aria-label="Result filter">
                      <button
                        aria-pressed={filter === "all"}
                        onClick={() => setFilter("all")}
                      >
                        All {scan.results.length}
                      </button>
                      <button
                        aria-pressed={filter === "saved"}
                        onClick={() => setFilter("saved")}
                      >
                        Saved {scan.results.filter((item) => item.saved).length}
                      </button>
                    </div>
                    <span>Ranked by fit, not purchase probability</span>
                  </div>
                )}
                {visibleResults.map((item, index) => (
                  <Result
                    key={item.id}
                    item={item}
                    index={index}
                    onFeedback={feedback}
                    pending={pendingFeedback}
                  />
                ))}
                {(scan.lockedCount || 0) > 0 && filter === "all" && (
                  <section
                    className="report-preview"
                    aria-label="Additional results preview"
                  >
                    <h3>
                      {scan.matchCount} matches found. Your first three are
                      above.
                    </h3>
                    <p>
                      {scan.lockedCount} additional{" "}
                      {scan.lockedCount === 1 ? "match is" : "matches are"}{" "}
                      retained in this research report. Full-report access is
                      planned; payments and unlocking are not available in this
                      pilot.
                    </p>
                    <div className="locked-previews" aria-hidden="true">
                      {Array.from(
                        { length: Math.min(3, scan.lockedCount || 0) },
                        (_, index) => (
                          <div className="locked-preview" key={index}>
                            <span />
                            <span />
                            <span />
                          </div>
                        ),
                      )}
                    </div>
                    <small>
                      Hidden titles, text and original links stay on the server.
                    </small>
                  </section>
                )}
                {scan.results.length > 0 && !visibleResults.length && (
                  <div className="empty-state">
                    <h3>Your shortlist starts here.</h3>
                    <p>Save a result and it will appear in this view.</p>
                    <button onClick={() => setFilter("all")}>
                      View all results
                    </button>
                  </div>
                )}
                {!scan.results.length && scan.stage !== "failed" && (
                  <div className="empty-state">
                    <h3>A little more detail can help.</h3>
                    <p>
                      {scan.mode === "sample"
                        ? "This small fixture set covers food-photo tracking, Shopify discounts, and website uptime. An unrelated business can correctly return no examples."
                        : scan.stage === "partial"
                          ? "No returned record passed the fit checks, and some source work failed. Review the source status before running another bounded search."
                          : "No returned record passed the context-and-fit checks. Describe the problem you solve more specifically, then run another bounded search."}
                    </p>
                    <button onClick={reset}>
                      Refine the description <Arrow />
                    </button>
                  </div>
                )}
                {scan.retrieved !== undefined && (
                  <p className="result-footnote">
                    Reviewed {scan.retrieved}{" "}
                    {scan.mode === "sample"
                      ? "fictional records"
                      : "returned records"}
                    .{" "}
                    {scan.mode === "live"
                      ? "This bounded search does not cover all conversations on the selected sources."
                      : "Sample mode makes no external data calls."}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {!scan && (
          <section className="how-it-works" aria-label="How it works">
            <div>
              <span>Tell us what you solve.</span>
              <p>A few sentences, with the details that matter.</p>
            </div>
            <Arrow />
            <div>
              <span>Find a relevant request.</span>
              <p>Look for a real need and a reason you fit.</p>
            </div>
            <Arrow />
            <div>
              <span>Join as yourself.</span>
              <p>Open the thread and disclose your affiliation.</p>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span>
          scrapper. <span className="footer-sub">Listen first. Be useful.</span>
        </span>
        <span>Search beta · Human replies only</span>
      </footer>
    </>
  );
}
