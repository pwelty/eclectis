"""article.score — Score an article against user interests + vote history.

Runs after content is available (either from article.fetch or from a content
article that arrived with its body). Uses Claude Haiku for cost-optimized scoring.
"""

from __future__ import annotations

import asyncio
import json
from uuid import UUID

import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.services.byok import resolve_api_key
from engine.services.claude import chat, extract_json_object
from engine.services.usage import log_usage

log = structlog.get_logger()


@register("article.score")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    raw_id = payload.get("article_id")
    if not raw_id:
        raise ValueError("article_id is required")
    article_id = UUID(raw_id)

    bound_log = log.bind(user_id=str(user_id), article_id=str(article_id))

    # Load article
    article = await db.fetchrow(
        """SELECT id, title, url, content, content_summary, ai_score
           FROM articles WHERE id = $1 AND user_id = $2""",
        article_id, user_id,
    )
    if not article:
        raise ValueError(f"Article {article_id} not found")

    if article["ai_score"] is not None:
        return {"status": "already_scored", "article_id": str(article_id), "score": article["ai_score"]}

    # Get user interests
    profile = await db.fetchrow("SELECT interests FROM user_profiles WHERE id = $1", user_id)
    interests = (profile["interests"] or "") if profile else ""

    # Build vote history context
    ratings_context = await _build_ratings_context(user_id)

    # Resolve API key (BYOK gating)
    api_key = await resolve_api_key(user_id)

    # Use summary if available, otherwise truncated content
    article_text = article["content_summary"] or (article["content"] or "")[:10_000]

    prompt = f"""Score this article for relevance to the user's interests.

USER INTERESTS:
{interests or "General technology and business"}

{ratings_context}

ARTICLE:
Title: {article["title"]}
URL: {article["url"]}

Content:
{article_text}

Score from 1-10 where 10 = extremely relevant to the user's interests.
Return a JSON object with:
- "score": integer 1-10
- "reason": brief explanation (1-2 sentences)
- "tags": array of up to 3 topic tags

Return ONLY the JSON object."""

    text, usage = await asyncio.to_thread(
        chat, prompt, max_tokens=500, model=settings.haiku_model, api_key=api_key,
    )
    if usage:
        await log_usage(
            user_id=user_id,
            model=usage.get("model", settings.haiku_model),
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            source="article_score",
        )

    result = extract_json_object(text)
    if not result:
        bound_log.warning("article.score.parse_failed", text=text[:200])
        raise ValueError("Failed to parse scoring response from Claude")

    score = result.get("score", 0)
    reason = result.get("reason", "")
    tags = result.get("tags", [])

    await db.execute(
        "UPDATE articles SET ai_score = $2, ai_reason = $3, tags = $4 WHERE id = $1",
        article_id, score, reason, json.dumps(tags),
    )

    bound_log.info("article.score.done", score=score)
    return {"status": "scored", "article_id": str(article_id), "score": score, "reason": reason}


async def _build_ratings_context(user_id: UUID) -> str:
    """Build context from user's article votes for better scoring."""
    rows = await db.fetch(
        """
        SELECT a.title, v.direction
        FROM votes v JOIN articles a ON a.id = v.article_id
        WHERE v.user_id = $1
        ORDER BY v.created_at DESC LIMIT 20
        """,
        user_id,
    )
    if not rows:
        return ""

    liked = [r for r in rows if r["direction"] == "thumbs_up"]
    disliked = [r for r in rows if r["direction"] == "thumbs_down"]

    parts = ["\nLEARN FROM THESE USER RATINGS:"]
    if liked:
        parts.append("\nARTICLES THE USER LIKED:")
        for a in liked:
            parts.append(f'- "{a["title"]}"')
    if disliked:
        parts.append("\nARTICLES THE USER DISLIKED:")
        for a in disliked:
            parts.append(f'- "{a["title"]}"')
    return "\n".join(parts)
