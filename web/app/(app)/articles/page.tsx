"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getArticles, vote, toggleBookmark, markAsRead } from "@/actions/articles"
import { Input } from "@/components/ui/input"
import {
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  ExternalLink,
  Rss,
  Headphones,
  Mail,
  Loader2,
  Search,
  ArrowUpDown,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

interface Article {
  id: string
  title: string
  url: string
  content_type: string
  ai_score: number | null
  summary: string | null
  source: string
  status: string
  bookmarked: boolean
  tags: string[]
  published_at: string | null
  found_at: string
  userVote: string | null
  feedName: string | null
}

type ContentFilter = "all" | "article" | "podcast" | "newsletter"
type StatusFilter = "all" | "to_read" | "read" | "bookmarked"
type SortOption = "score" | "newest" | "oldest"
type MinScoreOption = undefined | 5 | 7 | 9

// ── Main page ──────────────────────────────────────────────────────────────

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortOption, setSortOption] = useState<SortOption>("score")
  const [minScore, setMinScore] = useState<MinScoreOption>(undefined)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const loaderRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, 300)
  }, [])

  // ── Fetch articles ─────────────────────────────────────────────────────

  const fetchArticles = useCallback(
    async (offset = 0, append = false) => {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      const result = await getArticles({
        offset,
        contentType: contentFilter !== "all" ? contentFilter : undefined,
        status: statusFilter === "bookmarked" ? undefined : statusFilter !== "all" ? statusFilter : undefined,
        bookmarked: statusFilter === "bookmarked" ? true : undefined,
        search: searchQuery || undefined,
        sort: sortOption,
        minScore,
      })

      if (append) {
        setArticles((prev) => [...prev, ...(result.articles as Article[])])
      } else {
        setArticles(result.articles as Article[])
      }
      setTotal(result.total)
      setLoading(false)
      setLoadingMore(false)
    },
    [contentFilter, statusFilter, searchQuery, sortOption, minScore]
  )

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // ── Infinite scroll ────────────────────────────────────────────────────

  useEffect(() => {
    const loader = loaderRef.current
    if (!loader) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && articles.length < total) {
          fetchArticles(articles.length, true)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loader)
    return () => observer.disconnect()
  }, [articles.length, total, loadingMore, fetchArticles])

  // ── Vote handler ───────────────────────────────────────────────────────

  const handleVote = useCallback(
    async (articleId: string, direction: "thumbs_up" | "thumbs_down") => {
      // Optimistic update
      setArticles((prev) =>
        prev.map((a) => {
          if (a.id !== articleId) return a
          const newVote = a.userVote === direction ? null : direction
          return { ...a, userVote: newVote }
        })
      )
      await vote(articleId, direction)
    },
    []
  )

  // ── Bookmark handler ───────────────────────────────────────────────────

  const handleBookmark = useCallback(async (articleId: string) => {
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id !== articleId) return a
        return { ...a, bookmarked: !a.bookmarked }
      })
    )
    await toggleBookmark(articleId)
  }, [])

  // ── Click-through (mark as read) ──────────────────────────────────────

  const handleClickThrough = useCallback(async (articleId: string) => {
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id !== articleId) return a
        return { ...a, status: "read" }
      })
    )
    await markAsRead(articleId)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Articles
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-curated content ranked by relevance to your interests
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search articles..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        {/* Content type filter */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { value: "all", label: "All" },
              { value: "article", label: "Articles", icon: Rss },
              { value: "podcast", label: "Podcasts", icon: Headphones },
              { value: "newsletter", label: "Newsletters", icon: Mail },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              onClick={() => setContentFilter(f.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                contentFilter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {"icon" in f && f.icon && <f.icon className="size-3.5" />}
              {f.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { value: "all", label: "All" },
              { value: "to_read", label: "Unread" },
              { value: "read", label: "Read" },
              { value: "bookmarked", label: "Saved" },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Min score filter */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { value: undefined, label: "Any score" },
              { value: 5, label: "5+" },
              { value: 7, label: "7+" },
              { value: 9, label: "9+" },
            ] as const
          ).map((f) => (
            <button
              key={f.label}
              onClick={() => setMinScore(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                minScore === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { value: "score", label: "Score" },
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              onClick={() => setSortOption(f.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                sortOption === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.value === "score" && <ArrowUpDown className="size-3.5" />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-6 py-16 text-center">
          <Rss className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-foreground">
            No articles yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Articles will appear here once the pipeline scans your sources.
          </p>
        </div>
      )}

      {/* Article list */}
      {!loading && articles.length > 0 && (
        <div className="space-y-3">
          {articles.filter((article, i, arr) => arr.findIndex((a) => a.id === article.id) === i).map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onVote={handleVote}
              onBookmark={handleBookmark}
              onClickThrough={handleClickThrough}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={loaderRef} className="flex justify-center py-4">
            {loadingMore && (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            )}
            {!loadingMore && articles.length >= total && articles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {total} article{total !== 1 ? "s" : ""} total
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Article card ───────────────────────────────────────────────────────────

function ArticleCard({
  article,
  onVote,
  onBookmark,
  onClickThrough,
}: {
  article: Article
  onVote: (id: string, direction: "thumbs_up" | "thumbs_down") => void
  onBookmark: (id: string) => void
  onClickThrough: (id: string) => void
}) {
  const typeIcon = {
    article: Rss,
    podcast: Headphones,
    newsletter: Mail,
  }[article.content_type] ?? Rss

  const TypeIcon = typeIcon

  return (
    <div
      className={cn(
        "group rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong",
        article.status === "read" && "opacity-75"
      )}
    >
      <div className="flex gap-3">
        {/* Score */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <ScoreBadge score={article.ai_score} />
          <TypeIcon className="size-3.5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onClickThrough(article.id)}
            className="group/link inline-flex items-start gap-1.5 text-sm font-medium text-foreground hover:text-accent"
          >
            <span className="line-clamp-2">{article.title}</span>
            <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
          </a>

          {/* Summary */}
          {article.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {article.summary}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{article.feedName || article.source}</span>
            {article.published_at && (
              <>
                <span>&middot;</span>
                <time dateTime={article.published_at}>
                  {formatDate(article.published_at)}
                </time>
              </>
            )}
            {article.tags.length > 0 && (
              <>
                <span>&middot;</span>
                <span className="truncate">
                  {article.tags.slice(0, 3).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onVote(article.id, "thumbs_up")}
            className={cn(
              "text-muted-foreground",
              article.userVote === "thumbs_up" && "text-green-600 bg-green-50"
            )}
          >
            <ThumbsUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onVote(article.id, "thumbs_down")}
            className={cn(
              "text-muted-foreground",
              article.userVote === "thumbs_down" && "text-red-600 bg-red-50"
            )}
          >
            <ThumbsDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onBookmark(article.id)}
            className={cn(
              "text-muted-foreground",
              article.bookmarked && "text-amber-500 bg-amber-50"
            )}
          >
            <Bookmark
              className={cn("size-3.5", article.bookmarked && "fill-current")}
            />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Score badge ────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
        —
      </div>
    )
  }

  const color =
    score >= 8
      ? "bg-green-50 text-green-700 border-green-200"
      : score >= 6
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-muted text-muted-foreground border-border"

  return (
    <div
      className={cn(
        "flex size-9 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums",
        color
      )}
    >
      {score}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}
