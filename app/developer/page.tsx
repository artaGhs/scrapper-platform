"use client";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function DeveloperAccess() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="page">
      <section className="hero access" aria-labelledby="access-heading">
        <div className="sky" aria-hidden="true">
          <span className="stars" />
        </div>
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="ThreadFinder home">
            <BrandMark size={24} />
            <span>
              ThreadFinder<span className="wordmark-period">.</span>
            </span>
          </Link>
        </header>
        <div className="hero-copy">
          <span className="beta-badge">Private access</span>
          <h1 id="access-heading">Developer mode</h1>
          <p className="hero-sub">
            Run repeated research without visitor quotas. Each source job keeps
            its cost cap and timeout.
          </p>
        </div>
        <form
          className="composer"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const response = await fetch("/api/developer", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ key }),
              });
              setKey("");
              if (!response.ok)
                throw Error(
                  (await response.json()).error ||
                    "Could not enable developer mode.",
                );
              router.push("/");
              router.refresh();
            } catch (issue) {
              setError(
                issue instanceof Error
                  ? issue.message
                  : "Could not enable developer mode.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="composer-head">
            <label htmlFor="developer-key">Developer access key</label>
          </div>
          <input
            id="developer-key"
            className="developer-key"
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            required
            minLength={32}
            maxLength={256}
          />
          <div className="composer-toolbar">
            <Link href="/" className="text-button">
              Back to research
            </Link>
            <button
              className="run-button"
              type="submit"
              disabled={busy || key.length < 32}
            >
              {busy ? "Enabling…" : "Enable developer mode"}
            </button>
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
