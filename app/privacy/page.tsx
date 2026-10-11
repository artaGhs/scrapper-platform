import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Privacy & data — ThreadFinder",
  description:
    "How ThreadFinder uses your business description, stores research, and remembers this browser.",
};

export default function Privacy() {
  return (
    <main className="information-page">
      <Link className="wordmark" href="/">
        <BrandMark size={24} />
        ThreadFinder.
      </Link>
      <h1>Privacy &amp; data</h1>
      <p>Here is how the current service handles your research.</p>
      <h2>Your business description</h2>
      <p>
        We use your description to create Reddit search phrases and check
        whether conversations fit your business. Search phrases are sent to
        Apify, our Reddit retrieval provider. When AI review is enabled, your
        description and candidate discussion text are sent to Google Gemini to
        assess relevance. Avoid entering passwords, customer records, or
        confidential information.
      </p>
      <h2>Your results and feedback</h2>
      <p>
        Your description, results, and Save / Not relevant feedback are stored
        on our server. Results are accessible through your browser session for
        24 hours after a search is created. Expired research is removed when a
        new search is created; this is not an immediate deletion guarantee.
      </p>
      <h2>Remembering this browser</h2>
      <p>
        An essential cookie identifies your browser session and is renewed for
        30 days when you return. Browser storage remembers the ID of your latest
        search. We keep a separate record of whether that session has used its
        free search, even after the results expire. Clearing browser data loses
        access to your saved research and does not delete server records.
      </p>
      <h2>Website analytics</h2>
      <p>
        We use Vercel Web Analytics to measure visits and page views, including
        referrers, approximate location, and device and browser types. These
        statistics are aggregated and do not use analytics cookies. We do not
        send your business description, research results, or feedback as
        analytics events. Read{" "}
        <a href="https://vercel.com/docs/analytics/privacy-policy">
          how Vercel handles analytics data
        </a>.
      </p>
      <h2>Service providers and abuse prevention</h2>
      <p>
        Vercel hosts the website and Neon stores hosted research. We use a
        hashed connection identifier to limit excessive requests. Hosting and
        research providers may process request information under their own
        policies: <a href="https://vercel.com/legal/privacy-notice">Vercel</a>,{" "}
        <a href="https://www.databricks.com/legal/privacynotice">Neon</a>,{" "}
        <a href="https://docs.apify.com/legal/privacy-policy">Apify</a>, and{" "}
        <a href="https://policies.google.com/privacy">Google</a>.
      </p>
      <h2>Public conversations</h2>
      <p>
        Results come from public Reddit discussions. Open the original thread to
        check its current context. ThreadFinder does not post replies or contact
        anyone for you. If you participate, disclose your affiliation and follow
        the community’s rules.
      </p>
      <Link className="ghost-button" href="/">
        Back to research
      </Link>
    </main>
  );
}
