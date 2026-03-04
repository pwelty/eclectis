"""Scheduled jobs -- APScheduler async setup."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from engine import db

log = structlog.get_logger()

scheduler = AsyncIOScheduler()


def configure_scheduler() -> None:
    """Register all scheduled jobs. Called once at startup."""
    # Daily pipeline: discovery -> scoring -> briefing (11:00 UTC / 6am ET)
    scheduler.add_job(
        schedule_daily_pipeline,
        CronTrigger(hour=11),
        id="daily_pipeline",
        replace_existing=True,
    )

    log.info("scheduler.configured", jobs=len(scheduler.get_jobs()))


async def schedule_daily_pipeline() -> None:
    """Queue daily.pipeline commands for all active users."""
    log.info("scheduler.daily_pipeline_triggered")

    window = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")

    rows = await db.fetch(
        """
        SELECT DISTINCT up.id AS user_id
        FROM user_profiles up
        JOIN feeds f ON f.user_id = up.id AND f.active = true
        """
    )

    queued = 0
    for row in rows:
        user_id = row["user_id"]
        await db.execute(
            """INSERT INTO commands (type, user_id, idempotency_key)
               VALUES ('daily.pipeline', $1, $2)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            user_id,
            f"auto:daily.pipeline:{user_id}:{window}",
        )
        queued += 1

    log.info("scheduler.daily_pipeline_queued", users=queued)
