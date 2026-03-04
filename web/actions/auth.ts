"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"

export async function signIn(formData: FormData) {
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  })

  if (error) {
    return { error: error.message }
  }

  const redirectTo = (formData.get("redirectTo") as string) || "/articles"
  const safePath = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/articles"

  revalidatePath("/", "layout")
  redirect(safePath)
}

export async function signUp(formData: FormData) {
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        name: formData.get("name") as string,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/onboarding")
}

export async function signOut() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function signInWithGoogle() {
  const supabase = await createServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }

  return { error: "Failed to initiate Google sign-in" }
}

export async function resetPassword(formData: FormData) {
  const supabase = await createServerClient()

  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.get("email") as string,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/auth/confirm?type=recovery&next=/reset-password` }
  )

  if (error) {
    return { error: error.message }
  }

  return { success: "Check your email for a password reset link." }
}
