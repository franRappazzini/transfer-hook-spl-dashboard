"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Coins, Repeat, TrendingUp } from "lucide-react"

interface TokenData {
  totalSupply: number
  transferCount: number
  totalValueTransferred: number
  decimals: number
}

interface TokenMetricsProps {
  tokenData: TokenData
}

export function TokenMetrics({ tokenData }: TokenMetricsProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(num)
  }

  const metrics = [
    {
      title: "Total Supply",
      value: formatNumber(tokenData.totalSupply),
      icon: Coins,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
    {
      title: "Transfers",
      value: formatNumber(tokenData.transferCount),
      icon: Repeat,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Total Value Transferred",
      value: formatNumber(tokenData.totalValueTransferred),
      icon: TrendingUp,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{metric.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
