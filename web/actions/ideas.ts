"use server"

import { createServerClient, getUser } from "@/lib/supabase/server"

// ── Types ──────────────────────────────────────────────────────────────────

export interface Idea {
  id: string
  title: string
  summary: string | null
  status: "draft" | "active" | "archived"
  strength: number
  last_synthesized_at: string | null
  created_at: string
  updated_at: string
  article_count: number
}

export interface IdeaArticle {
  id: string
  relevance_note: string | null
  article: {
    id: string
    title: string
    url: string
    ai_score: number | null
    summary: string | null
  }
}

export interface IdeaWithArticles extends Idea {
  articles: IdeaArticle[]
}

// ── Get ideas list ─────────────────────────────────────────────────────────

export async function getIdeas(
  status: "active" | "draft" | "archived" = "active"
): Promise<{ ideas: Idea[]; error: string | null }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { ideas: [], error: "Not authenticated" }

  // Fetch ideas with article count via a left join count
  const { data, error } = await supabase
    .from("ideas")
    .select("*, idea_articles(count)")
    .eq("user_id", user.id)
    .eq("status", status)
    .order("strength", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return { ideas: [], error: error.message }

  const ideas: Idea[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    strength: row.strength,
    last_synthesized_at: row.last_synthesized_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    article_count: (row.idea_articles as { count: number }[])?.[0]?.count ?? 0,
  }))

  return { ideas, error: null }
}

// ── Get single idea with linked articles ───────────────────────────────────

export async function getIdeaWithArticles(
  ideaId: string
): Promise<{ idea: IdeaWithArticles | null; error: string | null }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { idea: null, error: "Not authenticated" }

  // Fetch the idea
  const { data: ideaData, error: ideaError } = await supabase
    .from("ideas")
    .select("*, idea_articles(count)")
    .eq("id", ideaId)
    .eq("user_id", user.id)
    .single()

  if (ideaError) return { idea: null, error: ideaError.message }
  if (!ideaData) return { idea: null, error: "Idea not found" }

  // Fetch linked articles
  const { data: linkedArticles, error: articlesError } = await supabase
    .from("idea_articles")
    .select("id, relevance_note, articles(id, title, url, ai_score, summary)")
    .eq("idea_id", ideaId)

  if (articlesError) return { idea: null, error: articlesError.message }

  const idea: IdeaWithArticles = {
    id: ideaData.id,
    title: ideaData.title,
    summary: ideaData.summary,
    status: ideaData.status,
    strength: ideaData.strength,
    last_synthesized_at: ideaData.last_synthesized_at,
    created_at: ideaData.created_at,
    updated_at: ideaData.updated_at,
    article_count:
      (ideaData.idea_articles as { count: number }[])?.[0]?.count ?? 0,
    articles: (linkedArticles ?? []).map((row) => ({
      id: row.id,
      relevance_note: row.relevance_note,
      article: row.articles as unknown as IdeaArticle["article"],
    })),
  }

  return { idea, error: null }
}
