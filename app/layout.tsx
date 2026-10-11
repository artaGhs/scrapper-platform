import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
const font = Host_Grotesk({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});
export const metadata: Metadata = {
  metadataBase: new URL("https://trythreadfinder.com"),
  applicationName: "ThreadFinder",
  title: "ThreadFinder — find a conversation worth joining",
  description:
    "Find Reddit conversations about the problem your business solves. Review original posts and comments, save relevant matches, and decide where to join in.",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ThreadFinder",
    title: "ThreadFinder — find a conversation worth joining",
    description:
      "Find Reddit conversations about the problem your business solves.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ThreadFinder — find a conversation worth joining",
    description:
      "Find Reddit conversations about the problem your business solves.",
  },
};
export const viewport: Viewport = { themeColor: "#030a24" };
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
