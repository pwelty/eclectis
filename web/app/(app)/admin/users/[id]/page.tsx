"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { getAdminUserDetail, triggerPipeline } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Play, Crown } from "lucide-react"

interface UserDetail {
  profile: {
    id: string
    name: string | null
    plan: string
    is_admin: boolean
    interests: string | null
    apiKeySet: boolean
    created_at: string
    updated_at: string
    stripe_customer_id: string | null
    subscription_status: string | null
    current_period_end: string | null
  }
  email: string
  feeds: { id: string; title: string; url: string; created_at: string }[]
  searchTerms: { id: string; term: string; created_at: string }[]
  recentCommands: { id: string; type: string; status: string; error: string | null; created_at: string; completed_at: string | null }[]
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-medium">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    async function load() {
      const result = await getAdminUserDetail(userId)
      if (!("error" in result)) {
        setData(result as UserDetail)
      }
      setLoading(false)
    }
    load()
  }, [userId])

  async function handleTriggerPipeline() {
    setTriggering(true)
    await triggerPipeline(userId)
    setTriggering(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">User not found.</p>
      </div>
    )
  }

  const { profile, email, feeds, searchTerms, recentCommands } = data

  return (
    <div className="p-8">
      <button
        onClick={() => router.push("/admin/users")}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to users
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {profile.name || "Unnamed user"}
            {profile.is_admin && (
              <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                admin
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={triggering}
          onClick={handleTriggerPipeline}
        >
          {triggering ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Play className="mr-1.5 size-3.5" />}
          Run pipeline
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Profile">
          <DetailRow label="Plan" value={
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              profile.plan === "pro" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {profile.plan === "pro" && <Crown className="size-3" />}
              {profile.plan}
            </span>
          } />
          <DetailRow label="Subscription" value={profile.subscription_status ?? "—"} />
          <DetailRow label="Stripe customer" value={profile.stripe_customer_id ? "Yes" : "No"} />
          <DetailRow label="API key" value={profile.apiKeySet ? "Set" : "Not set"} />
          <DetailRow label="Signed up" value={new Date(profile.created_at).toLocaleDateString()} />
          <DetailRow label="Last updated" value={new Date(profile.updated_at).toLocaleDateString()} />
        </Section>

        <Section title="Interests">
          <p className="text-sm whitespace-pre-wrap">{profile.interests || "None set"}</p>
        </Section>

        <Section title={`Feeds (${feeds.length})`}>
          {feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feeds</p>
          ) : (
            <ul className="space-y-1.5">
              {feeds.map((f) => (
                <li key={f.id} className="text-sm">
                  <span className="font-medium">{f.title || f.url}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Search terms (${searchTerms.length})`}>
          {searchTerms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No search terms</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {searchTerms.map((s) => (
                <span key={s.id} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {s.term}
                </span>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recent commands">
          {recentCommands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commands</p>
          ) : (
            <div className="space-y-1.5">
              {recentCommands.map((cmd) => (
                <div key={cmd.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "size-2 rounded-full",
                      cmd.status === "completed" && "bg-green-500",
                      cmd.status === "failed" && "bg-red-500",
                      cmd.status === "processing" && "bg-amber-500",
                      cmd.status === "pending" && "bg-muted-foreground",
                    )} />
                    <span className="font-mono text-xs">{cmd.type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(cmd.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
