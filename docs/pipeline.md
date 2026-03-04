# Pipeline architecture

How content flows from sources into articles and out as briefings.

## Design principles

- **Queue-driven.** Every step is a command in the queue. Each handler does one thing, then queues the next step. No sweepers, no state polling.
- **Per-user scheduling.** Each user's jobs run independently. No monolithic "scan all users" sweep.
- **Idempotent.** Every command uses an idempotency key (scoped to user + time window) so double-queuing is harmless.
- **Failure-tolerant.** If a step fails, it retries via the existing retry logic. If it permanently fails, the next step simply never gets queued — the article doesn't make it to the briefing, but nothing breaks.

## Article lifecycle

Every source converges to `article.add`. Scan handlers only care about their source-specific logic (parsing RSS, calling Serper, extracting newsletter links). Once they find something worth keeping, they queue `article.add` with the metadata. From that point on, the pipeline is identical regardless of source.

```
rss.scan           ─┐
google_search.scan ─┤─→ queue article.add {url, title, source, ...}
newsletter.process ─┘

article.add {url, title, source, ...}
  → deduplicate
  → insert article row
  → queue article.fetch {article_id}

article.fetch {article_id}
  → scrape full content (ScrapingBee)
  → convert HTML → markdown
  → summarize with Claude (if >500 chars)
  → set accessed_at (for MLA citations)
  → queue article.score {article_id}

article.score {article_id}
  → AI score against user interests + vote history
  → set ai_score, ai_reason, tags
  → done — article is ready for briefing
```

Scan handlers don't insert rows or know about fetching. They just say "here's an article" by queuing `article.add`. Everything downstream flows automatically through the command queue.

No batch operations. Each article is fetched and scored individually as its own command. The poller picks them up whenever it gets to them — could be seconds, could be minutes. The queue handles ordering and retries.

Scoring happens *after* fetch, so Claude has the full article content and summary to work with — not just a title and snippet.

## Input sources

Each source has a different trigger pattern:

| Source | Trigger | Frequency | Handler |
|--------|---------|-----------|---------|
| RSS feeds | Scheduled | Once daily | `rss.scan` |
| Podcasts | Scheduled | Once daily | `rss.scan` (same handler, detects audio enclosures) |
| Google search | Scheduled | Once daily | `google_search.scan` |
| Newsletters | Event-driven | On arrival (webhook) | `newsletter.process` |

### RSS + podcasts

Pull-based. The `rss.scan` handler fetches all active feeds for a user, parses new posts, deduplicates against `processed_posts`, and inserts new articles. Podcasts are RSS feeds with audio enclosures — same handler, same flow, just detects `content_type: podcast` and extracts duration. For each new article, it queues `article.fetch`.

### Google search

Pull-based. The `google_search.scan` handler runs each of the user's search terms through Serper (Google SERP API), deduplicates, and inserts new articles. For each new article, it queues `article.fetch`.

### Newsletters

Push-based. Emails arrive at `{hash}@in.eclectis.io` → Brevo inbound webhook → `newsletter.process` handler. Extracts links from HTML, deduplicates, inserts articles. For each new article, it queues `article.fetch`. Runs immediately on arrival — no daily schedule needed.

## Output

### Email briefing

The briefing is the anchor of the user experience. Each user sets a **briefing time** in their settings (e.g. 7:00 AM in their timezone). At that time, `briefing.generate` runs:

1. Grab top scored articles from the last 48 hours
2. Group into themes with Claude
3. Render branded HTML email
4. Send via Brevo

The briefing reads whatever scored articles are in the `articles` table at that moment. It doesn't care how they got there.

### Curated RSS feed (planned)

Output a user's scored articles as an RSS feed they can subscribe to in any reader.

### Read-later push (planned)

Push articles to Raindrop, Readwise, etc. via API integrations.

## Scheduling

Only two things are scheduled. Everything else flows through the queue.

```
Per-user, once daily:
  rss.scan              → all RSS + podcast feeds
  google_search.scan    → all search terms

Per-user, on arrival:
  newsletter.process    → webhook-triggered, immediate

Per-user, at chosen time:
  briefing.generate     → reads articles table, sends email
```

Scans run once daily at a fixed time (e.g. early morning UTC). They don't need to be tied to briefing time — content from RSS and Google doesn't change by the hour.

The scheduler loop checks every few minutes: "which users need a scan or briefing right now?" and queues commands for any that are due. Idempotency keys prevent double-runs.

```python
# Pseudocode for scheduler tick
for user in active_users:
    if not already_ran_today("rss.scan", user):
        queue("rss.scan", user)
    if not already_ran_today("google_search.scan", user):
        queue("google_search.scan", user)
    if user.briefing_time <= now and not already_ran_today("briefing.generate", user):
        queue("briefing.generate", user)
```

## Scoring

Scoring is now per-article via `article.score`, not batch-scored during scans:

- **Model:** Claude Haiku (cost-optimized)
- **Context:** User interests (from profile) + vote history (last 20 thumbs up/down) + full article content and summary
- **Scale:** 1–10
- **Threshold:** 6 (below = filtered out from briefings, but article row remains)
- **Output:** Score, reason, tags

The scoring prompt includes both what the user says they want (interests) and what they've actually engaged with (votes), so it learns over time. Because scoring runs after fetch, it has much richer context than the old approach of scoring titles and snippets during scans.

## Command lifecycle

Commands flow through the `commands` table:

```
pending → processing → completed
                    → failed (after max retries)
```

- Poller claims up to 5 pending commands every 5 seconds
- Each command gets 3 retry attempts
- Commands stuck in `processing` for >15 minutes are automatically recovered
- Results and errors are stored on the command row for debugging

## Open questions

- **Scan timing vs briefing time.** Scans run at a fixed daily time. If a user's briefing is at 6am but scans run at 8am, they always get yesterday's content. Acceptable for v1? Or should scans run N hours before each user's briefing time?
- **Telemetry (#41).** We want to track engagement (opens, clicks, vote patterns) to improve scoring over time. This is a separate system that feeds back into the scoring prompt context.
- **Score threshold behavior.** Articles below threshold stay in the DB but don't appear in briefings. Should they still show in the web UI (greyed out, or in a "filtered" tab)?
