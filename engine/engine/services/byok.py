"""BYOK (Bring Your Own Key) plan gating for AI operations.

Free-tier users must provide their own Anthropic API key.
Pro users use the platform key.
"""

from __future__ import annotations

from uuid import UUID

import structlog

from engine import db

log = structlog.get_logger()

BYOK_ERROR = "Add your API key in Settings to enable AI features on the free plan"


class PlanGatingError(Exception):
    """Raised when a free user has no API key configured."""


async def resolve_api_key(user_id: UUID) -> str | None:
    """Resolve which API key to use for AI calls.

    Returns:
        The user's BYOK key for free-plan users, or None to use the platform key for pro users.

    Raises:
        PlanGatingError: If user is on the free plan with no API key set.
    """
    row = await db.fetchrow(
        "SELECT plan, api_key FROM user_profiles WHERE id = $1",
        user_id,
    )
    if not row:
        raise PlanGatingError("User profile not found")

    plan = row["plan"] or "free"
    user_api_key = (row["api_key"] or "").strip()

    if plan == "pro":
        # Pro users use the platform key (return None = use default)
        return None

    # Free plan: must have their own key
    if not user_api_key:
        log.info("byok.gated", user_id=str(user_id), plan=plan)
        raise PlanGatingError(BYOK_ERROR)

    return user_api_key
