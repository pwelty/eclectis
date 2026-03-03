"""Ping handler -- simple test for the command pipeline."""

from __future__ import annotations

import structlog

from engine.handlers import register

log = structlog.get_logger()


@register("ping")
async def handle_ping(*, command_id, payload, user_id, **kwargs) -> dict:
    log.info("ping.handled", command_id=str(command_id))
    return {"pong": True}
