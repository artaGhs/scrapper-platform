"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="information-page">
      <Link className="wordmark" href="/">
        scrapper.
      </Link>
      <h1>This page couldn’t load.</h1>
      <p>
        Please try loading it again. Your existing research stays with this
        browser.
      </p>
      <button className="run-button" onClick={retry}>
        Try again
      </button>
      <p>
        <Link href="/">Back to research</Link>
      </p>
    </main>
  );
}
