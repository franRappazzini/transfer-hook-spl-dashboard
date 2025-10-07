"use client";

import { useEffect, useState } from "react";

import dynamic from "next/dynamic";

const SolanaWalletProvider = dynamic(
  () => import("@/components/wallet-provider").then((mod) => mod.SolanaWalletProvider),
  { ssr: false }
);

const TokenDashboard = dynamic(
  () => import("@/components/token-dashboard").then((mod) => mod.TokenDashboard),
  {
    ssr: false,
  }
);

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    );
  }

  return (
    <SolanaWalletProvider endpoint="https://api.devnet.solana.com">
      <main className="min-h-screen bg-background">
        <TokenDashboard />
      </main>
    </SolanaWalletProvider>
  );
}
