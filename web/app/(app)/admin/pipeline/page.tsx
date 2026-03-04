"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { getAdminPipeline } from "@/actions/admin"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Command {
  id: string
  user_id: string
  type: string
  status: string
  error: string | null
  attempt_count: number
  max_attempts: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface Counts {
  pending: number
  processing: number
  completed: number
  failed: number
}

interface TypeStat {
  type: string
  lastCompleted: string | null
  completed: number
  failed: number
  pending: number
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      status === "completed" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      status === "failed" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      status === "processing" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      status === "pending" && "bg-muted text-muted-foreground",
    )}>
      {status}
    </span>
  )
}

function duration(started: string | null, completed: string | null): string {
  if (!started) return "—"
  const start = new Date(started).getTime()
  const end = completed ? new Date(completed).getTime() : Date.now()
  const seconds = Math.round((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function timeAgo(dateStr: string): string {
  const seconds = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h ago`
}

export default function AdminPipelinePage() {
  const [commands, setCommands] = useState<Command[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [typeStats, setTypeStats] = useState<TypeStat[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const result = await getAdminPipeline()
    if (!result.error) {
      setCommands(result.commands as Command[])
      setTotal(result.total)
      setCounts(result.counts as Counts | null)
      setTypeStats((result.typeStats ?? []) as TypeStat[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {counts && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          {(["pending", "processing", "completed", "failed"] as const).map((status) => (
            <div key={status} className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums">{counts[status]}</p>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
          ))}
        </div>
      )}

      {typeStats.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Handler</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Completed</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Failed</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Pending</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Last run</th>
              </tr>
            </thead>
            <tbody>
              {typeStats.map((t) => (
                <tr key={t.type} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{t.type}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{t.completed}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{t.failed || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{t.pending || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {t.lastCompleted ? timeAgo(t.lastCompleted) : "never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 text-lg font-medium">Command history</h2>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Attempts</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Error</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((cmd) => (
                <tr key={cmd.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{cmd.type}</td>
                  <td className="px-4 py-3"><StatusBadge status={cmd.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{cmd.attempt_count}/{cmd.max_attempts}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{duration(cmd.started_at, cmd.completed_at)}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-red-600" title={cmd.error ?? ""}>
                    {cmd.error ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(cmd.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {commands.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No commands found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{total} commands total</p>
    </div>
  )
}
