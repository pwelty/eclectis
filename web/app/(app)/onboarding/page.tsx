"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  saveInterests,
  addFeed,
  removeFeed,
  addSearchTerm,
  removeSearchTerm,
  getOnboardingData,
  completeOnboarding,
} from "@/actions/onboarding"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Copy,
  Check,
  Upload,
  Rss,
  Search,
  Mail,
  Sparkles,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

interface Feed {
  id: string
  name: string
  url: string
}

interface SearchTermItem {
  id: string
  term: string
}

interface OnboardingData {
  profile: { interests?: string } | null
  feeds: Feed[]
  searchTerms: SearchTermItem[]
  newsletterAddress: { address?: string } | null
}

// ── Step definitions ───────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Interests", icon: Sparkles },
  { number: 2, label: "Feeds", icon: Rss },
  { number: 3, label: "Discovery", icon: Search },
  { number: 4, label: "Newsletters", icon: Mail },
] as const

// ── Main page component ────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)

  // Step 1 state
  const [interests, setInterests] = useState("")
  const [interestsSaved, setInterestsSaved] = useState(false)

  // Step 2 state
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [feedUrl, setFeedUrl] = useState("")
  const [feedError, setFeedError] = useState<string | null>(null)
  const [addingFeed, setAddingFeed] = useState(false)

  // Step 3 state
  const [searchTerms, setSearchTerms] = useState<SearchTermItem[]>([])
  const [termInput, setTermInput] = useState("")
  const [termError, setTermError] = useState<string | null>(null)
  const [addingTerm, setAddingTerm] = useState(false)

  // Step 4 state
  const [newsletterAddress, setNewsletterAddress] = useState("")
  const [copied, setCopied] = useState(false)
  const [completing, setCompleting] = useState(false)

  // ── Load existing data on mount ────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const data = (await getOnboardingData()) as OnboardingData
        if (data.profile?.interests) setInterests(data.profile.interests)
        if (data.feeds) setFeeds(data.feeds)
        if (data.searchTerms) setSearchTerms(data.searchTerms)
        if (data.newsletterAddress?.address) {
          setNewsletterAddress(data.newsletterAddress.address)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Step 1: Save interests ─────────────────────────────────────────────

  const handleSaveInterests = useCallback(async () => {
    if (!interests.trim()) return
    const formData = new FormData()
    formData.set("interests", interests)
    const result = await saveInterests(formData)
    if (result.success) {
      setInterestsSaved(true)
      setTimeout(() => setInterestsSaved(false), 2000)
    }
  }, [interests])

  // ── Step 2: Feed management ────────────────────────────────────────────

  const handleAddFeed = useCallback(async () => {
    if (!feedUrl.trim()) return
    setAddingFeed(true)
    setFeedError(null)
    const formData = new FormData()
    formData.set("url", feedUrl)
    formData.set("name", feedUrl)
    const result = await addFeed(formData)
    if (result.error) {
      setFeedError(result.error)
    } else if (result.feed) {
      setFeeds((prev) => [...prev, result.feed as Feed])
      setFeedUrl("")
    }
    setAddingFeed(false)
  }, [feedUrl])

  const handleRemoveFeed = useCallback(async (feedId: string) => {
    const result = await removeFeed(feedId)
    if (!result.error) {
      setFeeds((prev) => prev.filter((f) => f.id !== feedId))
    }
  }, [])

  const handleImportOPML = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const text = await file.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, "text/xml")
      const outlines = doc.querySelectorAll("outline[xmlUrl]")

      setFeedError(null)
      let errorCount = 0

      for (const outline of Array.from(outlines)) {
        const xmlUrl = outline.getAttribute("xmlUrl")
        const name =
          outline.getAttribute("title") ||
          outline.getAttribute("text") ||
          xmlUrl
        if (!xmlUrl) continue

        const formData = new FormData()
        formData.set("url", xmlUrl)
        formData.set("name", name || xmlUrl)
        const result = await addFeed(formData)
        if (result.feed) {
          setFeeds((prev) => {
            if (prev.some((f) => f.id === (result.feed as Feed).id)) return prev
            return [...prev, result.feed as Feed]
          })
        } else {
          errorCount++
        }
      }

      if (errorCount > 0) {
        setFeedError(`Failed to import ${errorCount} feed(s)`)
      }

      // Reset file input
      e.target.value = ""
    },
    []
  )

  // ── Step 3: Search term management ─────────────────────────────────────

  const handleAddTerm = useCallback(async () => {
    if (!termInput.trim()) return
    setAddingTerm(true)
    setTermError(null)
    const formData = new FormData()
    formData.set("term", termInput)
    const result = await addSearchTerm(formData)
    if (result.error) {
      setTermError(result.error)
    } else if (result.term) {
      setSearchTerms((prev) => [...prev, result.term as SearchTermItem])
      setTermInput("")
    }
    setAddingTerm(false)
  }, [termInput])

  const handleRemoveTerm = useCallback(async (termId: string) => {
    const result = await removeSearchTerm(termId)
    if (!result.error) {
      setSearchTerms((prev) => prev.filter((t) => t.id !== termId))
    }
  }, [])

  // ── Step 4: Copy + complete ────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!newsletterAddress) return
    await navigator.clipboard.writeText(newsletterAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [newsletterAddress])

  const handleComplete = useCallback(async () => {
    setCompleting(true)
    await completeOnboarding()
    // completeOnboarding redirects, so we only reach here on error
    setCompleting(false)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────

  const handleNext = useCallback(async () => {
    // Auto-save on step transitions
    if (step === 1 && interests.trim()) {
      await handleSaveInterests()
    }
    setStep((s) => Math.min(s + 1, 4))
  }, [step, interests, handleSaveInterests])

  const handleSkip = useCallback(async () => {
    // Also auto-save interests if skipping step 1
    if (step === 1 && interests.trim()) {
      await handleSaveInterests()
    }
    setStep((s) => Math.min(s + 1, 4))
  }, [step, interests, handleSaveInterests])

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1))
  }, [])

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Eclectis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your intelligence layer
          </p>
        </div>

        {/* Stepper */}
        <Stepper currentStep={step} />

        {/* Step content */}
        <div className="mt-8">
          {step === 1 && (
            <StepInterests
              interests={interests}
              setInterests={setInterests}
              saved={interestsSaved}
            />
          )}
          {step === 2 && (
            <StepFeeds
              feeds={feeds}
              feedUrl={feedUrl}
              setFeedUrl={setFeedUrl}
              feedError={feedError}
              addingFeed={addingFeed}
              onAddFeed={handleAddFeed}
              onRemoveFeed={handleRemoveFeed}
              onImportOPML={handleImportOPML}
            />
          )}
          {step === 3 && (
            <StepSearchTerms
              searchTerms={searchTerms}
              termInput={termInput}
              setTermInput={setTermInput}
              termError={termError}
              addingTerm={addingTerm}
              onAddTerm={handleAddTerm}
              onRemoveTerm={handleRemoveTerm}
            />
          )}
          {step === 4 && (
            <StepNewsletter
              newsletterAddress={newsletterAddress}
              copied={copied}
              onCopy={handleCopy}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="size-4" />
                Back
              </Button>
            )}
          </div>

          <div>
            {step < 4 && (
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                Skip
              </Button>
            )}
          </div>

          <div>
            {step < 4 ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={completing} size="lg">
                {completing ? "Starting..." : "Start discovering"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stepper component ──────────────────────────────────────────────────────

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {STEPS.map((s, i) => {
        const isActive = s.number === currentStep
        const isCompleted = s.number < currentStep
        const Icon = s.icon

        return (
          <div key={s.number} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isActive &&
                    "border-primary bg-primary text-primary-foreground",
                  isCompleted &&
                    "border-primary bg-primary/10 text-primary",
                  !isActive &&
                    !isCompleted &&
                    "border-border text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive && "text-foreground",
                  !isActive && "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mb-5 h-px w-8 sm:w-12",
                  s.number < currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Interests ──────────────────────────────────────────────────────

function StepInterests({
  interests,
  setInterests,
  saved,
}: {
  interests: string
  setInterests: (v: string) => void
  saved: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          What are you interested in?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe topics, themes, and areas you want to explore. Be specific
          &mdash; this helps us score and filter content for you.
        </p>
      </div>

      <Textarea
        value={interests}
        onChange={(e) => setInterests(e.target.value)}
        placeholder="e.g. AI/ML research, distributed systems, TypeScript ecosystem, startup strategy..."
        rows={6}
        className="resize-none"
      />

      {saved && (
        <div className="flex items-center gap-1.5 text-sm text-green-600">
          <Check className="size-3.5" />
          Saved
        </div>
      )}
    </div>
  )
}

// ── Step 2: Feeds ──────────────────────────────────────────────────────────

function StepFeeds({
  feeds,
  feedUrl,
  setFeedUrl,
  feedError,
  addingFeed,
  onAddFeed,
  onRemoveFeed,
  onImportOPML,
}: {
  feeds: Feed[]
  feedUrl: string
  setFeedUrl: (v: string) => void
  feedError: string | null
  addingFeed: boolean
  onAddFeed: () => void
  onRemoveFeed: (id: string) => void
  onImportOPML: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Add your feeds
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste RSS or podcast feed URLs. We&apos;ll scan them for content that
          matches your interests.
        </p>
      </div>

      {/* Add feed input */}
      <div className="flex gap-2">
        <Input
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="https://example.com/feed.xml"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAddFeed()
            }
          }}
        />
        <Button onClick={onAddFeed} disabled={addingFeed || !feedUrl.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {/* OPML import */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".opml,.xml"
          className="hidden"
          onChange={onImportOPML}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          Import OPML
        </Button>
      </div>

      {/* Error */}
      {feedError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {feedError}
        </div>
      )}

      {/* Feed list */}
      {feeds.length > 0 && (
        <div className="space-y-2">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              className="flex items-center justify-between rounded-md border border-border bg-secondary/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {feed.name}
                </p>
                {feed.name !== feed.url && (
                  <p className="truncate text-xs text-muted-foreground">
                    {feed.url}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemoveFeed(feed.id)}
                className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step 3: Search terms ───────────────────────────────────────────────────

function StepSearchTerms({
  searchTerms,
  termInput,
  setTermInput,
  termError,
  addingTerm,
  onAddTerm,
  onRemoveTerm,
}: {
  searchTerms: SearchTermItem[]
  termInput: string
  setTermInput: (v: string) => void
  termError: string | null
  addingTerm: boolean
  onAddTerm: () => void
  onRemoveTerm: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Set up discovery
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter search terms for Google-based content discovery. We&apos;ll find
          fresh articles matching these terms.
        </p>
      </div>

      {/* Add term input */}
      <div className="flex gap-2">
        <Input
          value={termInput}
          onChange={(e) => setTermInput(e.target.value)}
          placeholder="e.g. Claude API best practices"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAddTerm()
            }
          }}
        />
        <Button onClick={onAddTerm} disabled={addingTerm || !termInput.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {/* Error */}
      {termError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {termError}
        </div>
      )}

      {/* Term chips */}
      {searchTerms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchTerms.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
            >
              {t.term}
              <button
                onClick={() => onRemoveTerm(t.id)}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step 4: Newsletter ─────────────────────────────────────────────────────

function StepNewsletter({
  newsletterAddress,
  copied,
  onCopy,
}: {
  newsletterAddress: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Forward your newsletters
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send newsletters to this address. We&apos;ll process them and add to
          your feed.
        </p>
      </div>

      {/* Newsletter address box */}
      {newsletterAddress ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3">
          <code className="flex-1 truncate font-mono text-sm text-foreground">
            {newsletterAddress}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
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
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No newsletter address configured yet. You can set this up later in
          settings.
        </div>
      )}
    </div>
  )
}
