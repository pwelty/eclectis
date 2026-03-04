"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  getFeeds,
  addFeed,
  updateFeed,
  deleteFeed,
  triggerScan,
  importOPML,
  type Feed,
} from "@/actions/feeds"
import {
  Plus,
  X,
  Upload,
  Rss,
  Podcast,
  Mail,
  Pencil,
  Trash2,
  RefreshCw,
  Check,
} from "lucide-react"

// ── Type config ─────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  rss: {
    label: "RSS",
    icon: Rss,
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    placeholder: "https://example.com/feed.xml",
    emptyTitle: "No RSS feeds yet",
    emptyDescription: "Add your first RSS feed above or import from an OPML file.",
  },
  podcast: {
    label: "Podcast",
    icon: Podcast,
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    placeholder: "https://example.com/podcast.xml",
    emptyTitle: "No podcasts yet",
    emptyDescription: "Add a podcast feed URL above.",
  },
  newsletter: {
    label: "Newsletter",
    icon: Mail,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    placeholder: "https://example.com/newsletter-feed",
    emptyTitle: "No newsletters yet",
    emptyDescription: "Add a newsletter feed URL above, or forward newsletters to your Eclectis address.",
  },
} as const

type FeedType = keyof typeof TYPE_CONFIG

// ── Props ───────────────────────────────────────────────────────────────

interface FeedListProps {
  feedType: FeedType
  title: string
  description: string
  showOPML?: boolean
}

// ── Main component ──────────────────────────────────────────────────────

export function FeedList({ feedType, title, description, showOPML = false }: FeedListProps) {
  const config = TYPE_CONFIG[feedType]
  const EmptyIcon = config.icon

  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add feed form state
  const [feedUrl, setFeedUrl] = useState("")
  const [feedName, setFeedName] = useState("")
  const [addingFeed, setAddingFeed] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // OPML import state
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Scan state
  const [scanningId, setScanningId] = useState<string | null>(null)

  // ── Load feeds ──────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const result = await getFeeds(feedType)
      if (result.error) {
        setError(result.error)
      } else {
        setFeeds(result.feeds)
      }
      setLoading(false)
    }
    load()
  }, [feedType])

  // ── Add feed ────────────────────────────────────────────────────────

  const handleAddFeed = useCallback(async () => {
    if (!feedUrl.trim()) return
    setAddingFeed(true)
    setAddError(null)

    const formData = new FormData()
    formData.set("url", feedUrl)
    formData.set("name", feedName || feedUrl)
    formData.set("type", feedType)

    const result = await addFeed(formData)
    if (result.error) {
      setAddError(result.error)
    } else if (result.feed) {
      setFeeds((prev) => {
        const existing = prev.findIndex((f) => f.id === result.feed!.id)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = result.feed!
          return updated
        }
        return [...prev, result.feed!]
      })
      setFeedUrl("")
      setFeedName("")
    }
    setAddingFeed(false)
  }, [feedUrl, feedName, feedType])

  // ── Edit feed ───────────────────────────────────────────────────────

  const startEdit = useCallback((feed: Feed) => {
    setEditingId(feed.id)
    setEditName(feed.name)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditName("")
  }, [])

  const saveEdit = useCallback(
    async (feedId: string) => {
      if (!editName.trim()) return

      const formData = new FormData()
      formData.set("name", editName)

      const result = await updateFeed(feedId, formData)
      if (!result.error) {
        setFeeds((prev) =>
          prev.map((f) =>
            f.id === feedId ? { ...f, name: editName.trim() } : f
          )
        )
        setEditingId(null)
        setEditName("")
      }
    },
    [editName]
  )

  // ── Toggle active ──────────────────────────────────────────────────

  const handleToggleActive = useCallback(async (feed: Feed) => {
    const formData = new FormData()
    formData.set("active", String(!feed.active))

    const result = await updateFeed(feed.id, formData)
    if (!result.error) {
      setFeeds((prev) =>
        prev.map((f) => (f.id === feed.id ? { ...f, active: !f.active } : f))
      )
    }
  }, [])

  // ── Delete feed ─────────────────────────────────────────────────────

  const handleDelete = useCallback(async (feedId: string) => {
    const result = await deleteFeed(feedId)
    if (!result.error) {
      setFeeds((prev) => prev.filter((f) => f.id !== feedId))
    }
    setDeletingId(null)
  }, [])

  // ── Trigger scan ───────────────────────────────────────────────────

  const handleScan = useCallback(async (feedId: string) => {
    setScanningId(feedId)
    await triggerScan(feedId)
    setTimeout(() => setScanningId(null), 1500)
  }, [])

  // ── OPML import ────────────────────────────────────────────────────

  const handleImportOPML = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setImportResult(null)
      setAddError(null)

      try {
        const text = await file.text()
        const formData = new FormData()
        formData.set("opml", text)

        const result = await importOPML(formData)
        if (result.error) {
          setAddError(result.error)
        } else {
          setImportResult(
            `Imported ${result.imported} feed${result.imported !== 1 ? "s" : ""}${
              result.failed > 0 ? `, ${result.failed} failed` : ""
            }`
          )
          const feedsResult = await getFeeds(feedType)
          if (!feedsResult.error) {
            setFeeds(feedsResult.feeds)
          }
        }
      } catch {
        setAddError("Failed to read OPML file")
      }

      e.target.value = ""
    },
    [feedType]
  )

  // ── Format date ────────────────────────────────────────────────────

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Never"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  // ── Loading / error states ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Add feed form */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Add a source
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder={config.placeholder}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddFeed()
              }
            }}
          />
          <Input
            value={feedName}
            onChange={(e) => setFeedName(e.target.value)}
            placeholder="Name (optional)"
            className="sm:w-48"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddFeed()
              }
            }}
          />
          <Button
            onClick={handleAddFeed}
            disabled={addingFeed || !feedUrl.trim()}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {/* OPML import — only for RSS */}
        {showOPML && (
          <div className="mt-3 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".opml,.xml"
              className="hidden"
              onChange={handleImportOPML}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Import OPML
            </Button>

            {importResult && (
              <span className="text-sm text-green-600 dark:text-green-400">
                {importResult}
              </span>
            )}
          </div>
        )}

        {addError && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {addError}
          </div>
        )}
      </div>

      {/* Feed list */}
      {feeds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <EmptyIcon className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {config.emptyTitle}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.emptyDescription}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="hidden border-b border-border bg-muted/50 px-4 py-2.5 sm:grid sm:grid-cols-[1fr_80px_100px_140px]">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <span className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last scanned
            </span>
            <span className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Actions
            </span>
          </div>

          <div className="divide-y divide-border">
            {feeds.map((feed) => (
              <FeedRow
                key={feed.id}
                feed={feed}
                editingId={editingId}
                editName={editName}
                setEditName={setEditName}
                deletingId={deletingId}
                scanningId={scanningId}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
                onConfirmDelete={setDeletingId}
                onScan={handleScan}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>
      )}

      {feeds.length > 0 && (
        <div className="mt-3 text-right text-xs text-muted-foreground">
          {feeds.length} source{feeds.length !== 1 ? "s" : ""} &middot;{" "}
          {feeds.filter((f) => f.active).length} active
        </div>
      )}
    </div>
  )
}

