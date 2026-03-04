import { describe, it, expect } from "vitest"
import { normalizeUrl } from "../lib/normalize-url"

describe("normalizeUrl", () => {
  it("upgrades http to https", () => {
    expect(normalizeUrl("http://example.com/feed")).toBe("https://example.com/feed")
  })

  it("keeps existing https", () => {
    expect(normalizeUrl("https://example.com/feed")).toBe("https://example.com/feed")
  })

  it("lowercases hostname", () => {
    expect(normalizeUrl("https://Example.COM/Feed")).toBe("https://example.com/Feed")
  })

  it("strips utm_* tracking params", () => {
    expect(normalizeUrl("https://example.com/page?utm_source=rss&utm_medium=feed&id=5"))
      .toBe("https://example.com/page?id=5")
  })

  it("strips fbclid and gclid", () => {
    expect(normalizeUrl("https://example.com/page?fbclid=abc&gclid=def"))
      .toBe("https://example.com/page")
  })

  it("preserves legitimate query params", () => {
    expect(normalizeUrl("https://example.com/search?q=test&page=2"))
      .toBe("https://example.com/search?q=test&page=2")
  })

  it("removes trailing slashes", () => {
    expect(normalizeUrl("https://example.com/feed/")).toBe("https://example.com/feed")
  })

  it("handles root URL trailing slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com")
  })

  it("handles full normalization: http + uppercase + tracking + trailing slash", () => {
    expect(normalizeUrl("http://Example.COM/feed/?utm_source=rss"))
      .toBe("https://example.com/feed")
  })

  it("returns empty string for empty input", () => {
    expect(normalizeUrl("")).toBe("")
  })

  it("returns empty string for whitespace", () => {
    expect(normalizeUrl("  ")).toBe("")
  })

  it("handles null-ish input gracefully", () => {
    expect(normalizeUrl(null as unknown as string)).toBe("")
    expect(normalizeUrl(undefined as unknown as string)).toBe("")
  })

  it("handles malformed URLs by lowercasing", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url")
  })

  it("preserves hash fragments", () => {
    expect(normalizeUrl("https://example.com/page#section"))
      .toBe("https://example.com/page#section")
  })

  it("strips all utm variants at once", () => {
    const url = "https://example.com/p?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e&keep=1"
    expect(normalizeUrl(url)).toBe("https://example.com/p?keep=1")
  })
})
