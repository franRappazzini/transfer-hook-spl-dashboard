"use client";

import { Activity, AlertCircle, Coins, Loader2, Network, Plus, Send, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getTokenMetadata,
} from "@solana/spl-token";
import { useEffect, useState } from "react";

import { ActivityFeed } from "@/components/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import type React from "react";
import { TokenMetrics } from "@/components/token-metrics";
import { TransferChart } from "@/components/transfer-chart";
import { TransferModal } from "@/components/transfer-modal";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";

interface TokenData {
  totalSupply: number;
  transferCount: number;
  totalValueTransferred: number;
  decimals: number;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
}

type NetworkType = "localhost" | "devnet" | "mainnet" | "custom";

const NETWORK_ENDPOINTS: Record<NetworkType, string> = {
  localhost: "http://localhost:8899",
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
  custom: "",
};

const TRANSFER_HOOK_PROGRAM_ID = new PublicKey("4GqQV3oa7yhsEL5M1G8vJj55rEDM1SKXs8s3fyuhqJDj");
const TOKEN_STATE_SEED = "token-state";
const TOKEN_STATE_DISCRIMINATOR = [218, 112, 6, 149, 55, 186, 168, 163];

interface TokenActivity {
  id: string;
  type: "mint" | "transfer";
  timestamp: Date;
  amount?: number;
  signature: string;
}

