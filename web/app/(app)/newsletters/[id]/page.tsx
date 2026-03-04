import Link from "next/link"
import { notFound } from "next/navigation"
import { getFeedWithArticles } from "@/actions/feeds"
import { ArrowLeft, Mail, ExternalLink } from "lucide-react"

export default async function NewsletterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { feed, articles, error } = await getFeedWithArticles(id)

  if (error || !feed) notFound()

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
          </div>
        </div>
      </div>

      {/* Articles */}
      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No articles from this newsletter yet.
          </p>
        </div>
      ) : (
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
              <div key={article.id} className="px-4 py-3">
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
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
