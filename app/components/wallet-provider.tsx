"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

import type React from "react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";

export function SolanaWalletProvider({
  children,
  endpoint,
}: {
  children: React.ReactNode;
  endpoint: string;
}) {
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
