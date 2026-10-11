import Link from "next/link";

export default function NotFound() {
  return (
    <main className="information-page">
      <Link className="wordmark" href="/">
        scrapper.
      </Link>
      <h1>Page not found.</h1>
      <p>This page may have moved, or the address may be incorrect.</p>
      <Link className="ghost-button" href="/">
        Back to research
      </Link>
    </main>
  );
}
