import type { Metadata } from "next";
import "./globals.css";

const SITE = process.env.APP_URL ?? "https://ghost-architect.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Ghost-Architect", template: "%s · Ghost-Architect" },
  description: "Bus-factor radar for codebases that lost their authors. Scores orphaned files, plans handovers for engineers on notice, and explains why old code exists from commit and pull-request evidence.",
  openGraph: {
    title: "Ghost-Architect",
    description: "Find the code nobody understands anymore, before it breaks.",
    url: SITE,
    siteName: "Ghost-Architect",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Ghost-Architect", description: "Find the code nobody understands anymore, before it breaks." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
