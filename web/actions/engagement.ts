"use server"

import { createServerClient, getUser } from "@/lib/supabase/server"
import { getPostHogServer } from "@/lib/posthog-server"

export async function trackEvent(
  eventType: string,
  articleId?: string,
  feedId?: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return

  // Write to Supabase (engine feedback loop)
  await supabase.from("engagement_events").insert({
    user_id: user.id,
    article_id: articleId ?? null,
    feed_id: feedId ?? null,
    event_type: eventType,
    metadata: metadata ?? {},
  })

  // Dual-write to PostHog (product analytics)
  const posthog = getPostHogServer()
  if (posthog) {
    posthog.capture({
      distinctId: user.id,
      event: eventType,
      properties: {
        ...(metadata ?? {}),
        article_id: articleId ?? undefined,
        feed_id: feedId ?? undefined,
      },
    })
  }
}

export async function trackClick(articleId: string, feedId?: string, metadata?: Record<string, unknown>) {
  await trackEvent("click", articleId, feedId, metadata)
}
