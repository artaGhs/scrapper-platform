"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function DeveloperAccess() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main>
      <section className="workspace">
        <div className="intro">
          <p className="section-label">Private access</p>
          <h1>Developer mode</h1>
          <p className="intro-copy">
            Run repeated research without visitor quotas. Each source job keeps
            its cost cap and timeout.
          </p>
        </div>
        <div className="compose-panel">
          <form
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
            <label htmlFor="developer-key" className="field-label">
              Developer access key
            </label>
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
            <div className="run-row">
              <button type="submit" disabled={busy || key.length < 32}>
                {busy ? "Enabling…" : "Enable developer mode"}
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
          </form>
          <p>
            <Link href="/">Back to research</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
