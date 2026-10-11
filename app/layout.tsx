import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";
const font = Host_Grotesk({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});
export const metadata: Metadata = {
  title: "Scrapper — find a conversation worth joining",
  description:
    "Describe your business and find public requests that overlap with what you offer. A bounded research prototype with clearly labeled sample examples.",
};
export const viewport: Viewport = { themeColor: "#030a24" };
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
