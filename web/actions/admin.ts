"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { createServerClient, getRealUser } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Auth helper ───────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createServerClient()
  const user = await getRealUser()
  if (!user) return { error: "Not authenticated" as const, user: null, supabase: null }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) return { error: "Unauthorized" as const, user: null, supabase: null }

  return { error: null, user, supabase }
}

// ── Check admin status ────────────────────────────────────────────────────

export async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const user = await getRealUser()
  if (!user) return false

  const { data } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  return data?.is_admin === true
}

// ── Dashboard overview ────────────────────────────────────────────────────

export async function getAdminDashboard() {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const admin = createAdminClient()

  const [usersRes, commandsRes, usageRes] = await Promise.all([
    admin.from("user_profiles").select("id, plan", { count: "exact" }),
    admin.rpc("admin_command_counts"),
    admin.rpc("admin_usage_totals"),
  ])

  const userCount = usersRes.count ?? 0
  const proCount = usersRes.data?.filter((u: { plan: string }) => u.plan === "pro").length ?? 0

  return {
    users: { total: userCount, pro: proCount, free: userCount - proCount },
    commands: commandsRes.data ?? { pending: 0, processing: 0, completed: 0, failed: 0 },
    usage: usageRes.data ?? { total_cost: 0, total_calls: 0, period: "today" },
  }
}

// ── Users list ────────────────────────────────────────────────────────────

export async function getAdminUsers(offset = 0, limit = 50) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error, users: [], total: 0 }

  const admin = createAdminClient()

  const { data, count, error } = await admin
    .from("user_profiles")
    .select(
      "id, name, plan, is_admin, created_at, updated_at, subscription_status",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { error: error.message, users: [], total: 0 }

  const userIds = (data ?? []).map((u: { id: string }) => u.id)

  const [feedCounts, searchCounts, emailLookup] = await Promise.all([
    admin.from("feeds").select("user_id").in("user_id", userIds),
    admin.from("search_terms").select("user_id").in("user_id", userIds),
    admin.auth.admin.listUsers(),
  ])

  const feedCountMap: Record<string, number> = {}
  for (const f of feedCounts.data ?? []) {
    feedCountMap[f.user_id] = (feedCountMap[f.user_id] ?? 0) + 1
  }

  const searchCountMap: Record<string, number> = {}
  for (const s of searchCounts.data ?? []) {
    searchCountMap[s.user_id] = (searchCountMap[s.user_id] ?? 0) + 1
  }

  const emailMap: Record<string, string> = {}
  for (const u of emailLookup.data?.users ?? []) {
    emailMap[u.id] = u.email ?? ""
  }

  const users = (data ?? []).map(
    (u: {
      id: string
      name: string | null
      plan: string
      is_admin: boolean
      created_at: string
      updated_at: string
      subscription_status: string | null
    }) => ({
      ...u,
      email: emailMap[u.id] ?? "",
      feedCount: feedCountMap[u.id] ?? 0,
      searchTermCount: searchCountMap[u.id] ?? 0,
    }),
  )

  return { users, total: count ?? 0 }
}

// ── User detail ───────────────────────────────────────────────────────────

