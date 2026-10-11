import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private access — Scrapper",
  robots: { index: false, follow: false },
};

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
