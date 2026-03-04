"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getBriefings, triggerBriefing, type Briefing } from "@/actions/briefings"
import { checkIsAdmin } from "@/actions/admin"
import {
  FileText,
  Loader2,
  Mail,
  Check,
  Sparkles,
} from "lucide-react"

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [result, admin] = await Promise.all([
        getBriefings(),
        checkIsAdmin(),
      ])
      if (result.error) {
        setError(result.error)
      } else {
        setBriefings(result.briefings)
      }
      setIsAdmin(admin)
      setLoading(false)
    }
    load()
  }, [])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    const result = await triggerBriefing()
    setGenerating(false)
    if (result.error) {
      setError(result.error)
    } else {
      setGenerated(true)
      setTimeout(() => setGenerated(false), 3000)
    }
  }, [])

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Briefings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your curated email digests.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="shrink-0 gap-1.5"
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : generated ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {generated ? "Queued" : "Generate now"}
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Admin</span>
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {briefings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No briefings yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Briefings will appear here once generated.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {briefings.map((briefing) => (
            <a
              key={briefing.id}
              href={`/briefings/${briefing.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  briefing.sent_at
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-muted"
                )}>
                  <Mail className={cn(
                    "size-4",
                    briefing.sent_at
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(briefing.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {briefing.frequency} &middot;{" "}
                    {briefing.sent_at
                      ? `Sent ${formatTime(briefing.sent_at)}`
                      : "Not sent"}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                View &rarr;
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
