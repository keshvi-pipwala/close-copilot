import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Close Copilot — agent-assisted transaction categorization",
  description:
    "An AI agent that categorizes transactions, scores its own confidence, and routes low-confidence rows to a human review queue. Built by Keshvi Pipwala.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
