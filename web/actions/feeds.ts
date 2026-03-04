"use server"

import { revalidatePath } from "next/cache"
import { createServerClient, getUser } from "@/lib/supabase/server"
import { getPlanLimits } from "@/lib/plans"

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
  sender_email?: string | null
  tags?: string[]
}

export interface Article {
  id: string
  title: string
  url: string
  ai_score: number | null
  ai_reason: string | null
  summary: string | null
  content_type: string
  status: string
  tags: string[]
  found_at: string
  published_at: string | null
}

// ── Get feeds ───────────────────────────────────────────────────────────

export async function getFeeds(type?: Feed["type"]): Promise<{ feeds: Feed[]; error?: string }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { feeds: [], error: "Not authenticated" }

  let query = supabase
    .from("feeds")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at")

  if (type) {
    query = query.eq("type", type)
  }

  const { data, error } = await query

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

  // Check plan feed limit
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("id", user.id)
    .single()

  const limits = getPlanLimits(profile?.plan ?? "free")
  if (limits.maxFeeds !== Infinity) {
    const { count } = await supabase
      .from("feeds")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if ((count ?? 0) >= limits.maxFeeds) {
      return { feed: null, error: `Free plan is limited to ${limits.maxFeeds} feeds. Upgrade to Pro for unlimited.` }
    }
  }

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
  revalidatePath("/newsletters")
  revalidatePath("/podcasts")
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
  revalidatePath("/newsletters")
  revalidatePath("/podcasts")
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
  revalidatePath("/newsletters")
  revalidatePath("/podcasts")
  return { success: true }
}

// ── Trigger scan ────────────────────────────────────────────────────────

export async function triggerScan(feedId: string) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  // Look up feed type to dispatch correct command
  const { data: feed } = await supabase
    .from("feeds")
    .select("type")
    .eq("id", feedId)
    .eq("user_id", user.id)
    .single()

  if (!feed) return { error: "Feed not found" }

  // rss and podcast feeds use rss.scan; newsletters use newsletter.process
  const commandType = feed.type === "newsletter" ? "newsletter.process" : "rss.scan"

  const { error } = await supabase
    .from("commands")
    .insert({
      user_id: user.id,
      type: commandType,
      payload: { feed_id: feedId },
    })

  if (error) return { error: error.message }

  revalidatePath("/feeds")
  revalidatePath("/newsletters")
  revalidatePath("/podcasts")
  return { success: true }
}

// ── Discover — scan all active feeds of a type ─────────────────────────

export async function discoverAll(feedType: Feed["type"]) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const commandType = feedType === "newsletter" ? "newsletter.process" : "rss.scan"

  const { error } = await supabase
    .from("commands")
    .insert({
      user_id: user.id,
      type: commandType,
    })

  if (error) return { error: error.message }

  revalidatePath("/feeds")
  revalidatePath("/newsletters")
  revalidatePath("/podcasts")
  return { success: true }
}

// ── Import OPML ─────────────────────────────────────────────────────────

interface OPMLFeed {
  url: string
  name: string
  type: "rss" | "podcast" | "newsletter"
  tags: string[]
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return (parsed.hostname.toLowerCase() + parsed.pathname + parsed.search)
      .replace(/\/+$/, "")
  } catch {
    return url.toLowerCase().replace(/\/+$/, "")
  }
}

