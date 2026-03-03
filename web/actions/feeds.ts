"use server"

import { revalidatePath } from "next/cache"
import { createServerClient, getUser } from "@/lib/supabase/server"

// ── Types ───────────────────────────────────────────────────────────────

export interface Feed {
  id: string
  user_id: string
  name: string
  url: string
  type: "rss" | "podcast" | "newsletter"
  active: boolean
  last_scanned_at: string | null
  created_at: string
}

// ── Get feeds ───────────────────────────────────────────────────────────

export async function getFeeds(): Promise<{ feeds: Feed[]; error?: string }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { feeds: [], error: "Not authenticated" }

  const { data, error } = await supabase
    .from("feeds")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at")

  if (error) return { feeds: [], error: error.message }

  return { feeds: (data ?? []) as Feed[] }
}

// ── Add feed ────────────────────────────────────────────────────────────

export async function addFeed(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { feed: null, error: "Not authenticated" }

  const url = (formData.get("url") as string)?.trim()
  const name = (formData.get("name") as string)?.trim() || url
  const type = (formData.get("type") as string)?.trim() || "rss"

  if (!url) return { feed: null, error: "URL is required" }

  const { data: feed, error } = await supabase
    .from("feeds")
    .upsert(
      { user_id: user.id, name, url, type },
      { onConflict: "user_id,url" }
    )
    .select()
    .single()

  if (error) return { feed: null, error: error.message }

  revalidatePath("/feeds")
  return { feed: feed as Feed }
}

// ── Update feed ─────────────────────────────────────────────────────────

export async function updateFeed(feedId: string, formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const updates: Record<string, unknown> = {}

  const name = formData.get("name") as string | null
  if (name !== null) updates.name = name.trim()

  const active = formData.get("active") as string | null
  if (active !== null) updates.active = active === "true"

  const type = formData.get("type") as string | null
  if (type !== null) updates.type = type

  if (Object.keys(updates).length === 0) {
    return { error: "No fields to update" }
  }

  const { error } = await supabase
    .from("feeds")
    .update(updates)
    .eq("id", feedId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/feeds")
  return { success: true }
}

// ── Delete feed ─────────────────────────────────────────────────────────

export async function deleteFeed(feedId: string) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("feeds")
    .delete()
    .eq("id", feedId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/feeds")
  return { success: true }
}

// ── Trigger scan ────────────────────────────────────────────────────────

export async function triggerScan(feedId: string) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("commands")
    .insert({
      user_id: user.id,
      type: "rss.scan",
      payload: { feed_id: feedId },
    })

  if (error) return { error: error.message }

  revalidatePath("/feeds")
  return { success: true }
}

// ── Import OPML ─────────────────────────────────────────────────────────

interface OPMLFeed {
  url: string
  name: string
  type: "rss" | "podcast" | "newsletter"
}

export async function importOPML(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { imported: 0, failed: 0, error: "Not authenticated" }

  const opmlText = (formData.get("opml") as string)?.trim()
  if (!opmlText) return { imported: 0, failed: 0, error: "No OPML content" }

  // Parse OPML on the server side using regex since DOMParser is not
  // available in Node. We extract outline elements with xmlUrl attributes.
  const feeds: OPMLFeed[] = []
  const outlineRegex = /<outline[^>]*xmlUrl\s*=\s*"([^"]*)"[^>]*>/gi
  let match

  while ((match = outlineRegex.exec(opmlText)) !== null) {
    const fullTag = match[0]
    const xmlUrl = match[1]
    if (!xmlUrl) continue

    // Extract title or text attribute
    const titleMatch = fullTag.match(/title\s*=\s*"([^"]*)"/i)
    const textMatch = fullTag.match(/text\s*=\s*"([^"]*)"/i)
    const name = titleMatch?.[1] || textMatch?.[1] || xmlUrl

    // Detect type from the outline attributes or URL
    const typeAttr = fullTag.match(/type\s*=\s*"([^"]*)"/i)?.[1]?.toLowerCase()
    let type: "rss" | "podcast" | "newsletter" = "rss"
    if (typeAttr === "podcast" || xmlUrl.includes("podcast")) {
      type = "podcast"
    }

    feeds.push({ url: xmlUrl, name, type })
  }

  if (feeds.length === 0) {
    return { imported: 0, failed: 0, error: "No feeds found in OPML file" }
  }

  let imported = 0
  let failed = 0

  for (const feed of feeds) {
    const { error } = await supabase
      .from("feeds")
      .upsert(
        { user_id: user.id, name: feed.name, url: feed.url, type: feed.type },
        { onConflict: "user_id,url" }
      )
      .select()
      .single()

    if (error) {
      failed++
    } else {
      imported++
    }
  }

  revalidatePath("/feeds")
  return { imported, failed }
}
