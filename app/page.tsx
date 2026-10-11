/*
THESIS: The horizon is the search. Night above holds unfound conversations; Run carries the composer over the rim and matches surface in daylight below. Refuses the split sentence-left/form-right hero.
OWN-WORLD: Night #030a24 dome with a cobalt #1f4bff rim fading to ice #dce8ff and white; stars and grain; frosted composer with pill chips and a Signal #2457f5 Run pill; white result cards with blue-tinted shadows; Host Grotesk with an italic second line.
STORY: Read the promise, describe the business or pick an example, Run; the composer docks; real stages light along the horizon rail; original words, fit and links surface below.
FIRST VIEWPORT: Night header; centered beta pill; two-line 5.6rem headline; subcopy; 720px composer on the rim with Run at its right edge; r/ cursor tags at the flanks; faded community strip at the pale bottom.
FORM: User-pinned reference (Luminai hero), not seeded; staging: centered composer hero → docked composer workspace.
*/
"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type CSSProperties,
} from "react";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import {
  terminalStages,
  sourceNames,
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
// Examples of preferred communities used alongside Reddit-wide search in lib/discovery.ts.
const communities = ["caloriecount", "loseit", "shopify", "selfhosted"];
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
function Cursor() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
      <path
        d="M2.5 2.5 15.5 8l-5.6 1.9L8 15.5z"
        fill="currentColor"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(130_000),
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new RequestError(
      "The connection was interrupted. Please try again.",
      0,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new RequestError(
      "The server could not complete this request. Please try again.",
      response.status,
    );
  }
  if (!response.ok)
    throw new RequestError(
      data.error || "The request could not finish. Try again.",
      response.status,
    );
  return data;
}
function when(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
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
  pending = false,
  scanId,
  onReply,
}: {
  item: Opportunity;
  index: number;
  onFeedback?: (item: Opportunity, action: "save" | "irrelevant") => void;
  pending?: boolean;
  scanId: string;
  onReply: (reply: string) => void;
}) {
  const [drafting, setDrafting] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const draftLock = useRef(false);
  const replyField = useRef<HTMLTextAreaElement>(null);
  async function suggest() {
    if (draftLock.current) return;
    draftLock.current = true;
    setDrafting(true);
    setReplyError("");
    try {
      const { reply } = await request<{ reply: string }>(
        `/api/scans/${encodeURIComponent(scanId)}/reply`,
        { method: "POST", body: JSON.stringify({ resultId: item.id }) },
      );
      onReply(reply);
    } catch (issue) {
      setReplyError(
        issue instanceof Error
          ? issue.message
          : "A reply could not be drafted. Please try again.",
      );
    } finally {
      setDrafting(false);
      draftLock.current = false;
    }
  }
  async function copyReply() {
    try {
      await navigator.clipboard.writeText(item.suggestedReply!);
      setCopyStatus("Copied");
    } catch {
      replyField.current?.focus();
      replyField.current?.select();
      setCopyStatus(
        "Copy unavailable. The reply is selected; copy it manually.",
      );
    }
  }
  const source = sourceNames[item.source || "reddit"];
  const publicationDate = item.synthetic ? null : when(item.publishedAt);
  return (
    <article
      className={`result ${item.synthetic ? "is-fictional" : ""} ${item.irrelevant ? "is-dismissed" : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="result-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="result-meta">
        <span className="tag">
          {item.synthetic
            ? "Fictional example"
            : item.kind === "comment"
              ? `${source} comment`
              : source}
        </span>
        {item.synthetic && <span>{source} sample</span>}
        {publicationDate && <span>{publicationDate}</span>}
        {item.community && <span>{item.community}</span>}
      </div>
      <h3>{item.title || item.evidence}</h3>
      <blockquote>{item.text || item.title}</blockquote>
      <div className="fit">
        <span className="fit-label">{item.need}</span>
        <p>{item.reason}</p>
      </div>
      {(item.source || "reddit") === "reddit" && (
        <div className="reply-draft" aria-busy={drafting}>
          <div className="reply-heading">
            <span className="fit-label">Suggested reply</span>
            {item.suggestedReply ? (
              <button
                type="button"
                className="reply-button"
                onClick={copyReply}
              >
                {copyStatus === "Copied" ? "Copied" : "Copy reply"}
              </button>
            ) : (
              <button
                type="button"
                className="reply-button"
                disabled={drafting}
                onClick={suggest}
              >
                {drafting
                  ? "Drafting…"
                  : replyError
                    ? "Try again"
                    : "Draft reply"}
              </button>
            )}
          </div>
          {item.suggestedReply && (
            <textarea
              ref={replyField}
              aria-label="Suggested reply"
              value={item.suggestedReply}
              readOnly
              rows={5}
            />
          )}
          <p className="reply-note">
            Review and copy when ready. Nothing is posted to Reddit.
          </p>
          {drafting && (
            <p role="status" className="reply-note">
              Writing a reply for this conversation…
            </p>
          )}
          {replyError && (
            <p className="error-message" role="alert">
              {replyError}
            </p>
          )}
          {copyStatus && (
            <p className="reply-note" role="status">
              {copyStatus}
            </p>
          )}
        </div>
      )}
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
        {onFeedback && (
          <div className="feedback-actions">
            <button
              aria-pressed={item.saved}
              disabled={pending}
              onClick={() => onFeedback(item, "save")}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="16"
                viewBox="0 0 16 18"
                fill={item.saved ? "currentColor" : "none"}
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
        )}
      </div>
    </article>
  );
}

export default function Home() {
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("live");
  const [scan, setScan] = useState<PublicScan | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [ready, setReady] = useState(false);
  const [developer, setDeveloper] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [freeSearchUsed, setFreeSearchUsed] = useState(false);
  const [freeScanId, setFreeScanId] = useState<string | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState(false);
  const [filter, setFilter] = useState<"all" | "saved">("all");
  const [pollPaused, setPollPaused] = useState(false);
  const runKey = useRef<string | null>(null);
  const submitLock = useRef(false);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const busy = starting || (!!scan && !terminalStages.includes(scan.stage));

  const remember = useCallback((next: PublicScan) => {
    setScan((current) => {
      if (current?.id !== next.id) return next;
      // A feedback response may have been read before an in-flight draft saved.
      return {
        ...next,
        results: next.results.map((item) => ({
          ...item,
          suggestedReply:
            item.suggestedReply ||
            current.results.find((result) => result.id === item.id)
              ?.suggestedReply,
        })),
      };
    });
    if (next.free && !next.developer) {
      setFreeSearchUsed(!!next.freeSearchUsed);
      setFreeScanId(next.id);
    }
    try {
      localStorage.setItem("threadfinder-scan", JSON.stringify({ id: next.id }));
    } catch {
      /* The server state still works without browser storage. */
    }
    if (terminalStages.includes(next.stage)) runKey.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const allowance = await request<{
          developer?: boolean;
          billingEnabled?: boolean;
          signedIn?: boolean;
          freeSearchUsed: boolean;
          freeScanId: string | null;
        }>("/api/session");
        if (!active) return;
        setDeveloper(!!allowance.developer);
        setBillingEnabled(!!allowance.billingEnabled);
        setSignedIn(!!allowance.signedIn);
        setFreeSearchUsed(allowance.freeSearchUsed);
        setFreeScanId(allowance.freeScanId);
        let cached: { id?: string } = {};
        try {
          if (!localStorage.getItem("threadfinder-scan")) {
            const previousKeys = Object.keys(localStorage).filter((key) => key.endsWith("-scan"));
            if (previousKeys.length === 1) {
              const previousKey = previousKeys[0];
              const previous = localStorage.getItem(previousKey);
              const parsed = previous ? JSON.parse(previous) : null;
              if (parsed && typeof parsed.id === "string") {
                localStorage.setItem("threadfinder-scan", JSON.stringify({ id: parsed.id }));
                localStorage.removeItem(previousKey);
              }
            }
          }
          const saved = JSON.parse(
            localStorage.getItem("threadfinder-scan") || "{}",
          );
          if (saved && typeof saved.id === "string") cached = { id: saved.id };
        } catch {
          /* Optional storage. */
        }
        if (allowance.freeScanId) cached.id = allowance.freeScanId;
        if (cached.id) {
          try {
            const previous = await request<PublicScan>(
              `/api/scans/${encodeURIComponent(cached.id)}`,
            );
            if (active) {
              if (
                allowance.developer ||
                (previous.mode === "live" && !previous.developer)
              ) {
                remember(previous);
                setDescription(previous.description);
                setMode(previous.mode);
              }
            }
          } catch (issue) {
            if (
              issue instanceof RequestError &&
              [403, 404].includes(issue.status)
            ) {
              setFreeScanId(null);
              try {
                localStorage.removeItem("threadfinder-scan");
              } catch {
                /* Optional storage. */
              }
            } else if (active) {
              setError(
                "Your previous results could not load. Reload the page to try again.",
              );
            }
          }
        }
        if (active) setReady(true);
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
        if (!terminalStages.includes(next.stage))
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
        body: JSON.stringify({
          description,
          mode: developer ? mode : "live",
          sources: ["reddit"],
          key: runKey.current,
        }),
      });
      // A transition lets the composer morph into its docked position.
      startTransition(() => remember(next));
      window.scrollTo({ top: 0 });
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Could not start this search.",
      );
      try {
        const allowance = await request<{
          developer?: boolean;
          freeSearchUsed: boolean;
          freeScanId: string | null;
        }>("/api/session");
        setDeveloper(!!allowance.developer);
        setFreeSearchUsed(allowance.freeSearchUsed);
        setFreeScanId(allowance.freeScanId);
      } catch {
        /* Keep the original request error. */
      }
    } finally {
      setStarting(false);
      submitLock.current = false;
    }
  }
  async function restoreFreeResults() {
    if (!freeScanId) return;
    try {
      const previous = await request<PublicScan>(`/api/scans/${freeScanId}`);
      startTransition(() => remember(previous));
      setMode("live");
      setDescription(previous.description);
      setError("");
    } catch (issue) {
      if (issue instanceof RequestError && issue.status === 404) {
        setFreeScanId(null);
        setError(
          "Your results have expired. Results are available for 24 hours after a search.",
        );
      } else {
        setError("Your results could not load. Please try again.");
      }
    }
  }
  function focusComposer(nextMode?: Mode) {
    if (nextMode && !busy) {
      setMode(nextMode);
      runKey.current = null;
    }
    window.scrollTo({ top: 0 });
    document.getElementById("description")?.focus({ preventScroll: true });
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
    startTransition(() => setScan(null));
    setError("");
    setPollPaused(false);
    setFilter("all");
    runKey.current = null;
    try {
      localStorage.removeItem("threadfinder-scan");
    } catch {
      /* Optional storage. */
    }
    document.getElementById("description")?.focus();
  }
  const visibleResults =
    scan?.results.filter((item) => filter === "all" || item.saved) || [];
  const finished = !!scan && terminalStages.includes(scan.stage);
  const currentStep = scan ? stageIndex[scan.stage] : -1;
  // Run and the textarea disable while working, so hand focus to the outcome once it renders.
  useEffect(() => {
    if (finished) resultsHeading.current?.focus();
  }, [finished]);
  const status =
    scan?.stage === "interpreting"
      ? "Reading your description"
      : scan?.stage === "preparing"
        ? "Preparing focused search phrases"
        : scan?.stage === "searching"
          ? scan.mode === "sample"
            ? "Loading fictional examples"
            : "Searching Reddit conversations"
          : scan?.stage === "reviewing"
            ? `Reviewing ${scan.retrieved ?? 0} conversations`
            : scan?.stage === "ranking"
              ? "Checking requests against your description"
              : "";

  return (
    <div className={`page ${scan ? "is-docked" : ""}`}>
      <a className="skip-link" href="#description">
        Skip to business description
      </a>
      <section className="hero" aria-labelledby="page-heading">
        <div className="sky" aria-hidden="true">
          <span className="beams" />
          <span className="stars" />
          <span className="stars stars-twinkle" />
        </div>
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="ThreadFinder home">
            <BrandMark size={24} />
            <span>
              ThreadFinder<span className="wordmark-period">.</span>
            </span>
          </Link>
          {!scan && (
            <nav className="site-nav" aria-label="Page">
              <a href="#how">How it works</a>
              <a href="#results-info">What you get</a>
            </nav>
          )}
          {(developer || billingEnabled) && (
            <nav className="account-nav" aria-label="Account">
              <Link href="/billing">Plans and billing</Link>
              {billingEnabled && !signedIn && (
                <a className="account-link" href="/api/auth/login?next=/">
                  Sign in / Sign up
                </a>
              )}
              {developer && (
                <button
                  type="button"
                  className="light-button"
                  onClick={() =>
                    focusComposer(mode === "sample" ? "live" : "sample")
                  }
                  disabled={busy}
                >
                  {mode === "sample" ? "Use live search" : "Try a sample"}
                </button>
              )}
            </nav>
          )}
        </header>

        {scan ? (
          <h1 id="page-heading" className="sr-only">
            Someone’s asking. You can help.
          </h1>
        ) : (
          <ViewTransition>
            <div className="hero-copy">
              <button
                type="button"
                className="beta-pill"
                onClick={() => focusComposer("live")}
              >
                <span className="beta-badge">Beta</span>
                <span>
                  One free Reddit search
                  <span className="pill-more">
                    , up to three useful results
                  </span>
                </span>
                <Arrow />
              </button>
              <h1 id="page-heading">
                Someone’s asking.
                <br />
                <em>You can help.</em>
              </h1>
              <p className="hero-sub">
                Find Reddit conversations about the problem your business
                solves. Describe it, review the original words, and decide where
                to join in.
              </p>
            </div>
          </ViewTransition>
        )}

        <ViewTransition name="composer">
          <form className="composer" onSubmit={run}>
            <div className="composer-head">
              <label htmlFor="description">
                Tell us what your business does
              </label>
              <span id="description-hint">
                <span className="hint-text">
                  A specific problem makes a better search ·{" "}
                </span>
                {description.length}/1,500
              </span>
            </div>
            <textarea
              id="description"
              value={description}
              onChange={(event) => changeDescription(event.target.value)}
              placeholder="We estimate calories from a food photo, so people can track meals without logging every ingredient…"
              rows={scan ? 2 : 3}
              minLength={20}
              maxLength={1500}
              required
              disabled={busy}
              aria-describedby="description-hint composer-note"
            />
            <div className="examples">
              <span>Try</span>
              {examples.map((example) => (
                <button
                  key={example.name}
                  type="button"
                  className="chip"
                  disabled={busy}
                  onClick={() => changeDescription(example.text)}
                >
                  {example.name}
                </button>
              ))}
            </div>
            <div className="composer-toolbar">
              <span className="chip source-chip">
                <BrandMark size={15} />
                Reddit
              </span>
              <button
                className="run-button"
                disabled={
                  busy ||
                  !ready ||
                  description.trim().length < 20 ||
                  (mode === "live" && freeSearchUsed && !developer)
                }
                type="submit"
              >
                {busy
                  ? "Working"
                  : mode === "live" && freeSearchUsed && !developer
                    ? "Free search used"
                    : "Run research"}
                {busy ? (
                  <span className="button-spinner" aria-hidden="true" />
                ) : (
                  <Arrow />
                )}
              </button>
            </div>
          </form>
        </ViewTransition>
        <div className="composer-note" id="composer-note">
          <p>
            {mode === "sample"
              ? "Fictional examples. No live search or original post links."
              : developer
                ? "Developer mode: repeated runs enabled. Each job remains cost-capped."
                : billingEnabled
                  ? signedIn
                    ? "Research uses your available trial or plan allowance."
                    : "Sign in to start your free trial or use your plan."
                  : freeSearchUsed
                    ? freeScanId
                      ? "Your free search has been used. Results are available in this browser for 24 hours after your search."
                      : "Your free search has been used. Its results are no longer available in this browser."
                    : "One free Reddit search. Up to three useful results."}
          </p>
          {billingEnabled && !signedIn && !developer && (
            <a className="account-link" href="/api/auth/login?next=/">
              Sign in or create an account <Arrow />
            </a>
          )}
          {developer && (
            <button
              type="button"
              className="text-button"
              onClick={async () => {
                try {
                  await request("/api/developer", { method: "DELETE" });
                  window.location.reload();
                } catch {
                  setError("Could not leave developer mode. Try again.");
                }
              }}
            >
              Leave developer mode
            </button>
          )}
          {!developer &&
            freeSearchUsed &&
            freeScanId &&
            (!scan || scan.mode !== "live") && (
              <button
                type="button"
                className="text-button"
                onClick={() => void restoreFreeResults()}
              >
                View your free results <Arrow />
              </button>
            )}
        </div>

        {!scan && (
          <>
            <div className="cursor-tags" aria-hidden="true">
              <span className="cursor-tag tag-a">
                <Cursor />
                <span>r/loseit</span>
              </span>
              <span className="cursor-tag tag-b">
                <Cursor />
                <span>r/shopify</span>
              </span>
              <span className="cursor-tag tag-c">
                <Cursor />
                <span>r/selfhosted</span>
              </span>
            </div>
            <div className="community-strip">
              <p>
                Searches curated communities where a category is known, and
                broader Reddit otherwise.
              </p>
              <ul>
                {communities.map((name) => (
                  <li key={name}>r/{name}</li>
                ))}
                <li>+ broader Reddit</li>
              </ul>
            </div>
          </>
        )}
      </section>

      <main>
        {error && (
          <div className="error-message" role="alert">
            <p>{error}</p>
            {billingEnabled && !signedIn && !developer && (
              <a className="account-link" href="/api/auth/login?next=/">
                Sign in or create an account <Arrow />
              </a>
            )}
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
            className="scan-section"
            aria-label="Search progress and results"
          >
            <div className={`progress-rail ${busy ? "is-running" : ""}`}>
              <ol>
                {stages.map((label, index) => (
                  <li
                    key={label}
                    className={`stage ${index < currentStep ? "done" : ""} ${index === currentStep ? "active" : ""}`}
                  >
                    <span className="stage-node" aria-hidden="true">
                      {index < currentStep ? "✓" : index + 1}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
              <span className="rail-mode">
                {scan.mode === "sample"
                  ? "Sample examples"
                  : (scan.sources || ["reddit"])
                      .map((source) => sourceNames[source])
                      .join(" + ")}
              </span>
            </div>
            {busy && (
              <div className="working-state">
                <p role="status" aria-live="polite">
                  {/* Keyed so each new stage swaps in; the live region itself stays mounted. */}
                  <span className="status-line" key={pollPaused ? "paused" : status}>
                    {pollPaused
                      ? "Search paused · resume when connected"
                      : status}
                  </span>
                </p>
                <span>
                  {scan.business
                    ? `Using product terms from your description`
                    : "Your input stays here while we work."}
                </span>
              </div>
            )}
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
            {scan.business && (
              <div className="scope">
                <p>
                  {scan.business.searchScope === "reddit-wide" ? (
                    <>
                      {scan.mode === "sample"
                        ? "Example Reddit-wide search"
                        : finished
                          ? "Searched across Reddit"
                          : "Searching across Reddit"}
                      {scan.business.communities?.length ? (
                        <>
                          {" "}
                          · additional focused queries in{" "}
                          {scan.business.communities.map((name) => (
                            <span className="community" key={name}>
                              r/{name}
                            </span>
                          ))}
                        </>
                      ) : (
                        " · business and problem keywords"
                      )}
                      .
                    </>
                  ) : scan.business.communities?.length ? (
                    <>
                      {scan.mode === "sample"
                        ? "Example community scope"
                        : finished
                          ? "Searched these communities"
                          : "Searching these communities"}
                      :{" "}
                      {scan.business.communities.map((name) => (
                        <span className="community" key={name}>
                          r/{name}
                        </span>
                      ))}{" "}
                      Community membership alone does not establish fit.
                    </>
                  ) : (
                    <>
                      {scan.mode === "sample"
                        ? "Example broader Reddit scope"
                        : finished
                          ? "Searched broader Reddit"
                          : "Searching broader Reddit"}
                      : no curated community is available for this category.
                    </>
                  )}
                </p>
                {developer && (
                  <details className="strategy">
                    <summary>
                      Search phrases <span>{scan.business.category}</span>
                    </summary>
                    <div className="queries">
                      {(scan.sourceRuns?.length
                        ? scan.sourceRuns
                        : [
                            {
                              source: "reddit" as const,
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
                          <code key={query}>{query}</code>
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
                      Searches explore product needs, concrete problems and
                      workarounds across Reddit. Coverage and recency depend on
                      publicly indexed sources.
                      {scan.modelReview === "OpenAI assessment"
                        ? " AI assesses the reported problem against the capabilities in your description."
                        : scan.modelReview === "Gemini + keyword rules"
                          ? " Gemini assessed up to five candidates; remaining candidates use keyword rules."
                          : " Keyword rules check the returned context."}{" "}
                      Dates show the age of each discussion. A match does not
                      prove purchase intent.
                    </p>
                  </details>
                )}
              </div>
            )}
            {finished && (
              <>
                <div className="results-heading">
                  <div>
                    <p className="section-label">
                      {scan.mode === "sample"
                        ? "An example of your results"
                        : scan.results.length
                          ? "Conversations to review"
                          : "Search outcome"}
                    </p>
                    <h2 ref={resultsHeading} tabIndex={-1}>
                      {scan.stage === "failed"
                        ? "This search couldn’t finish."
                        : scan.results.length
                          ? `${scan.results.length} ${scan.mode === "sample" ? (scan.results.length === 1 ? "example" : "examples") : scan.results.length === 1 ? "match" : "matches"} worth a closer look.`
                          : scan.stage === "partial"
                            ? "No matches from this incomplete search."
                            : "No suitable matches in this search."}
                    </h2>
                  </div>
                  <button className="ghost-button" onClick={reset}>
                    {developer || !freeSearchUsed
                      ? "New search"
                      : "Back to overview"}{" "}
                    <Arrow />
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
                <div className="results">
                  {visibleResults.map((item, index) => (
                    <Result
                      key={`${scan.id}:${item.id}`}
                      item={item}
                      index={index}
                      onFeedback={feedback}
                      pending={pendingFeedback}
                      scanId={scan.id}
                      onReply={(reply) =>
                        setScan((current) =>
                          current?.id === scan.id
                            ? {
                                ...current,
                                results: current.results.map((result) =>
                                  result.id === item.id
                                    ? { ...result, suggestedReply: reply }
                                    : result,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  ))}
                </div>
                {!!scan.lockedCount && (
                  <section
                    className="empty-state"
                    aria-label="Additional collected matches"
                  >
                    <h3>
                      {scan.lockedCount} more{" "}
                      {scan.lockedCount === 1
                        ? "conversation"
                        : "conversations"}{" "}
                      in this search.
                    </h3>
                    <div className="locked-previews" aria-hidden="true">
                      {Array.from(
                        { length: Math.min(3, scan.lockedCount) },
                        (_, index) => (
                          <div className="locked-preview" key={index}>
                            <span />
                            <span />
                            <span />
                          </div>
                        ),
                      )}
                    </div>
                    <p>
                      Your free preview includes three matches. Subscription
                      access will unlock the rest of the collected list.
                    </p>
                    <p>{billingEnabled ? <Link href="/billing">See plans and start a full research search</Link> : "Subscriptions are coming soon."}</p>
                  </section>
                )}
                {scan.results.length > 0 && !visibleResults.length && (
                  <div className="empty-state">
                    <h3>Your shortlist starts here.</h3>
                    <p>Save a result and it will appear in this view.</p>
                    <button
                      className="ghost-button"
                      onClick={() => setFilter("all")}
                    >
                      View all results
                    </button>
                  </div>
                )}
                {!scan.results.length && scan.stage !== "failed" && (
                  <div className="empty-state">
                    <h3>
                      {scan.developer
                        ? "Try another developer search."
                        : scan.free
                          ? "Your free search has been used."
                          : "A little more detail can help."}
                    </h3>
                    <p>
                      {scan.mode === "sample"
                        ? "This small fixture set covers food-photo tracking, Shopify discounts, and website uptime. An unrelated business can correctly return no examples."
                        : scan.developer
                          ? `${scan.retrieved ?? 0} records were returned; none passed the fit checks. You can refine your description and run another developer search.`
                          : scan.free
                            ? scan.stage === "partial"
                              ? "None of the returned records passed the fit checks, and the source stopped early. This does not mean relevant conversations do not exist. This search does not cover every Reddit conversation."
                              : `${scan.retrieved ?? 0} records were returned; none passed the fit checks. This small sample does not mean relevant conversations do not exist. This search does not cover every Reddit conversation.`
                            : scan.stage === "partial"
                              ? "No returned record passed the fit checks, and some source work failed. Review the source status before running another bounded search."
                              : "No returned record passed the context-and-fit checks. Describe the problem you solve more specifically, then run another bounded search."}
                    </p>
                    {(!scan.free || scan.developer) && (
                      <button className="ghost-button" onClick={reset}>
                        Refine the description <Arrow />
                      </button>
                    )}
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
          <>
            <section id="how" className="steps" aria-labelledby="how-heading">
              <h2 id="how-heading">Listen first, then be useful.</h2>
              <ol>
                <li>
                  <span className="step-node" aria-hidden="true" />
                  <h3>Tell us what you solve.</h3>
                  <p>A few sentences, with the details that matter.</p>
                </li>
                <li>
                  <span className="step-node" aria-hidden="true" />
                  <h3>Find a relevant request.</h3>
                  <p>Look for a real need and a reason you fit.</p>
                </li>
                <li>
                  <span className="step-node" aria-hidden="true" />
                  <h3>Join as yourself.</h3>
                  <p>Open the thread and disclose your affiliation.</p>
                </li>
              </ol>
            </section>
            <section
              id="results-info"
              className="example"
              aria-labelledby="results-info-heading"
            >
              <div className="example-copy">
                <h2 id="results-info-heading">
                  The context to make a useful reply.
                </h2>
                <p>
                  Review up to three relevant conversations, with the original
                  words, discussion dates, and an explanation of how your
                  business fits. Open each thread to read the full context.
                </p>
              </div>
              <div className="results-info">
                <h3>Keep the conversations that matter.</h3>
                <p>
                  Save a match to your shortlist or mark it as not relevant.
                  Your results and feedback are available in this browser for 24
                  hours after your search.
                </p>
                <p>
                  One free search per browser. A search may return fewer than
                  three matches, including none. Matches suggest relevance; they
                  do not establish buying intent. Replies are always up to you.
                </p>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        {!scan && (
          <div className="footer-cta">
            <h2>Find a conversation worth joining.</h2>
            <button
              type="button"
              className="run-button"
              onClick={() => focusComposer()}
            >
              Describe your business <Arrow />
            </button>
          </div>
        )}
        <div className="footer-line">
          <span>
            ThreadFinder.{" "}
            <span className="footer-sub">Listen first. Be useful.</span>
          </span>
          <Link href="/privacy">Privacy &amp; data</Link>
        </div>
      </footer>
    </div>
  );
}
