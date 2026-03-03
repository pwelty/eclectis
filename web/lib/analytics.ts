import posthog from "posthog-js"

/**
 * Track a PostHog event. No-ops if PostHog is not initialized.
 */
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(event, properties)
  }
}

// ── Auth events ─────────────────────────────────────────────────────────────

export function trackSignup() {
  track("signup")
}

export function trackLogin() {
  track("login")
}

// ── Onboarding events ───────────────────────────────────────────────────────

export function trackOnboardingStep(step: number, stepName: string) {
  track("onboarding_step_completed", { step, step_name: stepName })
}

export function trackOnboardingComplete() {
  track("onboarding_complete")
}

// ── Feed events ─────────────────────────────────────────────────────────────

export function trackFeedAdded(feedType?: string) {
  track("feed_added", { feed_type: feedType })
}

export function trackFeedRemoved() {
  track("feed_removed")
}

// ── Search term events ──────────────────────────────────────────────────────

export function trackSearchTermAdded() {
  track("search_term_added")
}

export function trackSearchTermRemoved() {
  track("search_term_removed")
}

// ── Article events ──────────────────────────────────────────────────────────

export function trackArticleViewed(articleId: string) {
  track("article_viewed", { article_id: articleId })
}

export function trackArticleVoted(articleId: string, direction: string) {
  track("article_voted", { article_id: articleId, direction })
}

// ── Publishing events ───────────────────────────────────────────────────────

export function trackRssFeedUrlCopied() {
  track("rss_feed_url_copied")
}

// ── Briefing events ─────────────────────────────────────────────────────────

export function trackBriefingOpened() {
  track("briefing_opened")
}

// ── Settings events ─────────────────────────────────────────────────────────

export function trackSettingsChanged(setting: string) {
  track("settings_changed", { setting })
}
