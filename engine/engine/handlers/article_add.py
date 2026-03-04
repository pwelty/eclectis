"""article.add — Convergence point for all content sources.

Accepts articles from any scan handler (RSS, Google search, newsletter).
Deduplicates, pre-scores to filter junk, inserts the article row, then
routes to the next step:
- Pre-score reject → insert with score 0, skip fetch/score
- Content already present → queue article.score
- URL only → queue article.fetch
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from uuid import UUID

import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.html_strip import strip_html
from engine.services.byok import resolve_api_key
from engine.services.claude import chat, extract_json_object
from engine.services.usage import log_usage

log = structlog.get_logger()


async def _prescore(title: str, url: str, user_id: UUID) -> bool:
    """Quick Haiku call: is this title+URL worth fetching and scoring?

    Returns True if the article looks like real content, False for junk
    (terms pages, hiring posts, unsubscribe links, login pages, etc.).
    """
    prompt = f"""Is this article worth reading? Look at the title and URL.

Title: {title}
URL: {url}

Reject if it's clearly NOT a real article — for example:
- Terms of service, privacy policy, legal pages
- Job postings, hiring pages, careers pages
- Login/signup/unsubscribe/account pages
- Navigation pages, site homepages with no article
- Cookie notices, GDPR consent pages
- "Powered by", "Built with" attribution pages

Accept if it looks like actual content a reader would want to read — news, analysis, tutorials, opinion, reviews, etc. When in doubt, accept.

Return ONLY a JSON object: {{"accept": true}} or {{"accept": false}}"""

    try:
        api_key = await resolve_api_key(user_id)
        text, usage = await asyncio.to_thread(
            chat, prompt, max_tokens=50, model=settings.haiku_model, api_key=api_key,
        )
        if usage:
            await log_usage(
                user_id=user_id,
                model=usage.get("model", settings.haiku_model),
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                source="article_prescore",
            )
        result = extract_json_object(text)
        if result and result.get("accept") is False:
            return False
        return True  # default accept
    except Exception as exc:
        log.warning("prescore.failed", error=str(exc), title=title[:80])
        return True  # on error, let it through


@register("article.add")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    url = payload.get("url")
    title = strip_html(payload.get("title", "Untitled")) or "Untitled"
    content = strip_html(payload.get("content"))
    source = payload.get("source", "unknown")
    feed_id = payload.get("feed_id")
    content_type = payload.get("content_type", "article")

    bound_log = log.bind(user_id=str(user_id), source=source)

    # Generate synthetic URL for content articles (no URL to fetch)
    if not url and content:
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        url = f"content://{content_hash}"
    elif not url:
        return {"status": "error", "reason": "No URL or content provided"}

    # Deduplicate against existing articles
    existing = await db.fetchrow(
        "SELECT id FROM articles WHERE user_id = $1 AND url = $2",
        user_id, url,
    )
    if existing:
        bound_log.info("article.add.duplicate", url=url[:80])
        return {"status": "duplicate", "article_id": str(existing["id"])}

    # Deduplicate against processed_posts (for URL-based articles)
    if not url.startswith("content://"):
        already = await db.fetchrow(
            "SELECT url FROM processed_posts WHERE user_id = $1 AND url = $2",
            user_id, url,
        )
        if already:
            bound_log.info("article.add.already_processed", url=url[:80])
            return {"status": "already_processed", "url": url}

    # Pre-score gate: ask Haiku if this title+URL is worth pursuing
    if not url.startswith("content://"):
        worthy = await _prescore(title, url, user_id)
        if not worthy:
            bound_log.info("article.add.prescore_rejected", title=title[:80], url=url[:80])
            # Insert with score 0, skip fetch and score
            parsed_feed_id = UUID(feed_id) if isinstance(feed_id, str) and feed_id else feed_id
            article_id = await db.fetchval(
                """
                INSERT INTO articles (user_id, feed_id, title, url, source, content_type,
                                      ai_score, ai_reason, status, published_at, found_at)
                VALUES ($1, $2, $3, $4, $5, $6, 0, 'Pre-score: not a real article', 'to_read', NOW(), NOW())
                ON CONFLICT (user_id, url) DO NOTHING
                RETURNING id
                """,
                user_id, parsed_feed_id if isinstance(parsed_feed_id, UUID) else None,
                title[:255], url, source, content_type,
            )
            if article_id and not url.startswith("content://"):
                await db.execute(
                    """
                    INSERT INTO processed_posts (user_id, url, saved, processed_at)
                    VALUES ($1, $2, true, NOW())
                    ON CONFLICT (user_id, url) DO NOTHING
                    """,
                    user_id, url,
                )
            return {"status": "prescore_rejected", "article_id": str(article_id) if article_id else None}

    # Insert article row
    parsed_feed_id = UUID(feed_id) if isinstance(feed_id, str) and feed_id else feed_id
    article_id = await db.fetchval(
        """
        INSERT INTO articles (user_id, feed_id, title, url, content, source, content_type,
                              status, published_at, found_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'to_read', NOW(), NOW())
        ON CONFLICT (user_id, url) DO NOTHING
        RETURNING id
        """,
        user_id, parsed_feed_id, title[:255], url,
        content[:100_000] if content else None,
        source, content_type,
    )

    if not article_id:
        return {"status": "duplicate", "url": url}

    # Track in processed_posts (for URL-based articles)
    if not url.startswith("content://"):
        await db.execute(
            """
            INSERT INTO processed_posts (user_id, url, saved, processed_at)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (user_id, url) DO NOTHING
            """,
            user_id, url,
        )

    # Route to next step
    if content:
        # Content present — skip fetch, go straight to scoring
        await db.execute(
            """
            INSERT INTO commands (type, user_id, payload, idempotency_key)
            VALUES ('article.score', $1, $2, $3)
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            user_id,
            json.dumps({"article_id": str(article_id)}),
            f"score-{article_id}",
        )
        bound_log.info("article.add.queued_score", article_id=str(article_id))
    else:
        # URL only — fetch content first
        await db.execute(
            """
            INSERT INTO commands (type, user_id, payload, idempotency_key)
            VALUES ('article.fetch', $1, $2, $3)
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            user_id,
            json.dumps({"article_id": str(article_id)}),
            f"fetch-{article_id}",
        )
        bound_log.info("article.add.queued_fetch", article_id=str(article_id))

    return {"status": "created", "article_id": str(article_id), "has_content": bool(content)}
