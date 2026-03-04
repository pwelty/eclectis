import type { Metadata } from "next"
import Script from "next/script"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Analytics } from "@vercel/analytics/react"
import { PostHogProvider } from "@/providers/posthog-provider"
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

export const metadata: Metadata = {
  title: {
    default: "Eclectis",
    template: "%s — Eclectis",
  },
  description: "Your intelligence layer for the web.",
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
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-1W8VPRTZ6D" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-1W8VPRTZ6D');
        `}</Script>
      </body>
    </html>
  )
}
