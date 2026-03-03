"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  getSettings,
  updateInterests,
  saveApiKey,
  removeApiKey,
  updateBriefingPreferences,
  updatePassword,
} from "@/actions/settings"
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Key,
  Mail,
  Sparkles,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { trackSettingsChanged } from "@/lib/analytics"

// ── Types ──────────────────────────────────────────────────────────────────

interface SettingsData {
  profile: {
    interests?: string
    api_key?: string | null
    preferences?: {
      briefing_frequency?: string
      briefing_send_hour?: number
    }
  } | null
  newsletterAddress: { address?: string } | null
  email?: string
}

// ── Main settings page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getSettings()
      setData(result as SettingsData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data?.profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Unable to load settings.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your preferences, API keys, and delivery settings
      </p>

      <div className="mt-8 space-y-10">
        <InterestsSection interests={data.profile.interests ?? ""} />
        <ApiKeySection hasKey={!!data.profile.api_key} />
        <BriefingSection
          frequency={data.profile.preferences?.briefing_frequency ?? "daily"}
          sendHour={data.profile.preferences?.briefing_send_hour ?? 7}
        />
        <NewsletterSection address={data.newsletterAddress?.address ?? ""} />
        <AccountSection email={data.email ?? ""} />
      </div>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="ml-12">{children}</div>
    </section>
  )
}

// ── Interests section ──────────────────────────────────────────────────────

function InterestsSection({ interests: initial }: { interests: string }) {
  const [interests, setInterests] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    const formData = new FormData()
    formData.set("interests", interests)
    const result = await updateInterests(formData)
    setSaving(false)
    if (result.success) {
      trackSettingsChanged("interests")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [interests])

  return (
    <Section
      icon={Sparkles}
      title="Interests"
      description="What you care about. This guides how we score and filter content."
    >
      <Textarea
        value={interests}
        onChange={(e) => setInterests(e.target.value)}
        placeholder="e.g. AI/ML research, distributed systems, TypeScript ecosystem..."
        rows={4}
        className="resize-none"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || interests === initial}
          size="sm"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </div>
    </Section>
  )
}

// ── API key section ────────────────────────────────────────────────────────

function ApiKeySection({ hasKey: initialHasKey }: { hasKey: boolean }) {
  const [hasKey, setHasKey] = useState(initialHasKey)
  const [keyInput, setKeyInput] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = useCallback(async () => {
    if (!keyInput.trim()) return
    setSaving(true)
    setError(null)
    const formData = new FormData()
    formData.set("api_key", keyInput)
    const result = await saveApiKey(formData)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setHasKey(true)
      setKeyInput("")
      trackSettingsChanged("api_key")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [keyInput])

  const handleRemove = useCallback(async () => {
    const result = await removeApiKey()
    if (!result.error) {
      setHasKey(false)
      setKeyInput("")
    }
  }, [])

  return (
    <Section
      icon={Key}
      title="API key"
      description="Bring your own Anthropic API key for the free tier. Pro subscribers use our keys."
    >
      {hasKey ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3">
            <Key className="size-4 text-green-600" />
            <span className="text-sm text-foreground">API key configured</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleRemove}
              className="ml-auto text-muted-foreground hover:text-destructive"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !keyInput.trim()}
              size="sm"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="size-3.5" /> Key saved
            </span>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Briefing section ───────────────────────────────────────────────────────

function BriefingSection({
  frequency: initialFrequency,
  sendHour: initialSendHour,
}: {
  frequency: string
  sendHour: number
}) {
  const [frequency, setFrequency] = useState(initialFrequency)
  const [sendHour, setSendHour] = useState(initialSendHour)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasChanges = frequency !== initialFrequency || sendHour !== initialSendHour

  const handleSave = useCallback(async () => {
    setSaving(true)
    const formData = new FormData()
    formData.set("frequency", frequency)
    formData.set("send_hour", String(sendHour))
    const result = await updateBriefingPreferences(formData)
    setSaving(false)
    if (result.success) {
      trackSettingsChanged("briefing_preferences")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [frequency, sendHour])

  return (
    <Section
      icon={Clock}
      title="Email briefings"
      description="Receive a curated digest of your top content."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Frequency</Label>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["daily", "weekly", "off"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                  frequency === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {frequency !== "off" && (
          <div className="space-y-2">
            <Label className="text-sm">Send time</Label>
            <select
              value={sendHour}
              onChange={(e) => setSendHour(parseInt(e.target.value, 10))}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0
                    ? "12:00 AM"
                    : i < 12
                      ? `${i}:00 AM`
                      : i === 12
                        ? "12:00 PM"
                        : `${i - 12}:00 PM`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            size="sm"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="size-3.5" /> Saved
            </span>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Newsletter section ─────────────────────────────────────────────────────

function NewsletterSection({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [address])

  return (
    <Section
      icon={Mail}
      title="Newsletter address"
      description="Forward newsletters to this address to include them in your feed."
    >
      {address ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3">
          <code className="flex-1 truncate font-mono text-sm text-foreground">
            {address}
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
          No newsletter address configured.
        </p>
      )}
    </Section>
  )
}

// ── Account section ────────────────────────────────────────────────────────

function AccountSection({ email }: { email: string }) {
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

  const handleChangePassword = useCallback(async () => {
    setSaving(true)
    setResult(null)
    const formData = new FormData()
    formData.set("new_password", newPassword)
    const res = await updatePassword(formData)
    setSaving(false)
    setResult(res)
    if (res.success) setNewPassword("")
  }, [newPassword])

  return (
    <Section
      icon={AlertTriangle}
      title="Account"
      description="Manage your email and password."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Email</Label>
          <Input value={email} disabled className="opacity-60" />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">New password</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              autoComplete="new-password"
            />
            <Button
              onClick={handleChangePassword}
              disabled={saving || newPassword.length < 8}
              size="sm"
            >
              {saving ? "Updating..." : "Update"}
            </Button>
          </div>
          {result?.error && (
            <p className="text-sm text-destructive">{result.error}</p>
          )}
          {result?.success && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="size-3.5" /> Password updated
            </span>
          )}
        </div>
      </div>
    </Section>
  )
}
