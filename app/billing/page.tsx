"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PAID_PLANS, TRIAL_DAYS, TRIAL_SEARCHES } from "@/lib/pricing";

export default function BillingPage() {
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [trial, setTrial] = useState<{ expiresAt: number; used: boolean; available: boolean } | null>(null);
  const [message, setMessage] = useState("Opening billing…");
  async function openHosted(destination: "pricing" | "portal") {
    if (opening) return;
    setOpening(true);
    setMessage("Opening secure billing…");
    try {
      const response = await fetch("/api/billing/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Billing is unavailable.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("The billing session could not be opened.");
      window.location.assign(url.href);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Billing is unavailable. Please try again later.",
      );
      setOpening(false);
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok)
          throw new Error(data.error || "Billing is unavailable.");
        setReady(Boolean(data.billingEnabled));
        setSignedIn(Boolean(data.signedIn));
        setTrial(data.trial || null);
        setMessage(
          data.billingEnabled
            ? data.billingMode === "live" ? "Choose a plan or manage your subscription."
              : "Sandbox checkout uses test payments. No real charges."
            : "Payments are not available yet. Your free search remains available.",
        );
      })
      .catch(() => {
        if (active)
          setMessage("Billing is unavailable. Please try again later.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main style={{ maxWidth: 720, margin: "80px auto", padding: 24 }}>
      <Link href="/">← Back to ThreadFinder</Link>
      <h1 style={{ margin: "32px 0 16px" }}>Plans and billing</h1>
      <p role="status">{message}</p>
      {ready && (
        <section aria-label="Plan summary" style={{ marginTop: 24 }}>
          <p>{TRIAL_DAYS}-day free trial · {TRIAL_SEARCHES} full research search · no card required.</p>
          <p>{PAID_PLANS.map(plan => `${plan.name}: $${plan.monthlyUsd}/month for ${plan.searches} searches`).join(". ")}.</p>
          <p>No automatic overage charges. Search allowances renew monthly.</p>
        </section>
      )}
      {ready && !signedIn && (
        <Link className="light-button" href="/api/auth/login?next=/billing">
          Sign in or create an account
        </Link>
      )}
      {ready && signedIn && trial?.available && (
        <p>Your trial ends {new Date(trial.expiresAt).toLocaleDateString()}. <Link href="/">Start your free search</Link></p>
      )}
      {ready && signedIn && (
        <div
          style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}
        >
          <button
            className="light-button"
            disabled={opening}
            onClick={() => openHosted("pricing")}
          >
            Choose a plan
          </button>
          <button
            className="light-button"
            disabled={opening}
            onClick={() => openHosted("portal")}
          >
            Manage subscription
          </button>
        </div>
      )}
      {ready && signedIn && (
        <form action="/api/auth/logout" method="post" style={{ marginTop: 24 }}>
          <button className="light-button" type="submit">Sign out</button>
        </form>
      )}
    </main>
  );
}
