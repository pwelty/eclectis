import { NextRequest, NextResponse } from "next/server"
import { createServerClient, getUser } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for Pro upgrade.
 * Returns { url } to redirect the user to.
 */
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const supabase = await createServerClient()
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id, plan")
    .eq("id", user.id)
    .single()

  if (profile?.plan === "pro") {
    return NextResponse.json({ error: "Already on Pro plan" }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const stripe = getStripe()

  // Reuse existing Stripe customer if available
  const customerParams: Record<string, string> = {}
  if (profile?.stripe_customer_id) {
    customerParams.customer = profile.stripe_customer_id
  } else {
    customerParams.customer_email = user.email!
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...customerParams,
    line_items: [
      {
        price: process.env.STRIPE_PRICE_PRO!,
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
    },
    success_url: `${siteUrl}/settings?billing=success`,
    cancel_url: `${siteUrl}/settings?billing=canceled`,
  })

  return NextResponse.json({ url: session.url })
}
