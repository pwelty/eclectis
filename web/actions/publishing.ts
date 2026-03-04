"use server"

import { createServerClient, getUser } from "@/lib/supabase/server"

export async function getPublishingData() {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { feedHash: null }

  const { data } = await supabase
    .from("newsletter_addresses")
    .select("address")
    .eq("user_id", user.id)
    .single()

  const feedHash = data?.address?.split("@")[0] ?? null

  return { feedHash }
}

export async function getNewsletterAddress(): Promise<string | null> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return null

  const { data } = await supabase
    .from("newsletter_addresses")
    .select("address")
    .eq("user_id", user.id)
    .single()

  return data?.address ?? null
}
