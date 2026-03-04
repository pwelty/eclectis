"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  getSearchTerms,
  addSearchTerm,
  updateSearchTerm,
  deleteSearchTerm,
  toggleSearchTerm,
  triggerSearch,
  discoverAllSearchTerms,
  type SearchTerm,
} from "@/actions/search-terms"
import { checkIsAdmin } from "@/actions/admin"
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  Loader2,
  Sparkles,
} from "lucide-react"

// ── Main page ──────────────────────────────────────────────────────────────

export default function SearchTermsPage() {
  const [terms, setTerms] = useState<SearchTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [newTerm, setNewTerm] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Trigger state
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [triggeredId, setTriggeredId] = useState<string | null>(null)

  // Discover all state
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState(false)

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false)

  // ── Load terms ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const [result, admin] = await Promise.all([
        getSearchTerms(),
        checkIsAdmin(),
      ])
      if (result.error) {
        setError(result.error)
      } else {
        setTerms(result.terms)
      }
      setIsAdmin(admin)
      setLoading(false)
    }
    load()
  }, [])

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  // ── Add term ───────────────────────────────────────────────────────────

  const handleAdd = useCallback(async () => {
    const trimmed = newTerm.trim()
    if (!trimmed) return

    setAdding(true)
    setAddError(null)

    const formData = new FormData()
    formData.set("term", trimmed)
    const result = await addSearchTerm(formData)

    if (result.error) {
      setAddError(result.error)
    } else if (result.term) {
      setTerms((prev) => {
        // If upsert returned an existing term, don't duplicate
        if (prev.some((t) => t.id === result.term!.id)) return prev
        return [...prev, result.term!]
      })
      setNewTerm("")
      addInputRef.current?.focus()
    }
    setAdding(false)
  }, [newTerm])

  // ── Edit term ──────────────────────────────────────────────────────────

  const startEdit = useCallback((term: SearchTerm) => {
    setEditingId(term.id)
    setEditValue(term.term)
    setDeletingId(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValue("")
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    const trimmed = editValue.trim()
    if (!trimmed) return

    setSaving(true)
    const formData = new FormData()
    formData.set("term", trimmed)
    const result = await updateSearchTerm(editingId, formData)

    if (result.error) {
      setAddError(result.error)
    } else if (result.term) {
      setTerms((prev) =>
        prev.map((t) => (t.id === editingId ? result.term! : t))
      )
      setEditingId(null)
      setEditValue("")
    }
    setSaving(false)
  }, [editingId, editValue])

  // ── Toggle active ──────────────────────────────────────────────────────

  const handleToggle = useCallback(
    async (term: SearchTerm) => {
      const newActive = !term.active
      // Optimistic update
      setTerms((prev) =>
        prev.map((t) => (t.id === term.id ? { ...t, active: newActive } : t))
      )
      const result = await toggleSearchTerm(term.id, newActive)
      if (result.error) {
        // Revert on error
        setTerms((prev) =>
          prev.map((t) =>
            t.id === term.id ? { ...t, active: !newActive } : t
          )
        )
        setAddError(result.error)
      }
    },
    []
  )

  // ── Delete term ────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (termId: string) => {
    const result = await deleteSearchTerm(termId)
    if (result.error) {
      setAddError(result.error)
    } else {
      setTerms((prev) => prev.filter((t) => t.id !== termId))
      setDeletingId(null)
    }
  }, [])

  // ── Trigger search ─────────────────────────────────────────────────────

  const handleTrigger = useCallback(async (termId: string) => {
    setTriggeringId(termId)
    setTriggeredId(null)
    const result = await triggerSearch(termId)
    if (result.error) {
      setAddError(result.error)
    } else {
      setTriggeredId(termId)
      setTimeout(() => setTriggeredId(null), 2000)
    }
    setTriggeringId(null)
  }, [])

  // ── Discover all ──────────────────────────────────────────────────

  const handleDiscoverAll = useCallback(async () => {
    setDiscovering(true)
    const result = await discoverAllSearchTerms()
    if (result.error) {
      setAddError(result.error)
    } else {
      setDiscovered(true)
      setTimeout(() => setDiscovered(false), 3000)
    }
    setDiscovering(false)
  }, [])

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  // ── Auth error ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
          <a
            href="/login"
            className="mt-2 inline-block text-sm text-muted-foreground hover:underline"
          >
            Log in
          </a>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Search terms
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage Google discovery search terms. Active terms are scanned
            automatically during each pipeline run.
          </p>
        </div>
        {isAdmin && terms.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscoverAll}
            disabled={discovering}
            className="shrink-0 gap-1.5"
          >
            {discovering ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : discovered ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {discovered ? "Scan queued" : "Scan now"}
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Admin</span>
          </Button>
        )}
      </div>

      {/* Add term form */}
      <div className="mb-6">
        <div className="flex gap-2">
          <Input
            ref={addInputRef}
            value={newTerm}
            onChange={(e) => {
              setNewTerm(e.target.value)
              setAddError(null)
            }}
            placeholder="e.g. Claude API best practices"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
            disabled={adding}
          />
          <Button
            onClick={handleAdd}
            disabled={adding || !newTerm.trim()}
          >
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </div>

        {/* Error message */}
        {addError && (
          <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {addError}
          </div>
        )}
      </div>

      {/* Term list */}
      {terms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <Search className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No search terms yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a term above to start discovering content via Google search.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {terms.map((term) => (
            <div
              key={term.id}
              className={cn(
                "flex items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-colors",
                term.active
                  ? "bg-secondary/50"
                  : "bg-muted/30 opacity-60"
              )}
            >
              {/* Active toggle */}
              <button
                onClick={() => handleToggle(term)}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                  term.active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
                title={term.active ? "Deactivate" : "Activate"}
              >
                {term.active && <Check className="size-3" />}
              </button>

              {/* Term text or edit input */}
              <div className="min-w-0 flex-1">
                {editingId === term.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          saveEdit()
                        }
                        if (e.key === "Escape") {
                          cancelEdit()
                        }
                      }}
                      disabled={saving}
                      className="h-7 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={saveEdit}
                      disabled={saving || !editValue.trim()}
                      title="Save"
                    >
                      {saving ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={cancelEdit}
                      disabled={saving}
                      title="Cancel"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-foreground">
                    {term.term}
                  </span>
                )}
              </div>

              {/* Actions (hidden during edit) */}
              {editingId !== term.id && (
                <div className="flex shrink-0 items-center gap-1">
                  {/* Search now */}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleTrigger(term.id)}
                    disabled={triggeringId === term.id}
                    title="Search now"
                    className={cn(
                      "text-muted-foreground hover:text-accent",
                      triggeredId === term.id && "text-green-600"
                    )}
                  >
                    {triggeringId === term.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : triggeredId === term.id ? (
                      <Check className="size-3" />
                    ) : (
                      <Search className="size-3" />
                    )}
                  </Button>

                  {/* Edit */}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => startEdit(term)}
                    title="Edit"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3" />
                  </Button>

                  {/* Delete */}
                  {deletingId === term.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(term.id)}
                        title="Confirm delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Check className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeletingId(null)}
                        title="Cancel"
                        className="text-muted-foreground"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setDeletingId(term.id)
                        setEditingId(null)
                      }}
                      title="Delete"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer info */}
      {terms.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {terms.filter((t) => t.active).length} of {terms.length} term
          {terms.length !== 1 ? "s" : ""} active
        </p>
      )}
    </div>
  )
}
