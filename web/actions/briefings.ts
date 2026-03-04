"use server"

import { createServerClient, getUser } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Briefing {
  id: string
  sent_at: string | null
  frequency: string
  created_at: string
}

export async function getBriefings(): Promise<{ briefings: Briefing[]; error?: string }> {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { briefings: [], error: "Not authenticated" }

  const { data, error } = await supabase
    .from("briefings")
    .select("id, sent_at, frequency, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { briefings: [], error: error.message }
  return { briefings: (data ?? []) as Briefing[] }
}

export async function triggerBriefing() {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("commands").insert({
    user_id: user.id,
    type: "briefing.generate",
  })

  if (error) return { error: error.message }

  revalidatePath("/briefings")
  return { success: true }
}
