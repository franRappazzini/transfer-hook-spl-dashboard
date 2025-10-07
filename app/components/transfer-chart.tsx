"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useEffect, useState } from "react"

interface TransferChartProps {
  transferCount: number
}

export function TransferChart({ transferCount }: TransferChartProps) {
  const [chartData, setChartData] = useState<Array<{ time: string; transfers: number }>>([])

  useEffect(() => {
    // Add new data point when counter changes
    const now = new Date()
    const timeLabel = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })

    setChartData((prev) => {
      const newData = [...prev, { time: timeLabel, transfers: transferCount }]
      // Keep only the last 10 points
      return newData.slice(-10)
    })
  }, [transferCount])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Activity</CardTitle>
        <CardDescription>Real-time transfer history</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis dataKey="time" stroke="rgba(255, 255, 255, 0.5)" fontSize={12} />
            <YAxis stroke="rgba(255, 255, 255, 0.5)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "8px",
                color: "#fff",
              }}
              labelStyle={{ color: "#fff" }}
            />
            <Bar dataKey="transfers" fill="#06b6d4" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
