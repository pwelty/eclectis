"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getAdminUsage } from "@/actions/admin"
import { Loader2, Crown } from "lucide-react"

interface UserUsage {
  userId: string
  name: string
  plan: string
  cost: number
  calls: number
  inputTokens: number
  outputTokens: number
}

interface UsageData {
  totalCost: number
  totalCalls: number
  byUser: UserUsage[]
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return tokens.toString()
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getAdminUsage()
      if (!("error" in result)) {
        setData(result as UsageData)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Failed to load usage data.</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">AI usage</h1>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-semibold tabular-nums">{formatCost(data.totalCost)}</p>
          <p className="text-xs text-muted-foreground">Total cost</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-semibold tabular-nums">{data.totalCalls.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total calls</p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-medium">Cost by user</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Calls</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Input</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Output</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.byUser.map((user) => (
              <tr key={user.userId} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${user.userId}`} className="font-medium hover:underline">
                    {user.name || "Unknown"}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    user.plan === "pro" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {user.plan === "pro" && <Crown className="size-3" />}
                    {user.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{user.calls.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatTokens(user.inputTokens)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatTokens(user.outputTokens)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCost(user.cost)}</td>
              </tr>
            ))}
            {data.byUser.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No usage data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
