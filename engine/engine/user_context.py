"""Shared user context helpers for scoring and filtering prompts."""

from __future__ import annotations

from uuid import UUID

from engine import db


async def get_user_context(user_id: UUID) -> tuple[str, str]:
    """Return (interests, learned_preferences) for a user."""
    row = await db.fetchrow(
        "SELECT interests, learned_preferences FROM user_profiles WHERE id = $1",
        user_id,
    )
    if not row:
        return "", ""
    return (row["interests"] or ""), (row["learned_preferences"] or "")


def format_preferences_block(interests: str, learned: str) -> str:
    """Format the combined user preferences section for prompts."""
    parts = [f"USER INTERESTS:\n{interests or 'General technology and business'}"]
    if learned:
        parts.append(f"LEARNED PREFERENCES (from user behavior):\n{learned}")
    return "\n\n".join(parts)
