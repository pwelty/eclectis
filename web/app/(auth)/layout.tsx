import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Eclectis to access your AI-curated content feeds.",
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Eclectis</h1>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
