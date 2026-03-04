"""rss.scan — Fetch RSS feeds, filter with Claude, save high-scoring articles."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone, timedelta
from uuid import UUID

import feedparser
import httpx
import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.services.byok import resolve_api_key
from engine.services.claude import chat, extract_json_array
from engine.services.usage import log_usage

log = structlog.get_logger()

DAYS_BACK = 7
MAX_POSTS_PER_FEED = 50
FALLBACK_RECENT = 5
BATCH_SIZE = 50
MIN_SCORE = 6


@register("rss.scan")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    days_back = payload.get("days_back", DAYS_BACK)
    min_score = payload.get("min_score", MIN_SCORE)

    # Create scan log
    scan_log_id = await db.fetchval(
        "INSERT INTO scan_logs (user_id) VALUES ($1) RETURNING id",
        user_id,
    )

    feeds = await db.fetch(
        "SELECT * FROM feeds WHERE user_id = $1 AND active = TRUE AND type IN ('rss', 'podcast')",
        user_id,
    )

    if not feeds:
        log.info("rss.no_feeds", user_id=str(user_id))
        await db.execute(
            "UPDATE scan_logs SET feeds_scanned = 0, posts_found = 0, posts_saved = 0, tokens_used = 0 WHERE id = $1",
            scan_log_id,
        )
        return {"scan_log_id": str(scan_log_id), "feeds_scanned": 0, "posts_saved": 0}

    all_posts: list[dict] = []
    feeds_scanned = 0

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for feed in feeds:
            try:
                posts = await _fetch_feed(client, feed, days_back)
                all_posts.extend(posts)
                feeds_scanned += 1
            except Exception as exc:
                log.warning("rss.feed_error", feed=feed["name"], error=str(exc))

    # Update feed scan timestamps and auto-tag podcast feeds
    for feed in feeds:
        feed_posts = [p for p in all_posts if p.get("feed_id") == feed["id"]]
        try:
            await db.execute(
                "UPDATE feeds SET last_scanned_at = NOW(), last_item_count = $2 WHERE id = $1",
                feed["id"],
                len(feed_posts),
            )
            if feed_posts and feed["type"] != "podcast":
                podcast_count = sum(1 for p in feed_posts if p.get("content_type") == "podcast")
                if podcast_count == len(feed_posts):
                    await db.execute("UPDATE feeds SET type = 'podcast' WHERE id = $1", feed["id"])
                    log.info("rss.auto_tagged_podcast", feed=feed["name"])
        except Exception as e:
            log.warning("rss.feed_update.failed", feed=feed["name"], error=str(e))

    # Bulk dedup against processed_posts
    all_urls = [p["url"] for p in all_posts]
    if all_urls:
        seen_rows = await db.fetch(
            "SELECT DISTINCT url FROM processed_posts WHERE user_id = $1 AND url = ANY($2)",
            user_id,
            all_urls,
        )
        seen_urls = {r["url"] for r in seen_rows}
        new_posts = [p for p in all_posts if p["url"] not in seen_urls]
    else:
        new_posts = []

    log.info("rss.new_posts", total=len(all_posts), new=len(new_posts))

    if not new_posts:
        await db.execute(
            "UPDATE scan_logs SET feeds_scanned = $2, posts_found = $3, posts_saved = 0, tokens_used = 0 WHERE id = $1",
            scan_log_id, feeds_scanned, len(all_posts),
        )
        return {"scan_log_id": str(scan_log_id), "feeds_scanned": feeds_scanned, "posts_saved": 0}

    # Resolve API key (BYOK gating)
    api_key = await resolve_api_key(user_id)

    # Build scoring context
    interests = await _get_interests(user_id)
    ratings_context = await _build_ratings_context(user_id)

    # AI filter in batches
    saved_count = 0
    total_tokens = 0

    for i in range(0, len(new_posts), BATCH_SIZE):
        batch = new_posts[i : i + BATCH_SIZE]
        results, usage = await asyncio.to_thread(_filter_with_claude, batch, interests, ratings_context, api_key)
        total_tokens += usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        if usage:
            await log_usage(
                user_id=user_id,
                model=usage.get("model", settings.haiku_model),
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                source="rss_scan",
            )

        for idx, result in enumerate(results):
            score = result.get("score")
            if not score:
                continue

            if idx < len(batch):
                post_data = batch[idx]
            else:
                post_data = next((p for p in batch if p["title"] == result.get("title")), None)
            if not post_data:
                continue

            if score >= min_score:
                try:
                    await db.execute(
                        """
                        INSERT INTO articles (user_id, feed_id, title, url, summary, published_at,
                            ai_score, ai_reason, tags, source, status, content_type, audio_url, duration_seconds)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'rss', 'to_read', $10, $11, $12)
                        ON CONFLICT (user_id, url) DO NOTHING
                        """,
                        user_id,
                        post_data.get("feed_id"),
                        post_data["title"],
                        post_data["url"],
                        post_data.get("summary"),
                        post_data.get("published_at"),
                        score,
                        result.get("reason"),
                        json.dumps(result.get("tags", [])),
                        post_data.get("content_type", "article"),
                        post_data.get("audio_url"),
                        post_data.get("duration_seconds"),
                    )
                    saved_count += 1
                except Exception as exc:
                    log.warning("rss.save_error", url=post_data["url"], error=str(exc))

        # Mark all posts in batch as processed (bulk)
        for idx, post in enumerate(batch):
            result = results[idx] if idx < len(results) else None
            try:
                await db.execute(
                    """
                    INSERT INTO processed_posts (user_id, url, saved, processed_at)
                    VALUES ($1, $2, $3, NOW())
                    ON CONFLICT (user_id, url) DO NOTHING
                    """,
                    user_id,
                    post["url"],
                    result.get("score", 0) >= min_score if result else False,
                )
            except Exception as e:
                log.warning("rss.mark_processed.failed", url=post["url"], error=str(e))

    # Update scan log
    await db.execute(
        "UPDATE scan_logs SET feeds_scanned = $2, posts_found = $3, posts_saved = $4, tokens_used = $5 WHERE id = $1",
        scan_log_id, feeds_scanned, len(all_posts), saved_count, total_tokens,
    )

    # Auto-chain: queue batch fetch for high-scoring articles
    if saved_count > 0:
        window = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")
        try:
            await db.execute(
                """
                INSERT INTO commands (type, payload, user_id, idempotency_key)
                VALUES ('article.batch_fetch', $1, $2, $3)
                ON CONFLICT (idempotency_key) DO NOTHING
                """,
                json.dumps({}),
                user_id,
                f"auto:article.batch_fetch:{user_id}:{window}",
            )
            log.info("rss.batch_fetch_queued", user_id=str(user_id))
        except Exception as exc:
            log.warning("rss.batch_fetch_queue.failed", error=str(exc))

    return {"scan_log_id": str(scan_log_id), "feeds_scanned": feeds_scanned, "posts_saved": saved_count}


async def _fetch_feed(client: httpx.AsyncClient, feed, days_back: int) -> list[dict]:
    headers = {"User-Agent": "Eclectis/1.0"}
    if feed["etag"]:
        headers["If-None-Match"] = feed["etag"]
    if feed["last_modified"]:
        headers["If-Modified-Since"] = feed["last_modified"]

    resp = await client.get(feed["url"], headers=headers)

    if resp.status_code == 304:
        return []

    new_etag = resp.headers.get("etag")
    new_last_modified = resp.headers.get("last-modified")
    if new_etag or new_last_modified:
        await db.execute(
            "UPDATE feeds SET etag = COALESCE($2, etag), last_modified = COALESCE($3, last_modified) WHERE id = $1",
            feed["id"],
            new_etag,
            new_last_modified,
        )

    parsed = feedparser.parse(resp.text)
    if parsed.bozo and not parsed.entries:
        log.warning("rss.malformed_feed", feed=feed["name"], error=str(parsed.bozo_exception))
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

    posts = []
    all_entries = []
    for entry in parsed.entries[:MAX_POSTS_PER_FEED]:
        published = None
        for key in ("published_parsed", "updated_parsed"):
            t = getattr(entry, key, None)
            if t:
                published = datetime(*t[:6], tzinfo=timezone.utc)
                break

        summary = (entry.get("summary") or "").strip()
        if not summary and entry.get("content"):
            summary = (entry["content"][0].get("value", "") or "").strip()
        summary = summary[:2000]

        url = entry.get("link") or entry.get("id", "")
        if not url:
            continue

        # Detect podcast episodes via audio enclosures
        audio_url = None
        duration_seconds = None
        content_type = "article"
        for enc in getattr(entry, "enclosures", []):
            if (enc.get("type") or "").lower().startswith("audio/"):
                audio_url = enc.get("href") or enc.get("url")
                content_type = "podcast"
                break
        if content_type == "podcast":
            raw_dur = getattr(entry, "itunes_duration", None)
            if raw_dur:
                duration_seconds = _parse_duration(str(raw_dur))

        post = {
            "title": (entry.get("title") or "Untitled").strip()[:255],
            "url": url,
            "summary": summary,
            "published_at": published,
            "feed_id": feed["id"],
            "content_type": content_type,
            "audio_url": audio_url,
            "duration_seconds": duration_seconds,
        }
        all_entries.append(post)

        if published and published < cutoff:
            continue
        posts.append(post)

    # Fallback: if date filtering removed everything, take most recent entries
    if not posts and all_entries:
        all_entries.sort(key=lambda p: p["published_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        posts = all_entries[:FALLBACK_RECENT]
        log.info("rss.date_fallback", feed=feed["name"], entries=len(all_entries), kept=len(posts))

    return posts


def _filter_with_claude(posts: list[dict], interests: str, ratings_context: str, api_key: str | None = None) -> tuple[list[dict], dict]:
    if not posts:
        return [], {}

    posts_text = "\n".join(
        f"{i + 1}. {'[Podcast] ' if p.get('content_type') == 'podcast' else ''}Title: {p['title']} | URL: {p['url']} | Summary: {(p.get('summary') or 'N/A')[:500]}"
        for i, p in enumerate(posts)
    )

    prompt = f"""You are filtering RSS feed posts for relevance to specific interests.

