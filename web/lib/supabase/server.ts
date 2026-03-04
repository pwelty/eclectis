import { cache } from "react"
import { createServerClient as createSSRClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — can't set cookies
          }
        },
      },
    }
  )
}

/** Returns the real authenticated user (ignores impersonation). Used for admin checks. */
export const getRealUser = cache(async () => {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/** Returns the effective user — impersonated user if admin is impersonating, otherwise real user. */
export const getUser = cache(async () => {
  const user = await getRealUser()
  if (!user) return user

  // Admin impersonation: if the real user is admin and an impersonation
  // cookie is set, return a synthetic user object with the impersonated ID
  const cookieStore = await cookies()
  const impersonateId = cookieStore.get("x-impersonate-user")?.value
  if (impersonateId && impersonateId !== user.id) {
    const supabase = await createServerClient()
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (profile?.is_admin) {
      return {
        ...user,
        id: impersonateId,
        _realAdminId: user.id,
        _realAdminEmail: user.email,
      } as typeof user & {
        _realAdminId: string
        _realAdminEmail: string | undefined
      }
    }
  }

  return user
})
