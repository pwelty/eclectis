"""Command polling loop -- polls commands table, dispatches to handlers."""

from __future__ import annotations

import asyncio
import json
import traceback
from datetime import datetime, timedelta, timezone

import structlog

from engine import db
from engine.config import settings
from engine.handlers import get_handler

log = structlog.get_logger()

# Commands stuck in 'processing' longer than this are considered timed out
STUCK_COMMAND_THRESHOLD = timedelta(minutes=15)


async def poll_loop() -> None:
    """Run the poller indefinitely, sleeping between cycles."""
    log.info("poller.started", interval=settings.command_poll_interval)
    while True:
        try:
            await poll_once()
        except Exception:
            log.error("poller.error", exc_info=True)
        await asyncio.sleep(settings.command_poll_interval)


async def cleanup_stuck_commands() -> None:
    """Detect commands stuck in 'processing' and recover them.

    For each stuck command:
    - If attempts < max_attempts: reset to 'pending' so the poller retries it.
    - If attempts >= max_attempts: mark as 'failed' and write a dead letter.
    """
    cutoff = datetime.now(timezone.utc) - STUCK_COMMAND_THRESHOLD
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        stuck_rows = await conn.fetch(
            """
            SELECT id, type, user_id, attempt_count, max_attempts, payload, updated_at
            FROM commands
            WHERE status = 'processing'
              AND updated_at < $1
            ORDER BY updated_at
            FOR UPDATE SKIP LOCKED
            """,
            cutoff,
        )
        if not stuck_rows:
            return

        now = datetime.now(timezone.utc)
        for row in stuck_rows:
            cmd_id = row["id"]
            bound = log.bind(
                command_id=str(cmd_id),
                command_type=row["type"],
                stuck_since=str(row["updated_at"]),
            )

            if row["attempt_count"] < row["max_attempts"]:
                await conn.execute(
                    "UPDATE commands SET status = 'pending', error = $2, updated_at = $3 WHERE id = $1",
                    cmd_id,
                    "Reset from stuck processing state (timeout)",
                    now,
                )
                bound.warning(
                    "stuck_command.reset_to_pending",
                    attempt_count=row["attempt_count"],
                    max_attempts=row["max_attempts"],
                )
            else:
                error_msg = "Command timed out in processing state after all retry attempts"
                await conn.execute(
                    "UPDATE commands SET status = 'failed', error = $2, completed_at = $3, updated_at = $3 WHERE id = $1",
                    cmd_id,
                    error_msg,
                    now,
                )
                bound.error(
                    "stuck_command.failed_permanently",
                    attempt_count=row["attempt_count"],
                    max_attempts=row["max_attempts"],
                )

        log.info("stuck_command.cleanup_complete", count=len(stuck_rows))


async def poll_once() -> None:
    """Single poll cycle: cleanup stuck commands, claim pending, process each."""
    # Clean up any commands stuck in 'processing' before picking up new work
    try:
        await cleanup_stuck_commands()
    except Exception:
        log.error("stuck_command.cleanup_error", exc_info=True)

    # Claim commands in a quick transaction, then release the connection
    pool = await db.get_pool()
    claimed: list[dict] = []
    async with pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                SELECT * FROM commands
                WHERE status = 'pending'
                  AND attempt_count < max_attempts
                ORDER BY created_at
                LIMIT 5
                FOR UPDATE SKIP LOCKED
                """,
            )
            now = datetime.now(timezone.utc)
            for row in rows:
                await conn.execute(
                    "UPDATE commands SET status = 'processing', started_at = $2, attempt_count = attempt_count + 1, updated_at = $2 WHERE id = $1",
                    row["id"],
                    now,
                )
                claimed.append(dict(row))

    # Process each claimed command outside the transaction
    for row_dict in claimed:
        await _process_command(row_dict)


async def _process_command(row: dict) -> None:
    """Execute a single command via its registered handler."""
    command_id = row["id"]
    command_type = row["type"]
    payload = json.loads(row["payload"]) if isinstance(row["payload"], str) else (row["payload"] or {})
    user_id = row["user_id"]

    bound_log = log.bind(command_id=str(command_id), command_type=command_type)
    bound_log.info("command.processing")

    handler = get_handler(command_type)
    if handler is None:
        error_msg = f"No handler registered for command type: {command_type}"
        bound_log.error("command.no_handler")
        await _fail_command(command_id, error_msg, payload)
        return

    try:
        result = await handler(
            command_id=command_id,
            payload=payload,
            user_id=user_id,
        )
        await db.execute(
            "UPDATE commands SET status = 'completed', result = $2, completed_at = $3, updated_at = $3 WHERE id = $1",
            command_id,
            json.dumps(result or {}),
            datetime.now(timezone.utc),
        )
        bound_log.info("command.completed")

    except Exception as exc:
        tb = traceback.format_exc()
        bound_log.error("command.failed", error=str(exc))
        await _fail_command(command_id, str(exc), payload, tb)


async def _fail_command(command_id, error_msg: str, payload, details: str | None = None) -> None:
    """Handle a failed command: retry or write to dead letters."""
    row = await db.fetchrow("SELECT attempt_count, max_attempts FROM commands WHERE id = $1", command_id)
    if not row:
        return

    now = datetime.now(timezone.utc)
    if row["attempt_count"] >= row["max_attempts"]:
        await db.execute(
            "UPDATE commands SET status = 'failed', error = $2, completed_at = $3, updated_at = $3 WHERE id = $1",
            command_id,
            error_msg,
            now,
        )
        log.error("command.dead_letter", command_id=str(command_id), error=error_msg)
    else:
        # Return to pending for retry
        await db.execute(
            "UPDATE commands SET status = 'pending', error = $2, updated_at = $3 WHERE id = $1",
            command_id,
            error_msg,
            now,
        )
