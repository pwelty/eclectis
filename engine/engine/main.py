"""FastAPI app -- health check, startup/shutdown lifecycle, poller + scheduler."""

from __future__ import annotations

import asyncio
import json
import re
from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from engine import db
from engine.config import settings
from engine.db import close_pool, get_pool
from engine.poller import poll_loop
from engine.scheduler import configure_scheduler, scheduler

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=1.0,
        environment=settings.environment,
        send_default_pii=False,
    )

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


@app.post("/webhooks/brevo")
async def brevo_inbound(request: Request):
    """Receive inbound email from Brevo and queue newsletter.process commands."""
    # Verify webhook secret
    secret = settings.brevo_webhook_secret
    if secret:
        auth_header = request.headers.get("authorization", "")
        token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else request.headers.get("x-webhook-secret", "")
        if token != secret:
            return JSONResponse({"error": "unauthorized"}, status_code=401)

    body = await request.json()
    items = body.get("items", [body]) if isinstance(body, dict) else [body]
    processed = 0

    for item in items:
        # Parse recipient address
        to_arr = item.get("To", [])
        to_raw = to_arr[0].get("Address", "") if to_arr and isinstance(to_arr[0], dict) else item.get("to", "")
        to_match = re.match(r"<?([^@<]+)@", to_raw)
        to_local = to_match.group(1).lower() if to_match else None
        if not to_local:
            log.warning("webhook.brevo.no_recipient", raw=to_raw)
            continue

        # Look up user by newsletter address
        row = await db.fetchrow(
            "SELECT user_id FROM newsletter_addresses WHERE address = $1",
            f"{to_local}@in.eclectis.io",
        )
        if not row:
            log.warning("webhook.brevo.unknown_address", address=to_local)
            continue
        user_id = row["user_id"]

        # Extract sender info
        reply_to = item.get("ReplyTo") or {}
        from_obj = item.get("From") or {}
        sender_email = (reply_to.get("Address") or from_obj.get("Address") or item.get("from", "")).lower()
        sender_name = reply_to.get("Name") or from_obj.get("Name") or sender_email.split("@")[0]

        subject = item.get("Subject") or "Newsletter"
        html = item.get("RawHtmlBody") or item.get("HtmlBody") or ""

        # Find or auto-create newsletter feed for this sender
        feed = await db.fetchrow(
            "SELECT id FROM feeds WHERE user_id = $1 AND type = 'newsletter' AND sender_email = $2",
            user_id,
            sender_email,
        )
        if not feed:
            feed_id = await db.fetchval(
                """
                INSERT INTO feeds (user_id, name, url, type, sender_email)
                VALUES ($1, $2, $3, 'newsletter', $4)
                RETURNING id
                """,
                user_id,
                sender_name[:100],
                f"mailto:{sender_email}",
                sender_email,
            )
        else:
            feed_id = feed["id"]

        # Queue newsletter.process command
        await db.execute(
            """
            INSERT INTO commands (type, user_id, payload)
            VALUES ('newsletter.process', $1, $2)
            """,
            user_id,
            json.dumps({
                "feed_id": str(feed_id),
                "from": sender_email,
                "subject": subject,
                "html": html[:500_000],
            }),
        )

        log.info("webhook.brevo.queued", sender=sender_email, user_id=str(user_id))
        processed += 1

    return {"ok": True, "processed": processed}
