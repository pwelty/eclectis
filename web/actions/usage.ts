"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getUser } from "@/lib/supabase/server"

export interface UsageSummary {
  today: { input_tokens: number; output_tokens: number; cost_usd: number; calls: number }
  month: { input_tokens: number; output_tokens: number; cost_usd: number; calls: number }
  dailyBreakdown: Array<{
    date: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    calls: number
  }>
  bySource: Array<{
    source: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    calls: number
  }>
}

export async function getUsageSummary(): Promise<UsageSummary | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = createAdminClient()

  // Get today's usage
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayData } = await supabase
    .from("ai_usage_logs")
    .select("input_tokens, output_tokens, cost_usd")
    .eq("user_id", user.id)
    .gte("created_at", todayStart.toISOString())

  const today = {
    input_tokens: todayData?.reduce((sum, r) => sum + r.input_tokens, 0) ?? 0,
    output_tokens: todayData?.reduce((sum, r) => sum + r.output_tokens, 0) ?? 0,
    cost_usd: todayData?.reduce((sum, r) => sum + Number(r.cost_usd), 0) ?? 0,
    calls: todayData?.length ?? 0,
  }

  // Get this month's usage
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { data: monthData } = await supabase
    .from("ai_usage_logs")
    .select("input_tokens, output_tokens, cost_usd, created_at, source")
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString())
    .order("created_at", { ascending: true })

  const month = {
    input_tokens: monthData?.reduce((sum, r) => sum + r.input_tokens, 0) ?? 0,
    output_tokens: monthData?.reduce((sum, r) => sum + r.output_tokens, 0) ?? 0,
    cost_usd: monthData?.reduce((sum, r) => sum + Number(r.cost_usd), 0) ?? 0,
    calls: monthData?.length ?? 0,
  }

  // Daily breakdown for the month
  const dailyMap = new Map<string, { input_tokens: number; output_tokens: number; cost_usd: number; calls: number }>()
  for (const row of monthData ?? []) {
    const date = new Date(row.created_at).toISOString().split("T")[0]
    const existing = dailyMap.get(date) ?? { input_tokens: 0, output_tokens: 0, cost_usd: 0, calls: 0 }
    existing.input_tokens += row.input_tokens
    existing.output_tokens += row.output_tokens
    existing.cost_usd += Number(row.cost_usd)
    existing.calls += 1
    dailyMap.set(date, existing)
  }
  const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }))

  // Breakdown by source
  const sourceMap = new Map<string, { input_tokens: number; output_tokens: number; cost_usd: number; calls: number }>()
  for (const row of monthData ?? []) {
    const existing = sourceMap.get(row.source) ?? { input_tokens: 0, output_tokens: 0, cost_usd: 0, calls: 0 }
    existing.input_tokens += row.input_tokens
    existing.output_tokens += row.output_tokens
    existing.cost_usd += Number(row.cost_usd)
    existing.calls += 1
    sourceMap.set(row.source, existing)
  }
  const bySource = Array.from(sourceMap.entries())
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.cost_usd - a.cost_usd)

  return { today, month, dailyBreakdown, bySource }
}
