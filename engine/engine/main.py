"""FastAPI app -- health check, startup/shutdown lifecycle, poller + scheduler."""

from __future__ import annotations

import asyncio
import json
import re
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

import structlog
from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse

from engine import db
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


# Patterns for detecting forwarded messages and extracting the original sender.
# Gmail: "---------- Forwarded message ----------" then "From: Name <email>"
# Outlook: "From:" in a forwarded header block
# Apple Mail: "Begin forwarded message:" then "From: ..."
_FWD_SUBJECT_RE = re.compile(r"^(Fwd?|Fw):\s*", re.IGNORECASE)
_FWD_BODY_PATTERNS = [
    # Gmail / generic: "---------- Forwarded message ----------"
    re.compile(r"[-—]+\s*Forwarded message\s*[-—]+", re.IGNORECASE),
    # Apple Mail
    re.compile(r"Begin forwarded message:", re.IGNORECASE),
    # Outlook
    re.compile(r"From:.*\nSent:.*\nTo:", re.IGNORECASE),
]
# Extract "From: Name <email>" or "From: email" from forwarded block
_FWD_FROM_RE = re.compile(
    r"From:\s*(?:([^<\n]+?)\s*<([^>]+)>|([^\s<\n]+@[^\s>\n]+))",
    re.IGNORECASE,
)


def _extract_forwarded_sender(subject: str, text_body: str) -> tuple[str, str, str] | None:
    """Detect a forwarded message and extract the original sender.

    Returns (sender_email, sender_name, clean_subject) or None if not a forward.
    """
    is_forward = bool(_FWD_SUBJECT_RE.search(subject))

    if not is_forward:
        for pattern in _FWD_BODY_PATTERNS:
            if pattern.search(text_body[:3000]):
                is_forward = True
                break

    if not is_forward:
        return None

    # Find the original From in the forwarded block
    match = _FWD_FROM_RE.search(text_body[:3000])
    if not match:
        return None

    if match.group(2):
        # "Name <email>" format
        sender_name = match.group(1).strip().strip('"')
        sender_email = match.group(2).strip().lower()
    else:
        # bare email
        sender_email = match.group(3).strip().lower()
        sender_name = sender_email.split("@")[0]

    # Clean "Fwd: " prefix from subject
    clean_subject = _FWD_SUBJECT_RE.sub("", subject).strip()

    return sender_email, sender_name, clean_subject


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
        text_body = item.get("RawTextBody") or item.get("TextBody") or ""

        # Detect forwarded messages — use original sender instead of forwarder
        fwd = _extract_forwarded_sender(subject, text_body)
        if fwd:
            sender_email, sender_name, subject = fwd
            log.info("webhook.brevo.forward_detected",
                     original_sender=sender_email, user_id=str(user_id))

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


# ── Admin helpers ─────────────────────────────────────────────────────────────


def _verify_admin(request: Request) -> bool:
    """Verify the request carries the Supabase service role key as Bearer token."""
    key = settings.supabase_service_role_key
    if not key:
        return False
    auth = request.headers.get("authorization", "")
    token = auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else ""
    return token == key


# ── Admin: AI usage ───────────────────────────────────────────────────────────


@app.get("/admin/usage")
async def admin_usage(
    request: Request,
    user_id: str | None = Query(None, description="Filter by user ID"),
    start_date: date | None = Query(None, description="Start date (inclusive)"),
    end_date: date | None = Query(None, description="End date (inclusive)"),
    rollup: str = Query("daily", description="Rollup period: daily or monthly"),
):
    """Query AI usage logs with daily/monthly rollups."""
    if not _verify_admin(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    # Build query with parameterised filters
    conditions = []
    params: list = []
    idx = 0

    if user_id:
        try:
            parsed_uid = UUID(user_id)
        except ValueError:
            return JSONResponse({"error": "invalid user_id"}, status_code=400)
        idx += 1
        conditions.append(f"user_id = ${idx}")
        params.append(parsed_uid)

    if start_date:
        idx += 1
        conditions.append(f"created_at >= ${idx}")
        params.append(datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc))

    if end_date:
        idx += 1
        conditions.append(f"created_at < ${idx}")
        # End date is inclusive — use start of next day for < comparison
        end_dt = datetime(end_date.year, end_date.month, end_date.day, tzinfo=timezone.utc) + timedelta(days=1)
        params.append(end_dt)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    VALID_TRUNCS = {"day", "month"}
    if rollup == "monthly":
        date_trunc = "month"
    else:
        date_trunc = "day"

    if date_trunc not in VALID_TRUNCS:
        return JSONResponse({"error": "Invalid rollup"}, status_code=400)

    if date_trunc == "month":
        query = f"""
        SELECT
            date_trunc('month', created_at) AS period,
            user_id,
            source,
            model,
            COUNT(*) AS call_count,
            SUM(input_tokens) AS total_input_tokens,
            SUM(output_tokens) AS total_output_tokens,
            SUM(cost_usd) AS total_cost_usd
        FROM ai_usage_logs
        {where}
        GROUP BY period, user_id, source, model
        ORDER BY period DESC, total_cost_usd DESC
    """
    else:
        query = f"""
        SELECT
            date_trunc('day', created_at) AS period,
            user_id,
            source,
            model,
            COUNT(*) AS call_count,
            SUM(input_tokens) AS total_input_tokens,
            SUM(output_tokens) AS total_output_tokens,
            SUM(cost_usd) AS total_cost_usd
        FROM ai_usage_logs
        {where}
        GROUP BY period, user_id, source, model
        ORDER BY period DESC, total_cost_usd DESC
    """

    rows = await db.fetch(query, *params)

    # Also get totals
    totals_query = f"""
        SELECT
            COUNT(*) AS total_calls,
            COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
            COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
            COALESCE(SUM(cost_usd), 0) AS total_cost_usd
        FROM ai_usage_logs
        {where}
    """
    totals = await db.fetchrow(totals_query, *params)

    return {
        "rollup": rollup,
        "totals": {
            "calls": totals["total_calls"],
            "input_tokens": totals["total_input_tokens"],
            "output_tokens": totals["total_output_tokens"],
            "cost_usd": float(totals["total_cost_usd"]),
        },
        "rows": [
            {
                "period": row["period"].isoformat(),
                "user_id": str(row["user_id"]),
                "source": row["source"],
                "model": row["model"],
                "calls": row["call_count"],
                "input_tokens": row["total_input_tokens"],
                "output_tokens": row["total_output_tokens"],
                "cost_usd": float(row["total_cost_usd"]),
            }
            for row in rows
        ],
    }
