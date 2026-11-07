import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeTutor — Your friendly code sidekick",
  description: "Turn code questions into visual lessons, walkthroughs, and practice.",
};

export default function RootLayout({children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
