import type { Metadata } from "next"
import { WebsiteJsonLd } from "@/components/json-ld"

export const metadata: Metadata = {
  title: "Eclectis — AI content curation for what matters",
  description:
    "Eclectis is an AI intelligence layer for personal content curation. Discover, score, and deliver curated articles, podcasts, and newsletters to your existing RSS reader, email, or read-later app.",
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <WebsiteJsonLd />
      <h1 className="text-3xl font-semibold tracking-tight">Eclectis</h1>
      <p className="mt-2 text-muted-foreground">Your intelligence layer for the web.</p>
    </main>
  )
}
