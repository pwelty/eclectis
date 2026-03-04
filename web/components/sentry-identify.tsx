"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export function SentryIdentify({
  userId,
  email,
}: {
  userId: string
  email: string
}) {
  useEffect(() => {
    Sentry.setUser({ id: userId, email })
  }, [userId, email])

  return null
}