export function TokenDashboard() {
  const [tokenAddress, setTokenAddress] = useState("DSX2KwMHZ8BhHPYJqusypnvUn1RKqZNAUaTKgdTdqunW");
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [network, setNetwork] = useState<NetworkType>("devnet");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [showCorsWarning, setShowCorsWarning] = useState(false);
  const [tokenProgramId, setTokenProgramId] = useState<PublicKey | null>(null);
  const [activities, setActivities] = useState<TokenActivity[]>([]);
  const { publicKey, sendTransaction } = useWallet();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const endpoint = network === "custom" ? customEndpoint : NETWORK_ENDPOINTS[network];
    if (!endpoint) return;

    const conn = new Connection(endpoint, "confirmed");
    setConnection(conn);

    if (isMonitoring) {
      setIsMonitoring(false);
      toast({
        title: "Network Changed",
        description: `Connected to ${network}. Reconnect the token to continue monitoring.`,
      });
    }
  }, [network, customEndpoint]);

  const fetchTokenStateFromPDA = async (mintPubkey: PublicKey) => {
    if (!connection) return null;

    try {
      console.log("[v0] Searching for PDA token-state...");

      const [tokenStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(TOKEN_STATE_SEED)],
        TRANSFER_HOOK_PROGRAM_ID
      );

      console.log("[v0] PDA token-state:", tokenStatePDA.toString());
      console.log("[v0] Program ID used:", TRANSFER_HOOK_PROGRAM_ID.toString());
      console.log("[v0] Seed used:", TOKEN_STATE_SEED);

      const accountInfo = await connection.getAccountInfo(tokenStatePDA);
      console.log({ accountInfo });

      if (!accountInfo) {
        console.log("[v0] PDA token-state not found, using default values");
        return { totalTransfers: 0, totalAmountTransferred: 0 };
      }

      console.log("[v0] PDA found, owner:", accountInfo.owner.toString());
      console.log("[v0] Data length:", accountInfo.data.length);

      const data = accountInfo.data;

      if (data.length < 25) {
        console.log("[v0] Incomplete PDA data, expected at least 25 bytes, received:", data.length);
        return { totalTransfers: 0, totalAmountTransferred: 0 };
      }

      const discriminator = Array.from(data.slice(0, 8));
      const discriminatorMatches = discriminator.every(
        (byte, i) => byte === TOKEN_STATE_DISCRIMINATOR[i]
      );

      if (!discriminatorMatches) {
        console.log(
          "[v0] Discriminator mismatch. Expected:",
          TOKEN_STATE_DISCRIMINATOR,
          "Got:",
          discriminator
        );
        return { totalTransfers: 0, totalAmountTransferred: 0 };
      }

      const totalTransfers = Number(data.readBigUInt64LE(8));
      const totalAmountTransferred = Number(data.readBigUInt64LE(16));
      const bump = data[24];

      console.log("[v0] PDA data parsed:", {
        totalTransfers,
        totalAmountTransferred,
        bump,
      });

      return { totalTransfers, totalAmountTransferred };
    } catch (error) {
      console.error("[v0] Error reading PDA token-state:", error);
      return { totalTransfers: 0, totalAmountTransferred: 0 };
    }
  };

  const fetchTransactionHistory = async (mintPubkey: PublicKey) => {
    if (!connection) return;

    try {
      console.log("[v0] Fetching transaction history...");

      const signatures = await connection.getSignaturesForAddress(mintPubkey, { limit: 20 });

      console.log("[v0] Found", signatures.length, "transactions");

      const newActivities: TokenActivity[] = [];

      for (const sigInfo of signatures) {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) continue;

        const logMessages = tx.meta.logMessages?.join(" ") || "";

        if (logMessages.includes("MintTo")) {
          newActivities.push({
            id: sigInfo.signature,
            type: "mint",
            timestamp: new Date((sigInfo.blockTime || 0) * 1000),
            signature: sigInfo.signature,
          });
        } else if (logMessages.includes("Instruction: TransferHook")) {
          newActivities.push({
            id: sigInfo.signature,
            type: "transfer",
            timestamp: new Date((sigInfo.blockTime || 0) * 1000),
            signature: sigInfo.signature,
          });
        }
      }

      console.log("[v0] Activities processed:", newActivities.length);
      setActivities(newActivities);
    } catch (error) {
      console.error("[v0] Error fetching history:", error);
    }
  };

  const fetchTokenMetadata = async (mintPubkey: PublicKey, programId: PublicKey) => {
    if (!connection) return null;

    try {
      console.log("[v0] Fetching token metadata...");

      if (programId.toString() !== TOKEN_2022_PROGRAM_ID.toString()) {
        console.log("[v0] Token is not Token-2022, skipping metadata");
        return null;
      }

      const metadata = await getTokenMetadata(connection, mintPubkey);

      if (metadata) {
        console.log("[v0] Metadata found:", metadata);
        setTokenMetadata({
          name: metadata.name || "Unknown",
          symbol: metadata.symbol || "???",
          uri: metadata.uri || "",
        });
        return metadata;
      } else {
        console.log("[v0] No metadata found for this token");
        return null;
      }
    } catch (error) {
      console.error("[v0] Error fetching metadata:", error);
      return null;
    }
  };

  const fetchTokenData = async (address: string) => {
    if (!connection) return false;

    try {
      setIsLoading(true);
      setShowCorsWarning(false);
      let mintPubkey: PublicKey;
      try {
        mintPubkey = new PublicKey(address);
      } catch (error) {
        toast({
          title: "Invalid Address",
          description: "The token address is not valid. Verify and try again.",
          variant: "destructive",
        });
        return false;
      }

      console.log("[v0] Attempting to connect to token:", address);
      console.log("[v0] Selected network:", network);
      console.log(
        "[v0] Endpoint:",
        network === "custom" ? customEndpoint : NETWORK_ENDPOINTS[network]
      );

      console.log("[v0] Verifying if account exists...");
      const accountInfo = await connection.getAccountInfo(mintPubkey);

      if (!accountInfo) {
        console.log("[v0] Account does not exist on this network");
        throw new Error("ACCOUNT_NOT_FOUND");
      }

      console.log("[v0] Account found. Owner:", accountInfo.owner.toString());
      console.log("[v0] Data length:", accountInfo.data.length);

      const owner = accountInfo.owner.toString();
      const isTokenProgram = owner === TOKEN_PROGRAM_ID.toString();
      const isToken2022Program = owner === TOKEN_2022_PROGRAM_ID.toString();

      console.log("[v0] Is TOKEN_PROGRAM_ID:", isTokenProgram);
      console.log("[v0] Is TOKEN_2022_PROGRAM_ID:", isToken2022Program);

      if (!isTokenProgram && !isToken2022Program) {
        console.log("[v0] Account does not belong to any token program");
        throw new Error("NOT_A_TOKEN");
      }

      let mintInfo;
      let usedProgramId: PublicKey;

      if (isTokenProgram) {
        console.log("[v0] Parsing with TOKEN_PROGRAM_ID...");
        mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_PROGRAM_ID);
        usedProgramId = TOKEN_PROGRAM_ID;
      } else {
        console.log("[v0] Parsing with TOKEN_2022_PROGRAM_ID...");
        mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
        usedProgramId = TOKEN_2022_PROGRAM_ID;
      }

      const supply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);

      const pdaData = await fetchTokenStateFromPDA(mintPubkey);

      console.log("[v0] Token loaded successfully:", {
        supply,
        decimals: mintInfo.decimals,
        programId: usedProgramId.toString(),
        transferCount: pdaData?.totalTransfers || 0,
        totalValueTransferred: pdaData?.totalAmountTransferred || 0,
      });

      setTokenProgramId(usedProgramId);
      setTokenData({
        totalSupply: supply,
        transferCount: pdaData?.totalTransfers || 0,
        totalValueTransferred:
          (pdaData?.totalAmountTransferred || 0) / Math.pow(10, mintInfo.decimals),
        decimals: mintInfo.decimals,
      });

      await fetchTokenMetadata(mintPubkey, usedProgramId);
      await fetchTransactionHistory(mintPubkey);

      console.log("[v0] Starting automatic monitoring...");
      setIsMonitoring(true);

      const subscriptionId = connection.onLogs(
        mintPubkey,
        async (logs, context) => {
          console.log("[v0] Transaction detected:", logs);

          const logMessages = logs.logs.join(" ");
          const signature = logs.signature;

          if (logMessages.includes("MintTo")) {
            const newActivity: TokenActivity = {
              id: signature,
              type: "mint",
              timestamp: new Date(),
              signature,
            };
            setActivities((prev) => [newActivity, ...prev].slice(0, 20));

            toast({
              title: "🪙 Mint Detected",
              description: `New tokens have been minted`,
            });

            await fetchTokenData(address);
          } else if (logMessages.includes("Instruction: TransferHook")) {
            const newActivity: TokenActivity = {
              id: signature,
              type: "transfer",
              timestamp: new Date(),
              signature,
            };
            setActivities((prev) => [newActivity, ...prev].slice(0, 20));

            toast({
              title: "💸 Transfer Detected",
              description: `A token transfer has been made`,
            });

            const pdaData = await fetchTokenStateFromPDA(mintPubkey);

            setTokenData((prev) =>
              prev
                ? {
                    ...prev,
                    transferCount: pdaData?.totalTransfers || prev.transferCount,
                    totalValueTransferred:
                      (pdaData?.totalAmountTransferred || 0) / Math.pow(10, prev.decimals),
                  }
                : null
            );
          }
        },
        "confirmed"
      );

      toast({
        title: "Token Connected & Monitoring Active",
        description: `Listening for events on ${address.slice(0, 4)}...${address.slice(-4)}`,
      });

      return true;
    } catch (error) {
      console.error("[v0] Error fetching token:", error);

      let errorMessage = "Failed to load token. ";
      let isCorsError = false;

      if (error instanceof Error) {
        if (error.message === "ACCOUNT_NOT_FOUND") {
          errorMessage = `The token does not exist on ${network}. `;
          if (network === "localhost") {
            isCorsError = true;
            setShowCorsWarning(true);
            errorMessage +=
              "Make sure your local validator is running and the token was created on localhost.";
          } else {
            errorMessage += "Verify the token address or try another network.";
          }
        } else if (error.message === "NOT_A_TOKEN") {
          errorMessage =
            "This address is not a valid SPL token. Verify it is the mint address (not an associated token account).";
        } else if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError")
        ) {
          const isLocalhost =
            network === "localhost" ||
            (network === "custom" &&
              (customEndpoint.includes("localhost") || customEndpoint.includes("127.0.0.1")));

          if (isLocalhost) {
            isCorsError = true;
            setShowCorsWarning(true);
            errorMessage = "CORS error connecting to localhost. See instructions below to resolve.";
          } else {
            errorMessage =
              "Connection error. Verify your internet and that the RPC endpoint is available.";
          }
        } else {
          errorMessage += error.message;
        }
      }

      toast({
        title: "Error Loading Token",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tokenAddress) return;

    if (network === "custom" && !customEndpoint) {
      toast({
        title: "Custom Endpoint Required",
        description: "Enter a custom RPC endpoint",
        variant: "destructive",
      });
      return;
    }

    console.log("first");
    await fetchTokenData(tokenAddress);
  };

  const fetchUserBalance = async () => {
    if (!publicKey || !connection || !tokenAddress || !tokenProgramId || !tokenData) {
      setUserBalance(null);
      return;
    }

    try {
      console.log("[v0] Fetching user balance...");
      const mintPubkey = new PublicKey(tokenAddress);
      const userTokenAccount = getAssociatedTokenAddressSync(
        mintPubkey,
        publicKey,
        false,
        tokenProgramId
        // connection,
        // publicKey,
        // mintPubkey,
        // publicKey,
        // false,
        // undefined,
        // undefined,
        // tokenProgramId
      );

      try {
        const accountInfo = await getAccount(
          connection,
          userTokenAccount,
          "confirmed",
          tokenProgramId
        );
        const balance = Number(accountInfo.amount) / Math.pow(10, tokenData.decimals);
        console.log("[v0] User balance:", balance);
        setUserBalance(balance);
      } catch (error) {
        console.log("[v0] User has no token account, balance is 0");
        setUserBalance(0);
      }
    } catch (error) {
      console.error("[v0] Error fetching user balance:", error);
      setUserBalance(null);
    }
  };

  useEffect(() => {
    if (publicKey && tokenAddress && tokenProgramId && tokenData) {
      fetchUserBalance();
    } else {
      setUserBalance(null);
    }
  }, [publicKey, tokenAddress, tokenProgramId, tokenData]);

  const handleMint = async () => {
    if (!publicKey || !connection || !tokenAddress || !tokenProgramId || !tokenData) {
      toast({
        title: "Error",
        description: "Connect your wallet and a token first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsMinting(true);

      const response = await fetch("/api/mint-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tokenAddress,
          recipientAddress: publicKey.toString(),
          network,
          tokenProgramId: tokenProgramId.toString(),
          decimals: tokenData.decimals,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to mint tokens");
      }

      toast({
        title: "Mint Successful",
        description: `Minted 10 tokens. Signature: ${data.signature.slice(0, 8)}...`,
      });

      await fetchTokenData(tokenAddress);
      await fetchUserBalance();
    } catch (error) {
      console.error("[v0] Mint error:", error);
      toast({
        title: "Mint Failed",
        description: error instanceof Error ? error.message : "Failed to mint tokens",
        variant: "destructive",
      });
    } finally {
      setIsMinting(false);
    }
  };

  const handleTransfer = async (recipient: string, amount: number) => {
    if (!publicKey || !connection || !tokenAddress || !tokenProgramId || !tokenData) {
      toast({
        title: "Error",
        description: "Connect your wallet and a token first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTransferring(true);
      console.log("[v0] Starting transfer...");

      const mintPubkey = new PublicKey(tokenAddress);
      const recipientPubkey = new PublicKey(recipient);

      console.log("[v0] Getting or creating source token account...");
      const sourceTokenAccount = getAssociatedTokenAddressSync(
        mintPubkey,
        publicKey,
        false,
        tokenProgramId
      );

      console.log("[v0] Getting or creating destination token account...");
      console.log("recipientPubkey:", recipientPubkey.toString());
      const destinationTokenAccount = getAssociatedTokenAddressSync(
        mintPubkey,
        recipientPubkey,
        false,
        tokenProgramId
      );

      // get account info
      const ataInfo = await connection.getAccountInfo(destinationTokenAccount);
      console.log({ ataInfo });

      console.log("[v0] Source account:", sourceTokenAccount.toString());
      console.log("[v0] Destination account:", destinationTokenAccount.toString());

      const transferAmount = BigInt(Math.floor(amount * Math.pow(10, tokenData.decimals)));
      console.log("[v0] Transfer amount (raw):", transferAmount.toString());

      const transaction = new Transaction();

      if (!ataInfo) {
        console.log("add createATAix");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            destinationTokenAccount,
            recipientPubkey,
            mintPubkey,
            tokenProgramId
          )
        );
      }

      transaction.add(
        await createTransferCheckedWithTransferHookInstruction(
          connection,
          sourceTokenAccount,
          mintPubkey,
          destinationTokenAccount,
          publicKey,
          transferAmount,
          tokenData.decimals,
          [],
          undefined,
          TOKEN_2022_PROGRAM_ID
        )
      );

      console.log("[v0] Sending transaction...");
      const signature = await sendTransaction(transaction, connection);

      console.log("[v0] Transaction sent:", signature);

      toast({
        title: "Transfer Successful",
        description: `Transferred ${amount} tokens. Signature: ${signature.slice(0, 8)}...`,
      });

      await fetchTokenData(tokenAddress);
      await fetchUserBalance();
      setIsTransferModalOpen(false);
    } catch (error) {
      console.error("[v0] Transfer error:", error);

      let errorMessage = "Failed to transfer tokens";
      if (error instanceof Error) {
        if (error.message.includes("insufficient")) {
          errorMessage = "Insufficient balance for this transfer";
        } else if (error.message.includes("User rejected")) {
          errorMessage = "Transaction was rejected";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Transfer Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  useEffect(() => {
    handleSubmit();
  }, [connection]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-balance">
              Solana Token Dashboard
            </h1>
            <Image src="/solana.png" alt="Solana Token Dashboard" width={32} height={32} />
          </div>
          <p className="text-muted-foreground mt-2">
            Monitor Messi 10 SPL token with transfer hooks in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WalletMultiButton />
          <Badge variant="secondary" className="gap-2 px-4 py-2">
            <Network className="h-4 w-4" />
            {network === "custom" ? "Custom" : network.charAt(0).toUpperCase() + network.slice(1)}
          </Badge>
          {isMonitoring && (
            <Badge variant="outline" className="gap-2 px-4 py-2">
              <Activity className="h-4 w-4 animate-pulse text-accent" />
              Monitoring
            </Badge>
          )}
        </div>
      </div>

      {showCorsWarning && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Required for Localhost</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="font-medium">
              Web applications cannot connect directly to localhost due to browser security
              policies.
            </p>
            <div className="space-y-2">
              <p className="font-semibold">Solution 1: Start validator with CORS enabled</p>
              <code className="block bg-background/50 p-3 rounded text-sm font-mono">
                solana-test-validator --rpc-cors-allow-origin "*"
              </code>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Solution 2: Use devnet for testing</p>
              <p className="text-sm">
                Switch the network to "Devnet" above and create your token on devnet to avoid CORS
                issues.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Solution 3: Deploy the app locally</p>
              <p className="text-sm">
                Download the code and run it on your local machine with `npm run dev` to connect to
                localhost without issues.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Token Configuration</CardTitle>
          {/* <CardDescription>Enter the SPL token address you want to monitor</CardDescription> */}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Solana Network</label>
                <Select
                  value={network}
                  onValueChange={(value) => setNetwork(value as NetworkType)}
                  disabled={true}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="localhost">Localhost (http://localhost:8899)</SelectItem>
                    <SelectItem value="devnet">Devnet</SelectItem>
                    <SelectItem value="mainnet">Mainnet Beta</SelectItem>
                    <SelectItem value="custom">Custom Endpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {network === "custom" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Custom RPC Endpoint</label>
                <Input
                  placeholder="https://your-rpc-endpoint.com or http://localhost:8899"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  className="font-mono"
                  disabled={isMonitoring}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  For localhost, make sure to start the validator with: solana-test-validator
                  --rpc-cors-allow-origin "*"
                </p>
              </div>
            )}

            {/* <form onSubmit={handleSubmit} className="flex gap-4"> */}
            <div className="flex gap-4">
              <Input
                // placeholder="Token address (e.g., 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU)"
                placeholder="Token address: DSX2KwMHZ8BhHPYJqusypnvUn1RKqZNAUaTKgdTdqunW"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                className="font-mono"
                // disabled={isMonitoring}
                disabled
              />
              <Button
                // type="submit"
                // disabled={isLoading || isMonitoring || !tokenAddress}
                disabled
                className="min-w-[120px]"
              >
                {/* {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading
                  </>
                ) : isMonitoring ? (
                  "Active"
                ) : (
                  "Connect"
                )} */}
                {isMonitoring ? (
                  "Active"
                ) : (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {tokenData && (
        <>
          {tokenMetadata && (
            <Card>
              <CardHeader>
                <CardTitle>Token Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6">
                  {tokenMetadata.uri && (
                    <div className="flex-shrink-0">
                      <img
                        src={tokenMetadata.uri || "/placeholder.svg"}
                        alt={tokenMetadata.name}
                        className="w-24 h-24 rounded-lg object-cover border-2 border-border"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="text-lg font-semibold">{tokenMetadata.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Symbol</p>
                      <p className="text-lg font-semibold">{tokenMetadata.symbol}</p>
                    </div>
                    {tokenMetadata.uri && (
                      <div>
                        <p className="text-sm text-muted-foreground">URI</p>
                        <a
                          href={tokenMetadata.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent hover:underline font-mono break-all"
                        >
                          {tokenMetadata.uri}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {publicKey && userBalance !== null && (
            <Card className="border-accent/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-accent/10">
                      <Wallet className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Your Balance</p>
                      <p className="text-2xl font-bold">
                        {userBalance.toLocaleString()} {tokenMetadata?.symbol || "tokens"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {publicKey && (
            <div className="flex gap-3">
              <Button onClick={handleMint} disabled={isMinting || !isMonitoring} className="gap-2">
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Minting
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Mint 10 Tokens
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsTransferModalOpen(true)}
                disabled={isTransferring || !isMonitoring}
                variant="outline"
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Transfer Tokens
              </Button>
            </div>
          )}

          <TokenMetrics tokenData={tokenData} />

          <div className="grid gap-6 md:grid-cols-2">
            <TransferChart transferCount={tokenData.transferCount} />
            <ActivityFeed activities={activities} network={network} />
          </div>
        </>
      )}

      {!tokenData && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Coins className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Connect a token to get started</h3>
            <p className="text-muted-foreground max-w-md">
              Enter your SPL token address above to view real-time metrics and receive alerts for
              transfers and mints.
            </p>
          </CardContent>
        </Card>
      )}

      <TransferModal
        open={isTransferModalOpen}
        onOpenChange={setIsTransferModalOpen}
        onTransfer={handleTransfer}
        isLoading={isTransferring}
      />
    </div>
  );
}
