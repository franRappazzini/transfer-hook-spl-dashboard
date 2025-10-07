import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Solana Token Dashboard",
  description: "Monitor Messi 10 SPL token with transfer hooks in real-time",
  keywords: [
    "Solana",
    "SPL",
    "token",
    "dashboard",
    "real-time",
    "transfer hooks",
    "Messi 10",
    "crypto",
    "blockchain",
    "web3",
    "DeFi",
    "NFT",
    "wallet",
    "analytics",
    "portfolio",
    "transactions",
    "Solana ecosystem",
    "crypto assets",
    "token management",
    "react",
    "next.js",
    "typescript",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>
          {children}
          <Toaster />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
