"""article.add — Convergence point for all content sources.

Accepts articles from any scan handler (RSS, Google search, newsletter).
Deduplicates, inserts the article row, then routes to the next step:
- Content already present → queue article.score
- URL only → queue article.fetch
"""

from __future__ import annotations

import hashlib
import json
from uuid import UUID

import structlog

from engine import db
from engine.handlers import register

log = structlog.get_logger()


@register("article.add")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    url = payload.get("url")
    title = payload.get("title", "Untitled")
    content = payload.get("content")
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
