"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { resetPassword } from "@/actions/auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <p className="text-center text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetPasswordInner() {
  const [hasSession, setHasSession] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setHasSession(!!user)
      setLoading(false)
    }
    check()
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-center text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return hasSession ? <UpdatePasswordForm /> : <RequestResetForm />
}

function RequestResetForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    const result = await resetPassword(formData)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.success as string)
    }
    setLoading(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const password = formData.get("password") as string
    const confirm = formData.get("confirm_password") as string

    if (password !== confirm) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    const supabase = getSupabaseBrowserClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Password updated
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your password has been changed successfully.
        </p>
        <Button asChild className="mt-6">
          <Link href="/articles">Continue</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Set new password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a new password for your account
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  )
}
