import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

/** Get current_period_end from the first subscription item. */
function getPeriodEnd(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items?.data?.[0]
  if (!firstItem) return null
  return new Date(firstItem.current_period_end * 1000).toISOString()
}

/** Resolve plan from subscription price ID. */
function resolvePlan(subscription: Stripe.Subscription): string | null {
  const priceId = subscription.items?.data?.[0]?.price?.id
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro"
  return null
}

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Stripe webhook signature verification failed:", message)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      if (!userId) break

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id

      let currentPeriodEnd: string | null = null
      let subscriptionStatus = "active"
      let plan = "pro"

      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
          expand: ["items"],
        })
        currentPeriodEnd = getPeriodEnd(subscription)
        plan = resolvePlan(subscription) ?? "pro"
        subscriptionStatus = subscription.status
      }

      await supabase
        .from("user_profiles")
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId ?? null,
          subscription_status: subscriptionStatus,
          plan,
          current_period_end: currentPeriodEnd,
        })
        .eq("id", userId)

      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle()

      if (!profile) break

      const isActive = ["active", "trialing"].includes(subscription.status)
      const resolvedPlan = isActive ? (resolvePlan(subscription) ?? "pro") : "free"

      await supabase
        .from("user_profiles")
        .update({
          subscription_status: subscription.status,
          plan: resolvedPlan,
          current_period_end: getPeriodEnd(subscription),
        })
        .eq("id", profile.id)

      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle()

      if (!profile) break

      await supabase
        .from("user_profiles")
        .update({
          subscription_status: "canceled",
          plan: "free",
          stripe_subscription_id: null,
          current_period_end: null,
        })
        .eq("id", profile.id)

      break
    }
  }

  return NextResponse.json({ received: true })
}
