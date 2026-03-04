"""Scheduled jobs — tick every few minutes, queue commands for users who are due.

Per the pipeline doc:
- Scans (rss.scan, google_search.scan) run once daily at a fixed time (early morning)
- Briefings run at each user's chosen briefing_send_hour
- user.learn runs alongside briefings
- Idempotency keys prevent double-runs
"""

from __future__ import annotations

from datetime import datetime, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from engine import db

log = structlog.get_logger()

scheduler = AsyncIOScheduler()

# Scans run once daily at this UTC hour (6:00 UTC = ~1am ET, ~2am CT)
SCAN_HOUR_UTC = 6


def configure_scheduler() -> None:
    """Register the scheduler tick. Called once at startup."""
    scheduler.add_job(
        _tick,
        IntervalTrigger(minutes=5),
        id="scheduler_tick",
        replace_existing=True,
    )
    log.info("scheduler.configured", tick_interval_min=5)


async def _tick() -> None:
    """Check which users need scans or briefings right now."""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    window = now.strftime("%Y-%m-%d")

    # ── Scans: once daily at SCAN_HOUR_UTC ────────────────────────────
    if current_hour == SCAN_HOUR_UTC:
        await _queue_scans(window)

    # ── Briefings + learning: per-user at their chosen hour ───────────
    await _queue_briefings(current_hour, window)


async def _queue_scans(window: str) -> None:
    """Queue rss.scan and google_search.scan for all active users."""
    # Users with active feeds
    feed_users = await db.fetch(
        "SELECT DISTINCT user_id FROM feeds WHERE active = true"
    )
    for row in feed_users:
        user_id = row["user_id"]
        await db.execute(
            """INSERT INTO commands (type, user_id, idempotency_key)
               VALUES ('rss.scan', $1, $2)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            user_id, f"auto:rss.scan:{user_id}:{window}",
        )

    # Users with search terms
    search_users = await db.fetch(
        "SELECT DISTINCT user_id FROM search_terms"
    )
    for row in search_users:
        user_id = row["user_id"]
        await db.execute(
            """INSERT INTO commands (type, user_id, idempotency_key)
               VALUES ('google_search.scan', $1, $2)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            user_id, f"auto:google_search.scan:{user_id}:{window}",
        )

    total = len(feed_users) + len(search_users)
    if total:
        log.info("scheduler.scans_queued", feed_users=len(feed_users), search_users=len(search_users))


async def _queue_briefings(current_hour: int, window: str) -> None:
    """Queue briefing.generate and user.learn for users whose briefing hour is now."""
    rows = await db.fetch(
        """
        SELECT id AS user_id
        FROM user_profiles
        WHERE COALESCE((preferences->>'briefing_send_hour')::int, 7) = $1
        """,
        current_hour,
    )

    for row in rows:
        user_id = row["user_id"]

        await db.execute(
            """INSERT INTO commands (type, user_id, idempotency_key)
               VALUES ('briefing.generate', $1, $2)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            user_id, f"auto:briefing.generate:{user_id}:{window}",
        )

        await db.execute(
            """INSERT INTO commands (type, user_id, idempotency_key)
               VALUES ('user.learn', $1, $2)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            user_id, f"auto:user.learn:{user_id}:{window}",
        )

    if rows:
        log.info("scheduler.briefings_queued", users=len(rows), hour_utc=current_hour)