INTERESTS:
{interests}

{ratings_context}

POSTS TO EVALUATE:
{posts_text}

Score EVERY post for relevance. Return a JSON array with EXACTLY {len(posts)} elements, one per post, in the SAME ORDER as listed above. Each element must have:
- "score": relevance score 1-10
- "reason": brief explanation (1-2 sentences)
- "tags": array of up to 5 topic tags

Return ONLY the JSON array, no other text."""

    try:
        text, usage = chat(prompt, max_tokens=8000, model=settings.haiku_model, api_key=api_key)
        results = extract_json_array(text)
        return results, usage
    except Exception as exc:
        log.error("rss.claude_error", error=str(exc))
        return [], {}


def _parse_duration(raw: str) -> int | None:
    """Parse itunes:duration which can be seconds, MM:SS, or HH:MM:SS."""
    if not raw:
        return None
    raw = raw.strip()
    try:
        return int(raw)
    except ValueError:
        pass
    parts = raw.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        pass
    return None


async def _get_interests(user_id: UUID) -> str:
    """Get user interests from profile."""
    row = await db.fetchrow("SELECT interests FROM user_profiles WHERE id = $1", user_id)
    return (row["interests"] or "") if row else ""


async def _build_ratings_context(user_id: UUID) -> str:
    """Build context from user's vote history for scoring calibration."""
    liked = await db.fetch(
        """
        SELECT a.title FROM votes v
        JOIN articles a ON a.id = v.article_id
        WHERE v.user_id = $1 AND v.direction = 'thumbs_up'
        ORDER BY v.updated_at DESC LIMIT 20
        """,
        user_id,
    )
    disliked = await db.fetch(
        """
        SELECT a.title FROM votes v
        JOIN articles a ON a.id = v.article_id
        WHERE v.user_id = $1 AND v.direction = 'thumbs_down'
        ORDER BY v.updated_at DESC LIMIT 20
        """,
        user_id,
    )
    if not liked and not disliked:
        return ""

    parts = ["\nLEARN FROM THESE USER RATINGS:"]
    if liked:
        parts.append("\nARTICLES THE USER LIKED:")
        for a in liked:
            parts.append(f'- "{a["title"]}"')
    if disliked:
        parts.append("\nARTICLES THE USER DISLIKED:")
        for a in disliked:
            parts.append(f'- "{a["title"]}"')
    return "\n".join(parts)
