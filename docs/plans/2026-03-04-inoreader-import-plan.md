# Inoreader OPML import — implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import Inoreader OPML subscriptions into Eclectis with folder-to-tag mapping and URL dedup.

**Architecture:** Extend existing OPML import to parse folder hierarchy into feed tags. Add `tags JSONB` column to feeds table. Rewrite OPML parser to walk the outline tree (folder-aware) instead of flat regex. Show tags as chips in feed list UI.

**Tech Stack:** Next.js, Supabase, TypeScript, Tailwind CSS

**Design doc:** `docs/plans/2026-03-04-inoreader-import-design.md`

---

### Task 1: Add tags column to feeds table

**Files:**
- Create: `supabase/migrations/20260304100001_add_feed_tags.sql`

**Step 1: Write the migration**

```sql
-- Add tags to feeds for folder/category labeling
ALTER TABLE feeds ADD COLUMN tags JSONB NOT NULL DEFAULT '[]';
CREATE INDEX idx_feeds_tags ON feeds USING gin(tags);
```

**Step 2: Apply the migration**

Run: `cd supabase && supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```
git add supabase/migrations/20260304100001_add_feed_tags.sql
git commit -m "feat: add tags column to feeds table"
```

---

### Task 2: Update Feed type and add OPML parser utility

**Files:**
- Modify: `web/actions/feeds.ts` — add `tags` to `Feed` type, add `parseOPML` and `normalizeUrl` helpers, update `importOPML`

**Step 1: Add `tags` to the Feed interface**

In `web/actions/feeds.ts`, add `tags` field:

```typescript
export interface Feed {
  // ...existing fields...
  tags?: string[]
}
```

**Step 2: Add URL normalization helper**

Add above the `importOPML` function:

```typescript
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return (parsed.hostname.toLowerCase() + parsed.pathname + parsed.search)
      .replace(/\/+$/, "")
  } catch {
    return url.toLowerCase().replace(/\/+$/, "")
  }
}
```

**Step 3: Add `tags` to OPMLFeed and write `parseOPML` function**

Update `OPMLFeed` to include `tags: string[]`.

Write `parseOPML(opmlText: string): OPMLFeed[]` that:
- Uses a `Map<normalizedUrl, OPMLFeed>` for dedup
- Extracts folder blocks via regex: `<outline text="FolderName">...children...</outline>`
- For each leaf outline with `xmlUrl`: normalizes URL, merges tags if already seen
- Skips non-HTTP URLs (email addresses like `sanetest@ino.to`)
- Second pass: extract top-level feeds (not inside folders) with empty tags
- Returns `Array.from(feedMap.values())`

**Step 4: Update `importOPML` to use `parseOPML`**

Replace the regex parsing with `const feeds = parseOPML(opmlText)`.
Update the upsert to include `tags: feed.tags` in the insert payload.

**Step 5: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```
git add web/actions/feeds.ts
git commit -m "feat: folder-aware OPML parser with URL normalization and tag merging"
```

---

### Task 3: Display tags in feed list

**Files:**
- Modify: `web/components/feed-list.tsx` — show tag chips after feed name

**Step 1: Add tag chips to FeedRow**

After the feed name Link and before the URL paragraph, add:

```tsx
{feed.tags && feed.tags.length > 0 && (
  <div className="mt-0.5 flex flex-wrap gap-1">
    {feed.tags.map((tag: string) => (
      <span
        key={tag}
        className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0 text-[10px] text-muted-foreground"
      >
        {tag}
      </span>
    ))}
  </div>
)}
```

**Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```
git add web/components/feed-list.tsx
git commit -m "feat: display feed tags as chips in feed list"
```

---

### Task 4: Enable OPML import on newsletters page + Inoreader guidance

**Files:**
- Modify: `web/app/(app)/newsletters/page.tsx` — add `showOPML` prop
- Modify: `web/app/(app)/feeds/page.tsx` — update description to mention Inoreader

**Step 1: Add showOPML to newsletters page**

```tsx
<FeedList
  feedType="newsletter"
  title="Newsletters"
  description="Forward newsletters to your Eclectis address to automatically extract and score articles."
  showOPML
  showScanAll={false}
/>
```

**Step 2: Update feeds page description**

```tsx
description="Add feeds manually or import from Inoreader (export OPML from Preferences > Import/Export)."
```

**Step 3: Commit**

```
git add web/app/(app)/newsletters/page.tsx web/app/(app)/feeds/page.tsx
git commit -m "feat: enable OPML import on newsletters page, add Inoreader guidance"
```

---

### Task 5: Show tags on newsletter detail page

**Files:**
- Modify: `web/app/(app)/newsletters/[id]/page.tsx` — display tags in header

**Step 1: Add tag chips after the metadata row**

```tsx
{feed.tags && feed.tags.length > 0 && (
  <div className="mt-2 flex flex-wrap gap-1">
    {feed.tags.map((tag: string) => (
      <span
        key={tag}
        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
      >
        {tag}
      </span>
    ))}
  </div>
)}
```

**Step 2: Commit**

```
git add web/app/(app)/newsletters/[id]/page.tsx
git commit -m "feat: show feed tags on newsletter detail page"
```

---

### Task 6: Manual test with real Inoreader OPML

**Step 1: Start dev server if not running**

Dev server should be on port 3001.

**Step 2: Test OPML import**

1. Open `http://localhost:3001/feeds` in Chrome
2. Click "Import OPML"
3. Select `/Users/paul/Downloads/Inoreader Feeds 20260304.xml`
4. Verify: success message shows count of imported feeds
5. Verify: feeds appear in list with tag chips (Recipes, News, AI, etc.)
6. Verify: duplicate URLs (http vs https) were deduplicated
7. Verify: non-RSS URLs (`sanetest@ino.to`) were skipped

**Step 3: Verify detail page tags**

Click a feed from the Recipes folder. Confirm detail page loads and shows tag chip.

**Step 4: Check browser console**

Press Cmd+Option+J — no red errors.

**Step 5: Commit any fixes discovered during testing**
