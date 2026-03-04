# Inoreader OPML import — phase 1 design

## Goal

Let users import their Inoreader feed subscriptions into Eclectis via OPML export. Inoreader folders map to feed tags. Works for all Inoreader users (free and paid).

## Phasing

1. **Phase 1 (this)** — OPML import with folder-to-tag mapping, Inoreader-specific UX guidance
2. **Phase 2** — OAuth API: one-click sync + pull article history (paid Inoreader users only)
3. **Phase 3** — Two-way sync: push scores/stars back to Inoreader

## How Inoreader OPML works

Inoreader exports a standard OPML file with one level of folder nesting. Feeds can appear in multiple folders (folders behave like labels/tags). Example:

```xml
<outline text="Business" title="Business">
  <outline text="Tim Ferriss" type="rss" xmlUrl="https://..." />
</outline>
<outline text="Productivity" title="Productivity">
  <outline text="Tim Ferriss" type="rss" xmlUrl="https://..." />
</outline>
```

Tim Ferriss appears in both Business and Productivity. Top-level feeds (no parent folder) have no tags.

## Schema changes

### feeds table

```sql
ALTER TABLE feeds ADD COLUMN tags JSONB NOT NULL DEFAULT '[]';
```

Tags are a flat string array: `["Business", "Productivity"]`.

## Import logic

### URL normalization

Before dedup, normalize URLs:
- Strip protocol (`http://` / `https://`)
- Strip trailing slash
- Lowercase the hostname

This prevents duplicates like `http://slashdot.org/rss` vs `https://slashdot.org/rss`.

### Merge strategy

1. Parse OPML, walk the outline tree
2. For each feed URL, collect all parent folder labels
3. Group by normalized URL — merge tags across folders
4. For each unique feed:
   - Upsert on `(user_id, url)` — skip if URL already exists
   - If inserting: set `tags` from collected folder labels
   - If existing: merge new tags into existing tags (union, no duplicates)

### Edge cases

- **Non-RSS URLs** (e.g., `sanetest@ino.to`, `https://bsky.app`) — skip entries where xmlUrl is not a valid HTTP(S) URL
- **Plan limits** — if import would exceed free plan feed limit, import up to the limit and show warning with count of skipped feeds
- **YouTube feeds** — YouTube channel RSS URLs are valid RSS, import normally
- **Empty folders** — skip outline elements with no xmlUrl children

## UX

### Feeds page — import card

Add an "Import from Inoreader" option to the existing OPML import flow (or as a separate card). Steps shown to user:

1. Open Inoreader > Preferences > Import/Export
2. Click Export to download your OPML file
3. Upload the file here

### After import

- Show count: "Imported X new feeds, Y already existed, Z skipped"
- Auto-trigger `rss.scan` for newly imported feeds
- Feed list shows tags as small badges/chips

## Files to modify

- `supabase/migrations/` — new migration adding `tags` column to feeds
- `web/actions/feeds.ts` — update `importOPML` to extract folder tags, normalize URLs, merge tags
- `web/actions/feeds.ts` — update `Feed` type to include `tags`
- `web/components/feed-list.tsx` — display tags on feed rows
- `web/app/(app)/feeds/page.tsx` or shared import component — Inoreader-specific guidance UX

## What doesn't change

- Same `rss.scan` pipeline for fetching articles after import
- Same `article.add` → `article.score` flow
- No OAuth, no new API routes, no new env vars
- Existing manual feed add and generic OPML import still work as before
