"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

export function PostHogIdentify({
  userId,
  email,
  name,
  plan,
}: {
  userId: string
  email: string
  name?: string
  plan?: string
}) {
  useEffect(() => {
    if (posthog.__loaded) {
      posthog.identify(userId, {
        email,
        name,
        plan,
      })
    }
  }, [userId, email, name, plan])

  return null
}
