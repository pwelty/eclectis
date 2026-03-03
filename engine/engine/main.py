"""FastAPI app -- health check, startup/shutdown lifecycle, poller + scheduler."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from engine.config import settings
from engine.db import close_pool, get_pool
from engine.poller import poll_loop
from engine.scheduler import configure_scheduler, scheduler

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.log_level == "DEBUG" else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(getattr(structlog, settings.log_level, 20)),
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("engine.starting")
    await get_pool()

    configure_scheduler()
    scheduler.start()

    poller_task = asyncio.create_task(poll_loop())

    yield

    log.info("engine.shutting_down")
    poller_task.cancel()
    scheduler.shutdown(wait=False)
    await close_pool()


app = FastAPI(title="Eclectis engine", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health():
    pool = await get_pool()
    row = await pool.fetchrow("SELECT 1 AS ok")
    return {"status": "ok", "db": row["ok"] == 1}
