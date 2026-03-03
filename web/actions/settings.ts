"use server"

import { revalidatePath } from "next/cache"
import { createServerClient, getUser } from "@/lib/supabase/server"
import { getPlanLimits } from "@/lib/plans"

// ── Get settings data ──────────────────────────────────────────────────────

export async function getSettings() {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { profile: null, newsletterAddress: null, feedHash: null }

  const [profileRes, addressRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
    supabase.from("newsletter_addresses").select("*").eq("user_id", user.id).single(),
  ])

  const feedHash = addressRes.data?.address?.split("@")[0] ?? null

  return {
    profile: profileRes.data,
    newsletterAddress: addressRes.data,
    feedHash,
    email: user.email,
    plan: profileRes.data?.plan ?? "free",
    subscriptionStatus: profileRes.data?.subscription_status ?? null,
    currentPeriodEnd: profileRes.data?.current_period_end ?? null,
    hasStripeCustomer: !!profileRes.data?.stripe_customer_id,
  }
}

// ── Save interests ─────────────────────────────────────────────────────────

export async function updateInterests(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const interests = formData.get("interests") as string

  const { error } = await supabase
    .from("user_profiles")
    .update({ interests })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── Save API key ───────────────────────────────────────────────────────────

export async function saveApiKey(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const apiKey = (formData.get("api_key") as string)?.trim() || null

  const { error } = await supabase
    .from("user_profiles")
    .update({ api_key: apiKey })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

export async function removeApiKey() {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("user_profiles")
    .update({ api_key: null })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── Briefing preferences ───────────────────────────────────────────────────

export async function updateBriefingPreferences(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const frequency = formData.get("frequency") as string
  const sendHour = parseInt(formData.get("send_hour") as string, 10)

  // Gate briefings to Pro plan
  if (frequency !== "off") {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("plan")
      .eq("id", user.id)
      .single()

    const limits = getPlanLimits(profile?.plan ?? "free")
    if (!limits.emailBriefings) {
      return { error: "Email briefings require the Pro plan." }
    }
  }

  // Get current preferences
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const currentPrefs = (profile?.preferences as Record<string, unknown>) ?? {}

  const { error } = await supabase
    .from("user_profiles")
    .update({
      preferences: {
        ...currentPrefs,
        briefing_frequency: frequency,
        briefing_send_hour: isNaN(sendHour) ? 7 : sendHour,
      },
    })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── Update password ────────────────────────────────────────────────────────

export async function updatePassword(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const newPassword = formData.get("new_password") as string

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) return { error: error.message }

  return { success: true }
}

// ── Delete account ─────────────────────────────────────────────────────────

export async function deleteAccount() {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  // Sign out first, then delete via admin (or let cascade handle it)
  // For now, we sign out — full account deletion requires admin API
  await supabase.auth.signOut()
  return { success: true }
}
