const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eclectis.app"

export function WebsiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Eclectis",
    url: siteUrl,
    description:
      "AI intelligence layer for personal content curation. Discovers, scores, and delivers curated content to your existing tools.",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    creator: {
      "@type": "Organization",
      name: "Eclectis",
      url: siteUrl,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
