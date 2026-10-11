"use client";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: "48px auto",
          padding: "0 24px",
          maxWidth: 640,
          fontFamily: "system-ui, sans-serif",
          color: "#0b1640",
        }}
      >
        <h1>This page couldn’t load.</h1>
        <p>Please try loading it again.</p>
        <button onClick={retry}>Try again</button>
      </body>
    </html>
  );
}
