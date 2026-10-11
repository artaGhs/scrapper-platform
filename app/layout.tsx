import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Scrapper — find a conversation worth joining",
  description:
    "Describe your business and find public requests that overlap with what you offer. A bounded research prototype with clearly labeled sample examples.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
