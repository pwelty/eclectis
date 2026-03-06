import { describe, expect, it } from "vitest"
import { shouldRedirectAuthenticatedUser } from "../lib/supabase/middleware"

describe("shouldRedirectAuthenticatedUser", () => {
  it("redirects authenticated users away from login and signup", () => {
    expect(shouldRedirectAuthenticatedUser("/login")).toBe(true)
    expect(shouldRedirectAuthenticatedUser("/signup")).toBe(true)
  })

  it("keeps reset-password reachable for recovery flows", () => {
    expect(shouldRedirectAuthenticatedUser("/reset-password")).toBe(false)
  })
})
