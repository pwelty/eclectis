# Engagement telemetry implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the feedback loop so user engagement signals improve AI article scoring over time.

**Architecture:** New `engagement_events` table captures discrete user actions (clicks, votes, bookmarks, reads, feed changes). A `user.learn` engine handler runs on the user's briefing cadence, analyzes accumulated signals, and writes a `learned_preferences` text field on the user profile. The scoring handler includes this field in its prompt alongside user-written interests.

**Tech Stack:** Supabase (PostgreSQL migration), Python engine handler, Next.js server actions, TypeScript

---

### Task 1: Database migration — engagement_events table + learned_preferences column

**Files:**
- Create: `supabase/migrations/20260304200001_create_engagement_events.sql`

**Step 1: Write the migration**

```sql
-- Engagement events for self-improving scoring loop
CREATE TABLE engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('click', 'vote_up', 'vote_down', 'bookmark', 'unbookmark', 'mark_read', 'feed_disable', 'feed_delete')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engagement_events_user ON engagement_events(user_id);
CREATE INDEX idx_engagement_events_type ON engagement_events(event_type);
CREATE INDEX idx_engagement_events_created ON engagement_events(created_at);

-- RLS
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY engagement_events_select ON engagement_events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY engagement_events_insert ON engagement_events
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Learned preferences on user_profiles
ALTER TABLE user_profiles
    ADD COLUMN learned_preferences TEXT,
    ADD COLUMN last_learned_at TIMESTAMPTZ;
```

**Step 2: Apply the migration**

Run: `cd supabase && supabase db push` (or apply via Supabase dashboard if remote)

Verify: table `engagement_events` exists, `user_profiles` has new columns.

**Step 3: Commit**

```bash
git add supabase/migrations/20260304200001_create_engagement_events.sql
git commit -m "feat(#41): add engagement_events table and learned_preferences column"
```

---

### Task 2: Emit engagement events from web server actions

**Files:**
- Modify: `web/actions/articles.ts` (vote, toggleBookmark, markAsRead)
- Modify: `web/actions/feeds.ts` (deleteFeed, updateFeed)
- Create: `web/actions/engagement.ts` (shared helper + click tracking action)

**Step 1: Create the engagement helper**

Create `web/actions/engagement.ts`:

```typescript
"use server"

import { createServerClient, getUser } from "@/lib/supabase/server"

export async function trackEvent(
  eventType: string,
  articleId?: string,
  feedId?: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createServerClient()
  const user = await getUser()
  if (!user) return

  await supabase.from("engagement_events").insert({
    user_id: user.id,
    article_id: articleId ?? null,
    feed_id: feedId ?? null,
    event_type: eventType,
    metadata: metadata ?? {},
  })
}

export async function trackClick(articleId: string, feedId?: string, metadata?: Record<string, unknown>) {
  await trackEvent("click", articleId, feedId, metadata)
}
```

**Step 2: Add event emission to existing actions**

In `web/actions/articles.ts`, modify:

- `vote()` — after the vote insert/update/delete, add:
  ```typescript
  const eventType = direction === "thumbs_up" ? "vote_up" : "vote_down"
  // If toggling off (same direction), we could track "unvote" but skip for now
  if (!existing || existing.direction !== direction) {
    await trackEvent(eventType, articleId)
  }
  ```

- `toggleBookmark()` — after the update, add:
  ```typescript
  await trackEvent(article.bookmarked ? "unbookmark" : "bookmark", articleId)
  ```

- `markAsRead()` — after the update, add:
  ```typescript
  await trackEvent("mark_read", articleId)
  ```

In `web/actions/feeds.ts`, modify:

- `deleteFeed()` — before the delete, add:
  ```typescript
  await trackEvent("feed_delete", undefined, feedId)
  ```

- `updateFeed()` — when `active` is being set to false, add:
  ```typescript
  if (updates.active === false) {
    await trackEvent("feed_disable", undefined, feedId)
  }
  ```

