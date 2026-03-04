"use server"

import { revalidatePath } from "next/cache"
import { createServerClient, getUser } from "@/lib/supabase/server"

const PAGE_SIZE = 20

export async function getArticles({
  offset = 0,
  contentType,
  status,
  bookmarked,
  search,
  sort = "score",
  minScore,
}: {
  offset?: number
  contentType?: string
  status?: string
  bookmarked?: boolean
  search?: string
  sort?: "score" | "newest" | "oldest"
  minScore?: number
} = {}) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { articles: [], total: 0 }

  let query = supabase
    .from("articles")
    .select("*, votes(direction), feeds(name)", { count: "exact" })
    .eq("user_id", user.id)
    .or("ai_score.is.null,ai_score.gt.0")

  // Sort
  if (sort === "newest") {
    query = query.order("published_at", { ascending: false, nullsFirst: false })
  } else if (sort === "oldest") {
    query = query.order("published_at", { ascending: true, nullsFirst: false })
  } else {
    // Default: score
    query = query
      .order("ai_score", { ascending: false, nullsFirst: false })
      .order("found_at", { ascending: false })
  }

  query = query.range(offset, offset + PAGE_SIZE - 1)

  if (contentType && contentType !== "all") {
    query = query.eq("content_type", contentType)
  }
  if (status && status !== "all") {
    query = query.eq("status", status)
  }
  if (bookmarked) {
    query = query.eq("bookmarked", true)
  }
  if (search) {
    query = query.ilike("title", `%${search}%`)
  }
  if (minScore !== undefined) {
    query = query.gte("ai_score", minScore)
  }

  const { data, count, error } = await query

  if (error) return { articles: [], total: 0 }

  const articles = (data ?? []).map((article: Record<string, unknown>) => {
    const votes = article.votes as Array<{ direction: string }> | null
    const userVote = votes?.[0]?.direction ?? null
    const feed = article.feeds as { name: string } | null
    const feedName = feed?.name ?? null
    const { votes: _, feeds: _f, ...rest } = article
    return { ...rest, userVote, feedName }
  })

  return { articles, total: count ?? 0 }
}

export async function vote(articleId: string, direction: "thumbs_up" | "thumbs_down") {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  // Check if user already voted on this article
  const { data: existing } = await supabase
    .from("votes")
    .select("id, direction")
    .eq("user_id", user.id)
    .eq("article_id", articleId)
    .single()

  if (existing) {
    if (existing.direction === direction) {
      // Same vote → remove it (toggle off)
      await supabase.from("votes").delete().eq("id", existing.id)
    } else {
      // Different vote → update
      await supabase.from("votes").update({ direction }).eq("id", existing.id)
    }
  } else {
    // New vote
    await supabase.from("votes").insert({
      user_id: user.id,
      article_id: articleId,
      direction,
    })
  }

  revalidatePath("/articles")
  return { success: true }
}

export async function toggleBookmark(articleId: string) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  // Get current state
  const { data: article } = await supabase
    .from("articles")
    .select("bookmarked")
    .eq("id", articleId)
    .eq("user_id", user.id)
    .single()

  if (!article) return { error: "Article not found" }

  await supabase
    .from("articles")
    .update({ bookmarked: !article.bookmarked })
    .eq("id", articleId)
    .eq("user_id", user.id)

  revalidatePath("/articles")
  return { bookmarked: !article.bookmarked }
}

export async function markAsRead(articleId: string) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  await supabase
    .from("articles")
    .update({ status: "read" })
    .eq("id", articleId)
    .eq("user_id", user.id)

  return { success: true }
}
