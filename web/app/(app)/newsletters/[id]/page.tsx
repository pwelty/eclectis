import Link from "next/link"
import { notFound } from "next/navigation"
import { getFeedWithArticles, getNewsletterIssues } from "@/actions/feeds"
import type { Article, NewsletterIssue } from "@/actions/feeds"
import { ArrowLeft, Mail, ExternalLink } from "lucide-react"

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function StatusDot({ status }: { status: NewsletterIssue["status"] }) {
  const colors = {
    complete: "bg-green-500",
    processing: "bg-yellow-500",
    failed: "bg-red-500",
    received: "bg-gray-400",
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`inline-block size-1.5 rounded-full ${colors[status]}`} />
      {status}
    </span>
  )
}

function ArticleRow({ article }: { article: Article }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[1fr_60px_80px] sm:items-center">
        <div className="min-w-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
          >
            <span className="truncate">{article.title}</span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          {article.summary && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {article.summary}
            </p>
          )}
        </div>
        <div className="text-right font-mono text-sm tabular-nums text-muted-foreground">
          {article.ai_score ?? "—"}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {new Date(article.found_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>
    </div>
  )
}

function IssueSection({
  issue,
  articles,
}: {
  issue: NewsletterIssue
  articles: Article[]
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {issue.subject || "Untitled issue"}
            </span>
            <StatusDot status={issue.status} />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatRelativeDate(issue.received_at)}
            {issue.article_count > 0 && (
              <> · {issue.article_count} article{issue.article_count !== 1 ? "s" : ""}</>
            )}
          </div>
        </div>
      </div>
      {articles.length > 0 && (
        <div className="divide-y divide-border">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}

export default async function NewsletterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ feed, articles, error }, { issues }] = await Promise.all([
    getFeedWithArticles(id),
    getNewsletterIssues(id),
  ])

  if (error || !feed) notFound()

  // Group articles by newsletter_issue_id
  const articlesByIssue = new Map<string, Article[]>()
  const legacyArticles: Article[] = []

  for (const article of articles) {
    if (article.newsletter_issue_id) {
      const list = articlesByIssue.get(article.newsletter_issue_id) ?? []
      list.push(article)
      articlesByIssue.set(article.newsletter_issue_id, list)
    } else {
      legacyArticles.push(article)
    }
  }

  const hasIssues = issues.length > 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Back link */}
      <Link
        href="/newsletters"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Newsletters
      </Link>

      {/* Header */}
      <div className="mb-8 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Mail className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-foreground">{feed.name}</h1>
            {feed.sender_email && (
              <p className="mt-0.5 text-sm text-muted-foreground">{feed.sender_email}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {articles.length} article{articles.length !== 1 ? "s" : ""}
                {hasIssues && (
                  <> across {issues.length} issue{issues.length !== 1 ? "s" : ""}</>
                )}
              </span>
              <span
                className={
                  feed.active
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500"
                }
              >
                {feed.active ? "Active" : "Paused"}
              </span>
              <span>
                Added{" "}
                {new Date(feed.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            {feed.tags && feed.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {feed.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No articles from this newsletter yet.
          </p>
        </div>
      ) : hasIssues ? (
        /* Grouped by newsletter issue */
        <div className="space-y-4">
          {issues.map((issue) => (
            <IssueSection
              key={issue.id}
              issue={issue}
              articles={articlesByIssue.get(issue.id) ?? []}
            />
          ))}
          {legacyArticles.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-medium text-muted-foreground">Earlier articles</h2>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {legacyArticles.map((article) => (
                    <ArticleRow key={article.id} article={article} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Flat list fallback (no issues yet) */
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="hidden border-b border-border bg-muted/50 px-4 py-2.5 sm:grid sm:grid-cols-[1fr_60px_80px]">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Title
            </span>
            <span className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Score
            </span>
            <span className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Date
            </span>
          </div>
          <div className="divide-y divide-border">
            {articles.map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
