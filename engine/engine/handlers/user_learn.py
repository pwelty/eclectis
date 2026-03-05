"""user.learn — Analyze engagement signals and update learned_preferences.

Runs on the user's briefing cadence. Queries recent engagement events,
asks Claude to synthesize preference insights, stores the result.
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


def _build_learning_prompt(
    *,
    events: list[dict],
    current_interests: str,
    current_learned: str,
) -> str | None:
    """Build the prompt for Claude to analyze engagement signals.

    Returns None if there are no events to learn from.
    """
    if not events:
        return None

    liked = [e for e in events if e["event_type"] == "vote_up"]
    disliked = [e for e in events if e["event_type"] == "vote_down"]
    bookmarked = [e for e in events if e["event_type"] == "bookmark"]
    clicked = [e for e in events if e["event_type"] == "click"]

    sections = []

    if liked:
        items = "\n".join(f'- "{e["title"]}" (tags: {", ".join(e.get("tags", []))})' for e in liked)
        sections.append(f"ARTICLES THE USER LIKED:\n{items}")

    if disliked:
        items = "\n".join(f'- "{e["title"]}" (tags: {", ".join(e.get("tags", []))})' for e in disliked)
        sections.append(f"ARTICLES THE USER DISLIKED:\n{items}")

    if bookmarked:
        items = "\n".join(f'- "{e["title"]}" (tags: {", ".join(e.get("tags", []))})' for e in bookmarked)
        sections.append(f"ARTICLES THE USER BOOKMARKED:\n{items}")

    if clicked:
        items = "\n".join(f'- "{e["title"]}"' for e in clicked)
        sections.append(f"ARTICLES THE USER CLICKED:\n{items}")

    if not sections:
        return None

    signals = "\n\n".join(sections)

    learned_section = ""
    if current_learned:
        learned_section = f"""
CURRENT LEARNED PREFERENCES (from previous analysis):
{current_learned}

Update these based on the new signals below. Keep what's still true, revise what's changed."""

    return f"""Analyze this user's recent engagement to understand their content preferences.

USER'S STATED INTERESTS:
{current_interests or "Not specified"}
{learned_section}

RECENT ENGAGEMENT SIGNALS:
{signals}

Based on these signals, produce two outputs:

1. A concise paragraph (3-5 sentences) describing what this user actually values in content — beyond what they've explicitly stated. Focus on:
   - Topics and subtopics they gravitate toward
   - Content style preferences (deep technical vs. high-level, tutorials vs. analysis, etc.)
   - Source preferences (which publications, blogs, or types of sources they favor)
   - What they actively avoid or dislike
   - Any patterns in what they bookmark vs. just click

2. A list of 3-8 Google search queries that would find more content this user would love. Be specific — use the topics, terminology, and angles that match their demonstrated preferences. Include a mix of broad and narrow queries.

Return ONLY a JSON object:
{{"learned_preferences": "Your paragraph here.", "search_terms": ["query 1", "query 2", ...]}}"""


@register("user.learn")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    bound_log = log.bind(user_id=str(user_id))

    profile = await db.fetchrow(
        "SELECT interests, learned_preferences, last_learned_at FROM user_profiles WHERE id = $1",
        user_id,
    )
    if not profile:
        return {"status": "error", "reason": "User not found"}

    last_learned = profile["last_learned_at"]
    if last_learned:
        rows = await db.fetch(
            """
            SELECT e.event_type, a.title, a.tags
            FROM engagement_events e
            LEFT JOIN articles a ON a.id = e.article_id
            WHERE e.user_id = $1 AND e.created_at > $2
            ORDER BY e.created_at DESC
            LIMIT 100
            """,
            user_id, last_learned,
        )
    else:
        rows = await db.fetch(
            """
            SELECT e.event_type, a.title, a.tags
            FROM engagement_events e
            LEFT JOIN articles a ON a.id = e.article_id
            WHERE e.user_id = $1
            ORDER BY e.created_at DESC
            LIMIT 100
            """,
            user_id,
        )

    events = []
    for r in rows:
        tags = r["tags"]
        if isinstance(tags, str):
            tags = json.loads(tags)
        events.append({
            "event_type": r["event_type"],
            "title": r["title"] or "Untitled",
            "tags": tags or [],
        })

    prompt = _build_learning_prompt(
        events=events,
        current_interests=profile["interests"] or "",
        current_learned=profile["learned_preferences"] or "",
    )

    if not prompt:
        bound_log.info("user.learn.no_events")
        return {"status": "skipped", "reason": "No new engagement events"}

    api_key = await resolve_api_key(user_id)
    text, usage = await asyncio.to_thread(
        chat, prompt, max_tokens=500, model=settings.haiku_model, api_key=api_key,
    )
    if usage:
        await log_usage(
            user_id=user_id,
            model=usage.get("model", settings.haiku_model),
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            source="user_learn",
        )

    result = extract_json_object(text)
    if not result or not result.get("learned_preferences"):
        bound_log.warning("user.learn.parse_failed", text=text[:200])
        return {"status": "error", "reason": "Failed to parse learning response"}

    learned = result["learned_preferences"]

    await db.execute(
        "UPDATE user_profiles SET learned_preferences = $2, last_learned_at = NOW() WHERE id = $1",
        user_id, learned,
    )

    # Auto-populate search terms from learned preferences
    search_terms = result.get("search_terms", [])
    terms_added = 0
    if search_terms:
        # Deactivate old learned terms, then insert new ones
        await db.execute(
            "UPDATE search_terms SET active = FALSE WHERE user_id = $1 AND source = 'learned'",
            user_id,
        )
        for term in search_terms:
            term = term.strip()
            if not term:
                continue
            try:
                await db.execute(
                    """INSERT INTO search_terms (user_id, term, source, active)
                       VALUES ($1, $2, 'learned', TRUE)
                       ON CONFLICT (user_id, term) DO UPDATE SET active = TRUE, source = 'learned'""",
                    user_id, term,
                )
                terms_added += 1
            except Exception as exc:
                bound_log.warning("user.learn.term_insert_failed", term=term[:80], error=str(exc))

    bound_log.info("user.learn.done", events_analyzed=len(events), learned_len=len(learned), terms_added=terms_added)
    return {"status": "learned", "events_analyzed": len(events), "terms_added": terms_added}
