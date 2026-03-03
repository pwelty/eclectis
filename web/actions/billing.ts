"use server"

import { createServerClient, getUser } from "@/lib/supabase/server"
import { getPlanLimits, type PlanId } from "@/lib/plans"

export interface BillingInfo {
  plan: PlanId
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
  limits: ReturnType<typeof getPlanLimits>
}

export async function getBillingInfo(): Promise<BillingInfo | null> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan, subscription_status, current_period_end, stripe_customer_id")
    .eq("id", user.id)
    .single()

  const plan = (profile?.plan ?? "free") as PlanId

  return {
    plan,
    subscriptionStatus: profile?.subscription_status ?? null,
    currentPeriodEnd: profile?.current_period_end ?? null,
    hasStripeCustomer: !!profile?.stripe_customer_id,
    limits: getPlanLimits(plan),
  }
}
