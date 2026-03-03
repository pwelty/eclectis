"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getIdeas,
  getIdeaWithArticles,
  type Idea,
  type IdeaWithArticles,
} from "@/actions/ideas"
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Newspaper,
  Sparkles,
} from "lucide-react"

// ── Status filter options ─────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "active" as const, label: "Active" },
  { value: "draft" as const, label: "Draft" },
  { value: "archived" as const, label: "Archived" },
]

// ── Strength indicator ────────────────────────────────────────────────────

function StrengthIndicator({ strength }: { strength: number }) {
  const level =
    strength >= 70 ? "high" : strength >= 40 ? "medium" : "low"

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((bar) => {
          const threshold = bar * 20
          const filled = strength >= threshold
          return (
            <div
              key={bar}
              className={cn(
                "h-3 w-1 rounded-full",
                filled && level === "high" && "bg-score-high",
                filled && level === "medium" && "bg-score-mid",
                filled && level === "low" && "bg-score-low",
                !filled && "bg-border"
              )}
            />
          )
        })}
      </div>
      <span
        className={cn(
          "tabular-nums text-xs font-medium",
          level === "high" && "text-score-high",
          level === "medium" && "text-score-mid",
          level === "low" && "text-muted-foreground"
        )}
      >
        {strength}
      </span>
    </div>
  )
}

// ── Article row within an expanded idea ───────────────────────────────────

function ArticleRow({
  article,
  relevanceNote,
}: {
  article: { id: string; title: string; url: string; ai_score: number | null; summary: string | null }
  relevanceNote: string | null
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
      <Newspaper className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground hover:text-accent hover:underline"
          >
            {article.title}
            <ExternalLink className="mb-0.5 ml-1 inline size-3 text-muted-foreground" />
          </a>
          {article.ai_score !== null && (
            <span
              className={cn(
                "tabular-nums shrink-0 text-xs font-medium",
                article.ai_score >= 70 && "text-score-high",
                article.ai_score >= 40 && article.ai_score < 70 && "text-score-mid",
                article.ai_score < 40 && "text-muted-foreground"
              )}
            >
              {article.ai_score}
            </span>
          )}
        </div>
        {(relevanceNote || article.summary) && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {relevanceNote || article.summary}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Idea card ─────────────────────────────────────────────────────────────

function IdeaCard({ idea }: { idea: Idea }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<IdeaWithArticles | null>(null)
  const [loading, setLoading] = useState(false)

  const handleToggle = useCallback(async () => {
    if (expanded) {
      setExpanded(false)
      return
    }

    setExpanded(true)

    // Fetch articles on first expand
    if (!detail) {
      setLoading(true)
      const result = await getIdeaWithArticles(idea.id)
      if (result.idea) {
        setDetail(result.idea)
      }
      setLoading(false)
    }
  }, [expanded, detail, idea.id])

  const synthesizedDate = idea.last_synthesized_at
    ? new Date(idea.last_synthesized_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{idea.title}</CardTitle>
            {idea.summary && (
              <CardDescription className="mt-1 line-clamp-2">
                {idea.summary}
              </CardDescription>
            )}
          </div>
          <StrengthIndicator strength={idea.strength} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Newspaper className="size-3" />
            {idea.article_count} {idea.article_count === 1 ? "article" : "articles"}
          </span>
          {synthesizedDate && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3" />
              {synthesizedDate}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          disabled={idea.article_count === 0}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3" />
              Hide articles
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              Show articles
            </>
          )}
        </Button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {loading && (
              <p className="py-2 text-xs text-muted-foreground">
                Loading articles...
              </p>
            )}
            {!loading && detail && detail.articles.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">
                No linked articles yet.
              </p>
            )}
            {!loading &&
              detail?.articles.map((ia) => (
                <ArticleRow
                  key={ia.id}
                  article={ia.article}
                  relevanceNote={ia.relevance_note}
                />
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const [status, setStatus] = useState<"active" | "draft" | "archived">(
    "active"
  )
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const result = await getIdeas(status)
      if (cancelled) return
      setIdeas(result.ideas)
      setError(result.error)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [status])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Ideas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Themes and patterns discovered across your content
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              status === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading ideas...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && ideas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 py-16 text-center">
          <Lightbulb className="mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No ideas yet</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Ideas are generated automatically as we discover patterns in your
            content. Check back after your next scan.
          </p>
        </div>
      )}

      {/* Ideas grid */}
      {!loading && ideas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  )
}
