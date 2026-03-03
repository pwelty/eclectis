import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Analytics } from "@vercel/analytics/react"
import { PostHogProvider } from "@/components/posthog-provider"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eclectis.app"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Eclectis — AI content curation for what matters",
    template: "%s — Eclectis",
  },
  description:
    "Eclectis is an AI intelligence layer for personal content curation. Discover, score, and deliver curated articles, podcasts, and newsletters to your existing tools.",
  keywords: [
    "AI RSS reader",
    "curated RSS feed",
    "personalized news feed",
    "AI content curation",
    "content discovery",
    "AI news aggregator",
    "smart RSS feed",
    "content intelligence",
  ],
  authors: [{ name: "Eclectis" }],
  creator: "Eclectis",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Eclectis",
    title: "Eclectis — AI content curation for what matters",
    description:
      "Discover, score, and deliver curated content to your existing tools. AI-powered curation that outputs to RSS, email, podcasts, and read-later apps.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Eclectis — AI content curation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eclectis — AI content curation for what matters",
    description:
      "Discover, score, and deliver curated content to your existing tools. AI-powered curation that outputs to RSS, email, podcasts, and read-later apps.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <PostHogProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Analytics />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
