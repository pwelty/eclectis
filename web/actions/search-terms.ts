"use server"

import { revalidatePath } from "next/cache"
import { createServerClient, getUser } from "@/lib/supabase/server"

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchTerm {
  id: string
  user_id: string
  term: string
  active: boolean
  created_at: string
  updated_at: string
}

// ── Get all search terms ───────────────────────────────────────────────────

export async function getSearchTerms(): Promise<{
  terms: SearchTerm[]
  error: string | null
}> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { terms: [], error: "Not authenticated" }

  const { data, error } = await supabase
    .from("search_terms")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return { terms: [], error: error.message }
  return { terms: data ?? [], error: null }
}

// ── Add search term ────────────────────────────────────────────────────────

export async function addSearchTerm(
  formData: FormData
): Promise<{ term: SearchTerm | null; error: string | null }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { term: null, error: "Not authenticated" }

  const term = (formData.get("term") as string)?.trim()
  if (!term) return { term: null, error: "Term is required" }

  const { data, error } = await supabase
    .from("search_terms")
    .upsert(
      { user_id: user.id, term },
      { onConflict: "user_id,term" }
    )
    .select()
    .single()

  if (error) return { term: null, error: error.message }

  revalidatePath("/search-terms")
  return { term: data, error: null }
}

// ── Update search term ─────────────────────────────────────────────────────

export async function updateSearchTerm(
  termId: string,
  formData: FormData
): Promise<{ term: SearchTerm | null; error: string | null }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { term: null, error: "Not authenticated" }

  const term = (formData.get("term") as string)?.trim()
  if (!term) return { term: null, error: "Term is required" }

  const { data, error } = await supabase
    .from("search_terms")
    .update({ term, updated_at: new Date().toISOString() })
    .eq("id", termId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return { term: null, error: error.message }

  revalidatePath("/search-terms")
  return { term: data, error: null }
}

// ── Toggle active status ───────────────────────────────────────────────────

export async function toggleSearchTerm(
  termId: string,
  active: boolean
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("search_terms")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", termId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/search-terms")
  return { error: null }
}

// ── Delete search term ─────────────────────────────────────────────────────

export async function deleteSearchTerm(
  termId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("search_terms")
    .delete()
    .eq("id", termId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/search-terms")
  return { error: null }
}

// ── Trigger search scan ────────────────────────────────────────────────────

export async function triggerSearch(
  termId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify the term belongs to this user
  const { data: term, error: termError } = await supabase
    .from("search_terms")
    .select("id")
    .eq("id", termId)
    .eq("user_id", user.id)
    .single()

  if (termError || !term) return { error: "Term not found" }

  const { error } = await supabase.from("commands").insert({
    user_id: user.id,
    type: "google_search_scan",
    payload: { term_id: termId },
  })

  if (error) return { error: error.message }

  revalidatePath("/search-terms")
  return { error: null }
}
