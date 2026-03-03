import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/reset-password", "/auth/callback", "/auth/confirm"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // API routes handle their own auth
  if (pathname.startsWith("/api/")) {
    return supabaseResponse
  }

  // Allow public routes without auth
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route)

  // Redirect unauthenticated users to login (except public routes)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = "/login"
    url.searchParams.set("redirectTo", redirectTo)
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = pathname === "/login" || pathname === "/signup" || pathname === "/reset-password"
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/onboarding"
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}
