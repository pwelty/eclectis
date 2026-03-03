import { NextResponse } from "next/server"
import { createServerClient, getUser } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for managing the subscription.
 * Returns { url } to redirect the user to.
 */
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const supabase = await createServerClient()
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/settings`,
  })

  return NextResponse.json({ url: session.url })
}
