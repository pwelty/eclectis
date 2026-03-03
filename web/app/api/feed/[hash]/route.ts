import { createAdminClient } from "@/lib/supabase/admin"

// ── XML helpers ──────────────────────────────────────────────────────────

/** Escape special XML characters to prevent XSS / malformed output. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Convert an ISO date string to RFC 2822 format for RSS pubDate. */
function toRfc2822(iso: string): string {
  return new Date(iso).toUTCString()
}

// ── Types ────────────────────────────────────────────────────────────────

interface Article {
  title: string
  url: string
  summary: string | null
  ai_score: number | null
  source: string
  published_at: string | null
  found_at: string
}

// ── Route handler ────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash: rawHash } = await params

  // Strip optional .xml extension so both /feed/abc123 and /feed/abc123.xml work
  const hash = rawHash.replace(/\.xml$/, "")

  // Validate: must be 8+ hex chars (newsletter hashes are 12-char MD5 substrings)
  if (!hash || !/^[a-f0-9]{8,}$/.test(hash)) {
    return new Response("Not found", { status: 404 })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return new Response("Server configuration error", { status: 500 })
  }

  // ── Look up user by newsletter address hash ────────────────────────────

  const { data: addrRow, error: addrError } = await supabase
    .from("newsletter_addresses")
    .select("user_id")
    .like("address", `${hash}@%`)
    .maybeSingle()

  if (addrError) {
    console.error("RSS feed — address lookup error:", addrError.message)
    return new Response("Internal server error", { status: 500 })
  }

  if (!addrRow) {
    return new Response("Not found", { status: 404 })
  }

  const userId = addrRow.user_id

  // ── Fetch top articles from the last 7 days ───────────────────────────

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("title, url, summary, ai_score, source, published_at, found_at")
    .eq("user_id", userId)
    .gte("ai_score", 5)
    .gte("found_at", sevenDaysAgo)
    .order("ai_score", { ascending: false })
    .limit(50)

  if (articlesError) {
    console.error("RSS feed — articles query error:", articlesError.message)
    return new Response("Internal server error", { status: 500 })
  }

  // ── Build RSS 2.0 XML ─────────────────────────────────────────────────

  const items = (articles as Article[])
    .map((a) => {
      const pubDate = a.published_at || a.found_at
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.url)}</link>
      <description>${escapeXml(a.summary ?? "")}</description>
      <pubDate>${toRfc2822(pubDate)}</pubDate>
      <source>${escapeXml(a.source)}</source>
      <guid isPermaLink="true">${escapeXml(a.url)}</guid>
    </item>`
    })
    .join("\n")

  const lastBuildDate = toRfc2822(new Date().toISOString())

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Eclectis — Your curated feed</title>
    <link>https://eclectis.io</link>
    <description>AI-curated content matching your interests</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