Import `trackEvent` from `@/actions/engagement` in both files.

**Step 3: Run the dev server and verify**

Run: `cd web && npm run dev`

Vote on an article, then check Supabase table browser for the `engagement_events` row.

**Step 4: Commit**

```bash
git add web/actions/engagement.ts web/actions/articles.ts web/actions/feeds.ts
git commit -m "feat(#41): emit engagement events from web actions"
```

---

### Task 3: Click tracking from article cards

**Files:**
- Modify: `web/app/(app)/articles/page.tsx` — add click handler on article title links

**Step 1: Add click tracking**

The article title is already an `<a>` tag linking to the article URL. Wrap it with an `onClick` that fires the `trackClick` server action. Since it's a server action, use a thin client wrapper:

In the article card's title link, change from a plain `<a>` to call `trackClick` before navigating. The simplest approach: add an `onClick` that fires and forgets (don't block navigation):

```tsx
onClick={() => {
  trackClick(article.id, article.feed_id ?? undefined, {
    ai_score: article.ai_score,
    title: article.title,
  })
}}
```

Import `trackClick` from `@/actions/engagement` at the top of the file.

Since this is a server action called from a client component, it works natively in Next.js — no API route needed.

**Step 2: Test in browser**

Click an article link. Check `engagement_events` table for a `click` row.

**Step 3: Commit**

```bash
git add web/app/\(app\)/articles/page.tsx
git commit -m "feat(#41): track article clicks as engagement events"
```

---

### Task 4: The learning handler — `user.learn`

**Files:**
- Create: `engine/engine/handlers/user_learn.py`
- Create: `engine/tests/test_user_learn.py`

**Step 1: Write the test**

Create `engine/tests/test_user_learn.py`:

```python
import pytest
from engine.handlers.user_learn import _build_learning_prompt


def test_build_learning_prompt_with_votes():
    events = [
        {"event_type": "vote_up", "title": "AI breakthrough", "tags": ["AI", "research"]},
        {"event_type": "vote_down", "title": "Celebrity gossip", "tags": ["entertainment"]},
        {"event_type": "bookmark", "title": "Deep learning tutorial", "tags": ["AI", "tutorial"]},
    ]
    prompt = _build_learning_prompt(
        events=events,
        current_interests="AI and technology",
        current_learned="",
    )
    assert "AI breakthrough" in prompt
    assert "Celebrity gossip" in prompt
    assert "Deep learning tutorial" in prompt
    assert "AI and technology" in prompt


def test_build_learning_prompt_empty_events():
    prompt = _build_learning_prompt(events=[], current_interests="AI", current_learned="")
    assert prompt is None  # Nothing to learn from


def test_build_learning_prompt_with_existing_learned():
    events = [
        {"event_type": "vote_up", "title": "New article", "tags": ["tech"]},
    ]
    prompt = _build_learning_prompt(
        events=events,
        current_interests="AI",
        current_learned="User prefers deep technical content over news summaries.",
    )
    assert "User prefers deep technical content" in prompt
```

**Step 2: Run test to verify it fails**