// ── Feed row component ──────────────────────────────────────────────────

function FeedRow({
  feed,
  editingId,
  editName,
  setEditName,
  deletingId,
  scanningId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleActive,
  onDelete,
  onConfirmDelete,
  onScan,
  formatDate,
}: {
  feed: Feed
  editingId: string | null
  editName: string
  setEditName: (v: string) => void
  deletingId: string | null
  scanningId: string | null
  onStartEdit: (feed: Feed) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onToggleActive: (feed: Feed) => void
  onDelete: (id: string) => void
  onConfirmDelete: (id: string | null) => void
  onScan: (id: string) => void
  formatDate: (d: string | null) => string
}) {
  const isEditing = editingId === feed.id
  const isDeleting = deletingId === feed.id
  const isScanning = scanningId === feed.id

  return (
    <div
      className={cn(
        "px-4 py-3 transition-colors",
        !feed.active && "opacity-60"
      )}
    >
      {isDeleting && (
        <div className="mb-3 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
          <span className="text-sm text-destructive">
            Delete &ldquo;{feed.name}&rdquo;?
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="xs"
              onClick={() => onDelete(feed.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_80px_100px_140px] sm:items-center">
        {/* Feed name + URL */}
        <div className="min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onSaveEdit(feed.id)
                  }
                  if (e.key === "Escape") onCancelEdit()
                }}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onSaveEdit(feed.id)}
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onCancelEdit}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-foreground">
                {feed.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {feed.url}
              </p>
            </>
          )}
        </div>

        {/* Active status */}
        <div>
          <button
            onClick={() => onToggleActive(feed)}
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
              feed.active
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            )}
          >
            {feed.active ? "Active" : "Paused"}
          </button>
        </div>

        {/* Last scanned */}
        <div className="text-right text-xs text-muted-foreground">
          {formatDate(feed.last_scanned_at)}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onStartEdit(feed)}
            title="Rename"
            disabled={isEditing}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onScan(feed.id)}
            title="Scan now"
            disabled={isScanning}
            className={isScanning ? "animate-spin" : ""}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onConfirmDelete(feed.id)}
            title="Delete"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