function parseOPML(opmlText: string): OPMLFeed[] {
  const feedMap = new Map<string, OPMLFeed>()

  // Helper to extract an attribute value from an outline tag string
  function getAttr(tag: string, attr: string): string | null {
    const re = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, "i")
    return tag.match(re)?.[1] ?? null
  }

  // Helper to parse a leaf outline into an OPMLFeed entry (without tags)
  function parseLeaf(tag: string): { url: string; name: string; type: "rss" | "podcast" | "newsletter" } | null {
    const xmlUrl = getAttr(tag, "xmlUrl")
    if (!xmlUrl) return null

    // Skip non-HTTP URLs (e.g. email addresses, bare domains)
    if (!/^https?:\/\//i.test(xmlUrl)) return null

    const name = getAttr(tag, "title") || getAttr(tag, "text") || xmlUrl
    const typeAttr = getAttr(tag, "type")?.toLowerCase()
    let type: "rss" | "podcast" | "newsletter" = "rss"
    if (typeAttr === "podcast" || xmlUrl.includes("podcast")) {
      type = "podcast"
    }

    return { url: xmlUrl, name, type }
  }

  // First pass: find folder outlines and their children
  // A folder outline has text/title but no xmlUrl, and contains child outlines
  const folderRegex = /<outline\s+[^>]*?(?:text|title)\s*=\s*"([^"]*)"[^>]*>[\s\S]*?<\/outline>/gi
  let folderMatch

  while ((folderMatch = folderRegex.exec(opmlText)) !== null) {
    const fullBlock = folderMatch[0]
    const folderTag = fullBlock.match(/<outline[^>]*>/i)?.[0] ?? ""

    // Skip if this outline itself has xmlUrl (it's a leaf, not a folder)
    if (getAttr(folderTag, "xmlUrl")) continue

    const folderName = getAttr(folderTag, "text") || getAttr(folderTag, "title") || ""

    // Find child outlines with xmlUrl inside this folder
    const childRegex = /<outline[^>]*xmlUrl\s*=\s*"[^"]*"[^>]*\/?>/gi
    let childMatch

    while ((childMatch = childRegex.exec(fullBlock)) !== null) {
      const childTag = childMatch[0]
      const leaf = parseLeaf(childTag)
      if (!leaf) continue

      const key = normalizeUrl(leaf.url)
      const existing = feedMap.get(key)
      if (existing) {
        // Merge tag if not already present
        if (folderName && !existing.tags.includes(folderName)) {
          existing.tags.push(folderName)
        }
      } else {
        feedMap.set(key, {
          ...leaf,
          tags: folderName ? [folderName] : [],
        })
      }
    }
  }

  // Second pass: extract top-level feeds (not inside any folder)
  // These are self-closing outlines with xmlUrl that are direct children of <body>
  const topLevelRegex = /<body[^>]*>([\s\S]*)<\/body>/i
  const bodyMatch = opmlText.match(topLevelRegex)
  if (bodyMatch) {
    const bodyContent = bodyMatch[1]
    // Match self-closing outline tags at the top level of body
    // We strip out folder blocks first to isolate top-level entries
    const stripped = bodyContent.replace(/<outline\s+[^>]*?(?:text|title)\s*=\s*"[^"]*"[^>]*>[\s\S]*?<\/outline>/gi, (match) => {
      const tag = match.match(/<outline[^>]*>/i)?.[0] ?? ""
      // Only strip if it's a folder (no xmlUrl on the parent)
      return getAttr(tag, "xmlUrl") ? match : ""
    })

    const leafRegex = /<outline[^>]*xmlUrl\s*=\s*"[^"]*"[^>]*\/?>/gi
    let leafMatch

    while ((leafMatch = leafRegex.exec(stripped)) !== null) {
      const leaf = parseLeaf(leafMatch[0])
      if (!leaf) continue

      const key = normalizeUrl(leaf.url)
      if (!feedMap.has(key)) {
        feedMap.set(key, { ...leaf, tags: [] })
      }
    }
  }

  return Array.from(feedMap.values())
}

export async function importOPML(formData: FormData) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { imported: 0, failed: 0, error: "Not authenticated" }

  const opmlText = (formData.get("opml") as string)?.trim()
  if (!opmlText) return { imported: 0, failed: 0, error: "No OPML content" }

  // Parse OPML with folder-aware extraction, URL dedup, and tag merging
  const feeds = parseOPML(opmlText)

  if (feeds.length === 0) {
    return { imported: 0, failed: 0, error: "No feeds found in OPML file" }
  }

  // Check plan feed limit
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("id", user.id)
    .single()

  const limits = getPlanLimits(profile?.plan ?? "free")
  if (limits.maxFeeds !== Infinity) {
    const { count } = await supabase
      .from("feeds")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    const currentCount = count ?? 0
    const remaining = limits.maxFeeds - currentCount
    if (remaining <= 0) {
      return { imported: 0, failed: 0, error: `Free plan is limited to ${limits.maxFeeds} feeds. Upgrade to Pro for unlimited.` }
    }
    // Truncate import to remaining slots
    if (feeds.length > remaining) {
      feeds.length = remaining
    }
  }

  let imported = 0
  let failed = 0

  for (const feed of feeds) {
    const { error } = await supabase
      .from("feeds")
      .upsert(
        { user_id: user.id, name: feed.name, url: feed.url, type: feed.type, tags: feed.tags },
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
  revalidatePath("/newsletters")
  revalidatePath("/podcasts")
  return { imported, failed }
}

// ── Get feed with articles ─────────────────────────────────────────────

export async function getFeedWithArticles(feedId: string): Promise<{
  feed: Feed | null
  articles: Article[]
  error?: string
}> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { feed: null, articles: [], error: "Not authenticated" }

  const { data: feed, error: feedError } = await supabase
    .from("feeds")
    .select("*")
    .eq("id", feedId)
    .eq("user_id", user.id)
    .single()

  if (feedError || !feed) {
    return { feed: null, articles: [], error: "Feed not found" }
  }

  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, url, ai_score, ai_reason, summary, content_type, status, tags, found_at, published_at")
    .eq("feed_id", feedId)
    .eq("user_id", user.id)
    .order("found_at", { ascending: false })

  return { feed: feed as Feed, articles: (articles ?? []) as Article[] }
}
