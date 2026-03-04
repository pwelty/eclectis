const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid",
])

export function normalizeUrl(url: string): string {
  if (!url || typeof url !== "string") return url ?? ""
  url = url.trim()
  if (!url) return ""

  // Upgrade http to https
  if (url.startsWith("http://")) {
    url = "https://" + url.slice(7)
  }

  try {
    const parsed = new URL(url)
    parsed.hostname = parsed.hostname.toLowerCase()

    // Strip tracking params
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key)
      }
    }

    // Remove trailing slashes from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/"

    // Rebuild without trailing slash on root path
    let result = parsed.origin + parsed.pathname
    if (result.endsWith("/") && parsed.pathname === "/") {
      result = result.slice(0, -1)
    }
    const qs = parsed.searchParams.toString()
    if (qs) result += "?" + qs
    if (parsed.hash) result += parsed.hash

    return result
  } catch {
    return url.toLowerCase().replace(/\/+$/, "")
  }
}