export async function getAdminUserDetail(userId: string) {
  if (!UUID_RE.test(userId)) return { error: "Invalid user ID" }
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const admin = createAdminClient()

  const [profileRes, feedsRes, searchRes, commandsRes, emailLookup] =
    await Promise.all([
      admin
        .from("user_profiles")
        .select(
          "id, name, plan, is_admin, interests, created_at, updated_at, stripe_customer_id, subscription_status, current_period_end, api_key",
        )
        .eq("id", userId)
        .single(),
      admin
        .from("feeds")
        .select("id, title, url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      admin
        .from("search_terms")
        .select("id, term, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      admin
        .from("commands")
        .select("id, type, status, error, created_at, completed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin.auth.admin.getUserById(userId),
    ])

  if (profileRes.error) return { error: profileRes.error.message }

  const { api_key, ...safeProfile } = profileRes.data
  return {
    profile: { ...safeProfile, apiKeySet: !!api_key },
    email: emailLookup.data?.user?.email ?? "",
    feeds: feedsRes.data ?? [],
    searchTerms: searchRes.data ?? [],
    recentCommands: commandsRes.data ?? [],
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────

export async function getAdminPipeline(offset = 0, limit = 50) {
  const auth = await requireAdmin()
  if (auth.error)
    return {
      error: auth.error,
      commands: [],
      total: 0,
      counts: null,
      lastRun: null,
    }

  const admin = createAdminClient()

  const [commandsRes, countRes, typeStatsRes] = await Promise.all([
    admin
      .from("commands")
      .select(
        "id, user_id, type, status, error, attempt_count, max_attempts, started_at, completed_at, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    admin.rpc("admin_command_counts"),
    admin
      .from("commands")
      .select("type, status, completed_at")
      .order("completed_at", { ascending: false }),
  ])

  if (commandsRes.error)
    return {
      error: commandsRes.error.message,
      commands: [],
      total: 0,
      counts: null,
      typeStats: [],
    }

  const typeMap: Record<
    string,
    {
      type: string
      lastCompleted: string | null
      completed: number
      failed: number
      pending: number
    }
  > = {}
  for (const row of typeStatsRes.data ?? []) {
    if (!typeMap[row.type]) {
      typeMap[row.type] = {
        type: row.type,
        lastCompleted: null,
        completed: 0,
        failed: 0,
        pending: 0,
      }
    }
    const entry = typeMap[row.type]
    if (row.status === "completed") {
      entry.completed++
      if (!entry.lastCompleted && row.completed_at)
        entry.lastCompleted = row.completed_at
    } else if (row.status === "failed") {
      entry.failed++
    } else {
      entry.pending++
    }
  }

  return {
    commands: commandsRes.data ?? [],
    total: commandsRes.count ?? 0,
    counts: countRes.data ?? null,
    typeStats: Object.values(typeMap).sort((a, b) =>
      a.type.localeCompare(b.type),
    ),
  }
}

// ── Trigger pipeline for a user ───────────────────────────────────────────

export async function triggerPipeline(userId: string) {
  if (!UUID_RE.test(userId)) return { error: "Invalid user ID" }
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const admin = createAdminClient()

  const { error } = await admin.from("commands").insert({
    user_id: userId,
    type: "daily.pipeline",
    payload: { triggered_by: "admin" },
  })

  if (error) return { error: error.message }

  revalidatePath("/admin/pipeline")
  return { success: true }
}

// ── Usage stats ───────────────────────────────────────────────────────────

export async function getAdminUsage() {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const admin = createAdminClient()

  const { data: byUser, error: byUserError } = await admin
    .from("ai_usage_logs")
    .select("user_id, cost_usd, input_tokens, output_tokens")
    .order("created_at", { ascending: false })

  if (byUserError) return { error: byUserError.message }

  const userMap: Record<
    string,
    { cost: number; calls: number; inputTokens: number; outputTokens: number }
  > = {}
  for (const row of byUser ?? []) {
    if (!userMap[row.user_id]) {
      userMap[row.user_id] = {
        cost: 0,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
      }
    }
    userMap[row.user_id].cost += Number(row.cost_usd)
    userMap[row.user_id].calls += 1
    userMap[row.user_id].inputTokens += row.input_tokens
    userMap[row.user_id].outputTokens += row.output_tokens
  }

  const totalCost = Object.values(userMap).reduce((sum, u) => sum + u.cost, 0)
  const totalCalls = Object.values(userMap).reduce(
    (sum, u) => sum + u.calls,
    0,
  )

  const userIds = Object.keys(userMap)
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, name, plan")
    .in("id", userIds)

  const profileMap: Record<string, { name: string | null; plan: string }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = { name: p.name, plan: p.plan }
  }

  const byUserList = Object.entries(userMap)
    .map(([userId, stats]) => ({
      userId,
      name: profileMap[userId]?.name ?? "Unknown",
      plan: profileMap[userId]?.plan ?? "free",
      ...stats,
    }))
    .sort((a, b) => b.cost - a.cost)

  return {
    totalCost,
    totalCalls,
    byUser: byUserList,
  }
}

// ── Impersonation ─────────────────────────────────────────────────────────

export async function getImpersonatableUsers() {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error, users: [] }

  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, name, plan")
    .order("name", { ascending: true })

  const { data: authData } = await admin.auth.admin.listUsers()

  const emailMap: Record<string, string> = {}
  for (const u of authData?.users ?? []) {
    emailMap[u.id] = u.email ?? ""
  }

  const users = (profiles ?? []).map(
    (p: { id: string; name: string | null; plan: string }) => ({
      id: p.id,
      name: p.name,
      email: emailMap[p.id] ?? "",
      plan: p.plan,
    }),
  )

  return { users }
}

export async function setImpersonation(userId: string) {
  if (!UUID_RE.test(userId)) return { error: "Invalid user ID" }
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { error: "Unauthorized" }

  const cookieStore = await cookies()
  cookieStore.set("x-impersonate-user", userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 4, // 4 hours
  })

  revalidatePath("/", "layout")
  return { success: true }
}

export async function clearImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete("x-impersonate-user")

  revalidatePath("/", "layout")
  return { success: true }
}

export async function getImpersonationState() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) return { isAdmin: false, impersonating: null }

  const cookieStore = await cookies()
  const impersonateId = cookieStore.get("x-impersonate-user")?.value ?? null

  if (!impersonateId) return { isAdmin: true, impersonating: null }

  const admin = createAdminClient()
  const [{ data: profile }, { data: authData }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("name")
      .eq("id", impersonateId)
      .single(),
    admin.auth.admin.getUserById(impersonateId),
  ])

  return {
    isAdmin: true,
    impersonating: {
      id: impersonateId,
      name: profile?.name ?? null,
      email: authData?.user?.email ?? "",
    },
  }
}
