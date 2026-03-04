"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getArticles, toggleBookmark } from "@/actions/articles"
import {
  Bookmark,
  ExternalLink,
  Loader2,
} from "lucide-react"

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
  published_at: string | null
  found_at: string
}

export default function BookmarksPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const fetchArticles = useCallback(
    async (offset = 0, append = false) => {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      const result = await getArticles({ offset, bookmarked: true })

      if (append) {
        setArticles((prev) => [...prev, ...(result.articles as unknown as Article[])])
      } else {
        setArticles(result.articles as unknown as Article[])
      }
      setTotal(result.total)
      setLoading(false)
      setLoadingMore(false)
    },
    []
  )

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && articles.length < total) {
          fetchArticles(articles.length, true)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [articles.length, total, loadingMore, fetchArticles])

  const handleUnbookmark = useCallback(async (articleId: string) => {
    await toggleBookmark(articleId)
    setArticles((prev) => prev.filter((a) => a.id !== articleId))
    setTotal((prev) => prev - 1)
  }, [])

  function timeAgo(dateStr: string): string {
    const seconds = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Bookmarks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Articles you&apos;ve saved for later.
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <Bookmark className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No bookmarks yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookmark articles from your feed to save them here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="group rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {article.title}
                    <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
                  </a>
                  {article.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {article.summary}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {article.ai_score != null && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 font-medium tabular-nums",
                        article.ai_score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
                        article.ai_score >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {article.ai_score}
                      </span>
                    )}
                    <span>{timeAgo(article.published_at ?? article.found_at)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleUnbookmark(article.id)}
                  title="Remove bookmark"
                  className="shrink-0 text-amber-500 hover:text-muted-foreground"
                >
                  <Bookmark className="size-4 fill-current" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="py-4 text-center">
        {loadingMore && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
        {!loadingMore && articles.length >= total && articles.length > 0 && (
          <p className="text-xs text-muted-foreground">{total} bookmark{total !== 1 ? "s" : ""}</p>
        )}
      </div>
    </div>
  )
}
