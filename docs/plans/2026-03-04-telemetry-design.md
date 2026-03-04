# Engagement telemetry — self-improving scoring loop

## Goal

Close the feedback loop: user engagement signals feed back into AI scoring so articles get better over time without the user manually updating their interests.

## Signals captured

Discrete events only (no passive tracking like dwell time or scroll depth):

- **Click** — user opens an article's external URL
- **Vote up / Vote down** — thumbs on articles
- **Bookmark / Unbookmark** — save for later
- **Mark as read** — status change
- **Feed disable / Feed delete** — user abandons a source

## Events table

`engagement_events` — single append-only table for all signals:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| article_id | UUID FK (nullable) | null for feed-level events |
| feed_id | UUID FK (nullable) | null for article-only events |
| event_type | TEXT | click, vote_up, vote_down, bookmark, unbookmark, mark_read, feed_disable, feed_delete |
| metadata | JSONB | snapshot of article context at event time (tags, ai_score, feed name) |
| created_at | TIMESTAMPTZ | |

## Where events fire

- **Web server actions**: `vote()`, `toggleBookmark()`, `markAsRead()` in `articles.ts` — insert into `engagement_events` alongside the existing mutation
- **Click tracking**: `onClick` handler on article links fires a server action before navigating
- **Feed actions**: `deleteFeed()`, `updateFeed(active=false)` in `feeds.ts` — log feed-level events

## Learning step: `user.learn` command

New engine handler at `engine/engine/handlers/user_learn.py`:

1. Triggered on the user's **briefing cadence** (after each briefing generation, or whenever the pipeline runs for that user)
2. Queries `engagement_events` since last learning timestamp
3. Sends prompt to Claude with:
   - Current `interests` (user-written, never modified)
   - Current `learned_preferences` (AI-written, will be replaced)
   - Recent votes with article titles/tags
   - Recent bookmarks with article titles/tags
   - Click patterns (which feeds/topics get clicked most)
   - Feed disables (topics user is abandoning)
4. Claude generates updated `learned_preferences` — a concise paragraph describing what the user values beyond their stated interests
5. Stores in `user_profiles.learned_preferences`
6. Updates `user_profiles.last_learned_at` timestamp

## How scoring uses it

`article.score` prompt gets a new section:

```
LEARNED PREFERENCES (from your behavior):
{learned_preferences}
```

Alongside existing `USER INTERESTS` and `LEARN FROM THESE USER RATINGS` sections.

## Schema changes

- `user_profiles` — add `learned_preferences TEXT`, `last_learned_at TIMESTAMPTZ`
- New `engagement_events` table (see above)

## The full circle

```
User reads/clicks/votes/bookmarks
  → engagement_events table
  → user.learn analyzes patterns (on briefing cadence)
  → learned_preferences updated
  → article.score includes learned_preferences
  → better scores → better content
  → repeat
```
