import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const

function isEmailOtpType(value: string): value is (typeof EMAIL_OTP_TYPES)[number] {
  return EMAIL_OTP_TYPES.includes(value as (typeof EMAIL_OTP_TYPES)[number])
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = searchParams.get("next")

  const fallback = type === "recovery" ? "/reset-password" : "/articles"
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : fallback

  if (!tokenHash || !type || !isEmailOtpType(type)) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`)
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`)
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
