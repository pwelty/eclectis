// Plan definitions and feature gating for Eclectis free/pro tiers

export type PlanId = "free" | "pro"

export interface PlanLimits {
  maxFeeds: number
  maxSearchTerms: number
  emailBriefings: boolean
  podcastFeed: boolean
  byokRequired: boolean
}

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxFeeds: 10,
    maxSearchTerms: 3,
    emailBriefings: false,
    podcastFeed: false,
    byokRequired: true,
  },
  pro: {
    maxFeeds: Infinity,
    maxSearchTerms: Infinity,
    emailBriefings: true,
    podcastFeed: true,
    byokRequired: false,
  },
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.free
}

export function isPro(plan: string | null | undefined): boolean {
  return plan === "pro"
}
