"""daily.pipeline — Orchestrator that fans out first-wave scan commands."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import structlog

from engine import db
from engine.handlers import register

log = structlog.get_logger()


@register("daily.pipeline")
async def handle_daily_pipeline(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    """Fan out rss.scan, google_search.scan, and briefing.generate for a user.

    Downstream chaining handles the rest:
      rss.scan / google_search.scan  →  article.batch_fetch  (auto-chained)
      briefing.generate runs independently
    """
    window = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")
    queued: list[str] = []

    # 1. RSS scan — only if user has feeds
    feeds = await db.fetch(
        "SELECT id FROM feeds WHERE user_id = $1 LIMIT 1", user_id
    )
    if feeds:
        await db.execute(
            """INSERT INTO commands (type, user_id, idempotency_key)
               VALUES ('rss.scan', $1, $2)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            user_id,
            f"auto:rss.scan:{user_id}:{window}",
        )
        queued.append("rss.scan")

    # 2. Google search scan — only if user has search terms
    terms = await db.fetch(
        "SELECT id FROM search_terms WHERE user_id = $1 LIMIT 1", user_id
    )
    if terms:
        await db.execute(
            """INSERT INTO commands (type, user_id, idempotency_key)
               VALUES ('google_search.scan', $1, $2)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            user_id,
            f"auto:google_search.scan:{user_id}:{window}",
        )
        queued.append("google_search.scan")

    # 3. Briefing generation
    await db.execute(
        """INSERT INTO commands (type, user_id, idempotency_key)
           VALUES ('briefing.generate', $1, $2)
           ON CONFLICT (idempotency_key) DO NOTHING""",
        user_id,
        f"auto:briefing.generate:{user_id}:{window}",
    )
    queued.append("briefing.generate")

    # 4. User learning — analyze engagement to improve scoring
    await db.execute(
        """INSERT INTO commands (type, user_id, idempotency_key)
           VALUES ('user.learn', $1, $2)
           ON CONFLICT (idempotency_key) DO NOTHING""",
        user_id,
        f"auto:user.learn:{user_id}:{window}",
    )
    queued.append("user.learn")

    log.info("daily.pipeline.queued", user_id=str(user_id), commands=queued)
    return {"queued": queued}
