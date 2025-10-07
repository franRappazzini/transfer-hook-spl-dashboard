"use client";

import { ArrowRightLeft, Coins, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Activity {
  id: string;
  type: "mint" | "transfer";
  timestamp: Date;
  amount?: number;
  signature?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  network: "localhost" | "devnet" | "mainnet" | "custom";
}

export function ActivityFeed({ activities, network }: ActivityFeedProps) {
  console.log({ activities });

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    return date.toLocaleDateString("en-US");
  };

  const getExplorerUrl = (signature: string) => {
    let cluster = "";
    if (network === "localhost" || network === "custom") {
      cluster = "custom";
    } else if (network === "devnet") {
      cluster = "devnet";
    } else if (network === "mainnet") {
      cluster = "mainnet-beta";
    }
    return `https://explorer.solana.com/tx/${signature}${cluster ? `?cluster=${cluster}` : ""}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
        <CardDescription>Recent token events</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No recent activity</p>
                <p className="text-sm mt-2">New transfers and mints will appear here</p>
              </div>
            ) : (
              activities.map((activity) => (
                <a
                  key={activity.id}
                  href={getExplorerUrl(activity.signature || "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer group"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      activity.type === "mint" ? "bg-green-500/10" : "bg-blue-500/10"
                    }`}
                  >
                    {activity.type === "mint" ? (
                      <Coins className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {activity.type === "mint" ? "Mint" : "Transfer"}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {formatTime(activity.timestamp)}
                      </Badge>
                    </div>
                    {activity.signature && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground font-mono">
                          {activity.signature.slice(0, 8)}...{activity.signature.slice(-8)}
                        </p>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
