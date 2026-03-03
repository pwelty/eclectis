import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eclectis.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/articles", "/feeds", "/settings", "/onboarding", "/dashboard", "/publishing", "/search-terms"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
