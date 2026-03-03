"""AI usage tracking — logs token usage and cost per Claude API call."""

from __future__ import annotations

from uuid import UUID

import structlog

from engine import db

log = structlog.get_logger()

# Pricing per 1M tokens (as of 2026-03)
# https://docs.anthropic.com/en/docs/about-claude/pricing
MODEL_PRICING: dict[str, tuple[float, float]] = {
    # (input_per_1m, output_per_1m)
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-sonnet-4-5-20250514": (3.00, 15.00),
    "claude-opus-4-6": (15.00, 75.00),
}

# Fallback for unknown models
DEFAULT_PRICING = (3.00, 15.00)


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost for a Claude API call."""
    input_rate, output_rate = MODEL_PRICING.get(model, DEFAULT_PRICING)
    return (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000


async def log_usage(
    *,
    user_id: UUID,
    model: str,
    input_tokens: int,
    output_tokens: int,
    source: str,
) -> None:
    """Log a Claude API call to ai_usage_logs."""
    cost = estimate_cost(model, input_tokens, output_tokens)
    try:
        await db.execute(
            """
            INSERT INTO ai_usage_logs (user_id, model, input_tokens, output_tokens, cost_usd, source)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            user_id,
            model,
            input_tokens,
            output_tokens,
            cost,
            source,
        )
    except Exception as exc:
        log.warning("usage.log_failed", error=str(exc), source=source)