Run: `cd engine && python -m pytest tests/test_user_learn.py -v`
Expected: ImportError (module doesn't exist yet)

**Step 3: Write the handler**

Create `engine/engine/handlers/user_learn.py`:

```python
"""user.learn — Analyze engagement signals and update learned_preferences.

Runs on the user's briefing cadence. Queries recent engagement events,
asks Claude to synthesize preference insights, stores the result.
"""

from __future__ import annotations

import asyncio
import json
from uuid import UUID

import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.services.byok import resolve_api_key
from engine.services.claude import chat, extract_json_object
from engine.services.usage import log_usage

log = structlog.get_logger()


def _build_learning_prompt(
    *,
    events: list[dict],
    current_interests: str,
    current_learned: str,
) -> str | None:
    """Build the prompt for Claude to analyze engagement signals.

    Returns None if there are no events to learn from.
    """
    if not events:
        return None

    # Group events by type
    liked = [e for e in events if e["event_type"] == "vote_up"]
    disliked = [e for e in events if e["event_type"] == "vote_down"]
    bookmarked = [e for e in events if e["event_type"] == "bookmark"]
    clicked = [e for e in events if e["event_type"] == "click"]

    sections = []

    if liked:
        items = "\n".join(f'- "{e["title"]}" (tags: {", ".join(e.get("tags", []))})' for e in liked)
        sections.append(f"ARTICLES THE USER LIKED:\n{items}")

    if disliked:
        items = "\n".join(f'- "{e["title"]}" (tags: {", ".join(e.get("tags", []))})' for e in disliked)
        sections.append(f"ARTICLES THE USER DISLIKED:\n{items}")

    if bookmarked:
        items = "\n".join(f'- "{e["title"]}" (tags: {", ".join(e.get("tags", []))})' for e in bookmarked)
        sections.append(f"ARTICLES THE USER BOOKMARKED:\n{items}")

    if clicked:
        items = "\n".join(f'- "{e["title"]}"' for e in clicked)
        sections.append(f"ARTICLES THE USER CLICKED:\n{items}")

    signals = "\n\n".join(sections)

    learned_section = ""
    if current_learned:
        learned_section = f"""
CURRENT LEARNED PREFERENCES (from previous analysis):
{current_learned}

Update these based on the new signals below. Keep what's still true, revise what's changed."""

    return f"""Analyze this user's recent engagement to understand their content preferences.

USER'S STATED INTERESTS:
{current_interests or "Not specified"}
{learned_section}

RECENT ENGAGEMENT SIGNALS:
{signals}

Based on these signals, write a concise paragraph (3-5 sentences) describing what this user
actually values in content — beyond what they've explicitly stated. Focus on:
- Topics and subtopics they gravitate toward
- Content style preferences (deep technical vs. high-level, tutorials vs. analysis, etc.)
- What they actively avoid or dislike
- Any patterns in what they bookmark vs. just click

Return ONLY a JSON object: {{"learned_preferences": "Your paragraph here."}}"""


@register("user.learn")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    bound_log = log.bind(user_id=str(user_id))

    # Get user profile
    profile = await db.fetchrow(
        "SELECT interests, learned_preferences, last_learned_at FROM user_profiles WHERE id = $1",
        user_id,
    )
    if not profile:
        return {"status": "error", "reason": "User not found"}

    # Query events since last learning (or all if never learned)
    last_learned = profile["last_learned_at"]
    if last_learned:
        rows = await db.fetch(
            """
            SELECT e.event_type, a.title, a.tags
            FROM engagement_events e
            LEFT JOIN articles a ON a.id = e.article_id
            WHERE e.user_id = $1 AND e.created_at > $2
            ORDER BY e.created_at DESC
            LIMIT 100
            """,
            user_id, last_learned,
        )
    else:
        rows = await db.fetch(
            """
            SELECT e.event_type, a.title, a.tags
            FROM engagement_events e
            LEFT JOIN articles a ON a.id = e.article_id
            WHERE e.user_id = $1
            ORDER BY e.created_at DESC
            LIMIT 100
            """,
            user_id,
        )

    events = []
    for r in rows:
        tags = r["tags"]
        if isinstance(tags, str):
            tags = json.loads(tags)
        events.append({
            "event_type": r["event_type"],
            "title": r["title"] or "Untitled",
            "tags": tags or [],
        })

    prompt = _build_learning_prompt(
        events=events,
        current_interests=profile["interests"] or "",
        current_learned=profile["learned_preferences"] or "",
    )

    if not prompt:
        bound_log.info("user.learn.no_events")
        return {"status": "skipped", "reason": "No new engagement events"}

    # Ask Claude to analyze
    api_key = await resolve_api_key(user_id)
    text, usage = await asyncio.to_thread(
        chat, prompt, max_tokens=500, model=settings.haiku_model, api_key=api_key,
    )
    if usage:
        await log_usage(
            user_id=user_id,
            model=usage.get("model", settings.haiku_model),
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            source="user_learn",
        )

    result = extract_json_object(text)
    if not result or not result.get("learned_preferences"):
        bound_log.warning("user.learn.parse_failed", text=text[:200])
        return {"status": "error", "reason": "Failed to parse learning response"}

    learned = result["learned_preferences"]

    # Store learned preferences
    await db.execute(
        "UPDATE user_profiles SET learned_preferences = $2, last_learned_at = NOW() WHERE id = $1",
        user_id, learned,
    )

    bound_log.info("user.learn.done", events_analyzed=len(events), learned_len=len(learned))
    return {"status": "learned", "events_analyzed": len(events)}
```

**Step 4: Run tests**

Run: `cd engine && python -m pytest tests/test_user_learn.py -v`
Expected: 3/3 PASS

**Step 5: Commit**

```bash
git add engine/engine/handlers/user_learn.py engine/tests/test_user_learn.py
git commit -m "feat(#41): add user.learn handler to analyze engagement signals"
```

---

### Task 5: Wire user.learn into the pipeline

**Files:**
- Modify: `engine/engine/handlers/daily_pipeline.py`
- Modify: `engine/engine/handlers/article_score.py`

**Step 1: Add user.learn to daily pipeline**

In `engine/engine/handlers/daily_pipeline.py`, after the briefing.generate command insert (line ~63), add:

```python
    # 4. User learning — analyze engagement to improve scoring
    await db.execute(
        """INSERT INTO commands (type, user_id, idempotency_key)
           VALUES ('user.learn', $1, $2)
           ON CONFLICT (idempotency_key) DO NOTHING""",
        user_id,
        f"auto:user.learn:{user_id}:{window}",
    )
    queued.append("user.learn")
```

**Step 2: Include learned_preferences in scoring prompt**

In `engine/engine/handlers/article_score.py`, after fetching the profile (line ~48), also fetch `learned_preferences`:

Change line 47-48 from:
```python
    profile = await db.fetchrow("SELECT interests FROM user_profiles WHERE id = $1", user_id)
    interests = (profile["interests"] or "") if profile else ""
```

To:
```python
    profile = await db.fetchrow(
        "SELECT interests, learned_preferences FROM user_profiles WHERE id = $1", user_id
    )
    interests = (profile["interests"] or "") if profile else ""
    learned = (profile["learned_preferences"] or "") if profile else ""
```

Then in the prompt (after the `{ratings_context}` line ~64), add:

```python
    learned_section = ""
    if learned:
        learned_section = f"""
LEARNED PREFERENCES (from user behavior):
{learned}
"""
```

And include `{learned_section}` in the prompt string after `{ratings_context}`.

**Step 3: Test manually**

Trigger a `user.learn` command via Supabase:
```sql
INSERT INTO commands (type, user_id, payload)
VALUES ('user.learn', '<your-user-id>', '{}');
```

Check that `user_profiles.learned_preferences` gets populated.

Then trigger an `article.score` and verify the prompt includes the learned preferences (check engine logs).

**Step 4: Commit**

```bash
git add engine/engine/handlers/daily_pipeline.py engine/engine/handlers/article_score.py
git commit -m "feat(#41): wire user.learn into pipeline, include learned prefs in scoring"
```

---

### Task 6: Manual test and verify the full circle

**Steps:**
1. Vote on a few articles (thumbs up/down) — check `engagement_events` has rows
2. Bookmark an article — check event
3. Click an article — check event
4. Trigger `user.learn` via Supabase command insert
5. Check `user_profiles.learned_preferences` is populated with a meaningful paragraph
6. Trigger `article.score` on a new article — verify the scoring prompt includes learned preferences (check logs)
7. Verify the scored article's relevance reflects the learned preferences

**Done when:** The full circle works end-to-end — user actions → events → learning → better scoring.
