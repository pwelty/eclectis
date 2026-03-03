"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createServerClient, getUser } from "@/lib/supabase/server"

// ── Save interests ──────────────────────────────────────────────────────

export async function saveInterests(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const interests = formData.get("interests") as string

  const { error } = await supabase
    .from("user_profiles")
    .update({ interests })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/onboarding")
  return { success: true }
}

// ── Add feed ────────────────────────────────────────────────────────────

export async function addFeed(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { feed: null, error: "Not authenticated" }

  const url = (formData.get("url") as string)?.trim()
  const name = (formData.get("name") as string)?.trim() || url

  if (!url) return { feed: null, error: "URL is required" }

  const { data: feed, error } = await supabase
    .from("feeds")
    .upsert(
      { user_id: user.id, name, url, type: "rss" },
      { onConflict: "user_id,url" }
    )
    .select()
    .single()

  if (error) return { feed: null, error: error.message }

  revalidatePath("/onboarding")
  return { feed }
}

// ── Remove feed ─────────────────────────────────────────────────────────

export async function removeFeed(feedId: string) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("feeds")
    .delete()
    .eq("id", feedId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/onboarding")
  return { success: true }
}

// ── Add search term ─────────────────────────────────────────────────────

export async function addSearchTerm(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { term: null, error: "Not authenticated" }

  const term = (formData.get("term") as string)?.trim()

  if (!term) return { term: null, error: "Term is required" }

  const { data: searchTerm, error } = await supabase
    .from("search_terms")
    .upsert(
      { user_id: user.id, term },
      { onConflict: "user_id,term" }
    )
    .select()
    .single()

  if (error) return { term: null, error: error.message }

  revalidatePath("/onboarding")
  return { term: searchTerm }
}

// ── Remove search term ──────────────────────────────────────────────────

export async function removeSearchTerm(termId: string) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("search_terms")
    .delete()
    .eq("id", termId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/onboarding")
  return { success: true }
}

// ── Get onboarding data ─────────────────────────────────────────────────

export async function getOnboardingData() {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { profile: null, feeds: [], searchTerms: [], newsletterAddress: null }

  const [profileRes, feedsRes, termsRes, addressRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
    supabase.from("feeds").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("search_terms").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("newsletter_addresses").select("*").eq("user_id", user.id).single(),
  ])

  return {
    profile: profileRes.data,
    feeds: feedsRes.data ?? [],
    searchTerms: termsRes.data ?? [],
    newsletterAddress: addressRes.data,
  }
}

// ── Complete onboarding ─────────────────────────────────────────────────

export async function completeOnboarding() {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("commands")
    .insert({
      user_id: user.id,
      type: "daily.pipeline",
    })

  if (error) return { error: error.message }

  redirect("/articles")
}
