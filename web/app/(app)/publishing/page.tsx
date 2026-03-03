"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { getPublishingData } from "@/actions/publishing"
import {
  Check,
  Copy,
  Rss,
  Mic,
  Loader2,
} from "lucide-react"
import { trackRssFeedUrlCopied } from "@/lib/analytics"

export default function PublishingPage() {
  const [feedHash, setFeedHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getPublishingData()
      setFeedHash(data.feedHash)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Publishing
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share your curated content through feeds and other outputs
      </p>

      <div className="mt-8 space-y-10">
        <RssFeedOutput feedHash={feedHash} />
        <PodcastFeedOutput />
      </div>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {badge && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="ml-12">{children}</div>
    </section>
  )
}

// ── RSS feed output ────────────────────────────────────────────────────────

function RssFeedOutput({ feedHash }: { feedHash: string | null }) {
  const [copied, setCopied] = useState(false)
  const feedUrl = feedHash
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/feed/${feedHash}`
    : null

  const handleCopy = useCallback(async () => {
    if (!feedUrl) return
    await navigator.clipboard.writeText(feedUrl)
    trackRssFeedUrlCopied()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [feedUrl])

  return (
    <Section
      icon={Rss}
      title="RSS feed"
      description="Subscribe in Feedbin, Reeder, or any RSS reader to get your curated articles."
    >
      {feedUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3">
          <code className="flex-1 truncate font-mono text-sm text-foreground">
            {feedUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check className="size-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your RSS feed URL will be available once your newsletter address is set up.
        </p>
      )}
    </Section>
  )
}

// ── Podcast feed output ────────────────────────────────────────────────────

function PodcastFeedOutput() {
  return (
    <Section
      icon={Mic}
      title="Podcast feed"
      badge="Coming soon"
      description="Listen to your curated articles as a personal podcast with text-to-speech."
    >
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
        <Mic className="mx-auto size-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re working on TTS-powered podcast feeds. Your top articles, read aloud, delivered as a podcast.
        </p>
      </div>
    </Section>
  )
}
