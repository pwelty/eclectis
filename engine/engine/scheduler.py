"""Scheduled jobs -- APScheduler async setup with placeholder jobs."""

from __future__ import annotations

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

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
    """Placeholder -- will queue daily.pipeline commands for active users."""
    log.info("scheduler.daily_pipeline_triggered")
