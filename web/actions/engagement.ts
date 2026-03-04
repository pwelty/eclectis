"use server"

import { createServerClient, getUser } from "@/lib/supabase/server"

export async function trackEvent(
  eventType: string,
  articleId?: string,
  feedId?: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return

  await supabase.from("engagement_events").insert({
    user_id: user.id,
    article_id: articleId ?? null,
    feed_id: feedId ?? null,
    event_type: eventType,
    metadata: metadata ?? {},
  })
}

export async function trackClick(articleId: string, feedId?: string, metadata?: Record<string, unknown>) {
  await trackEvent("click", articleId, feedId, metadata)
}
