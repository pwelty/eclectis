"""google_search.scan — Search via Serper.dev (Google SERP API), filter with Claude, save articles."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import UUID

import httpx
import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.services.byok import resolve_api_key
from engine.services.claude import chat, extract_json_object
from engine.services.usage import log_usage
from engine.url import normalize_url

log = structlog.get_logger()

MAX_RESULTS = 10
MIN_SCORE = 6
SERPER_ENDPOINT = "https://google.serper.dev/search"


@register("google_search.scan")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    if not settings.serper_api_key:
        log.warning("google_search.no_credentials")
        return {"error": "Serper API key not configured"}

    min_score = payload.get("min_score", MIN_SCORE)

    # Read search terms from search_terms table
    term_rows = await db.fetch(
        "SELECT term FROM search_terms WHERE user_id = $1 AND active = TRUE",
        user_id,
    )
    queries = [r["term"].strip() for r in term_rows if r["term"].strip()]

    if not queries:
        log.info("google_search.no_search_terms", user_id=str(user_id))
        return {"error": "No search terms configured"}

    # Create scan log
    scan_log_id = await db.fetchval(
        "INSERT INTO scan_logs (user_id) VALUES ($1) RETURNING id",
        user_id,
    )

    # Search each term, deduplicate by URL
    all_results: list[dict] = []
    seen_urls: set[str] = set()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for query in queries:
                try:
                    results = await search_google(client, query)
                    for r in results:
                        if r["url"] not in seen_urls:
                            seen_urls.add(r["url"])
                            all_results.append(r)
                    log.info("google_search.query_done", query=query[:80], results=len(results))
                except Exception as exc:
                    log.warning("google_search.query_error", query=query[:80], error=str(exc))
    except Exception as exc:
        log.warning("google_search.api_error", error=str(exc))
        return {"error": str(exc)}

    # Bulk dedup against processed_posts and articles
    if all_results:
        all_urls = [r["url"] for r in all_results]
        seen_processed = await db.fetch(
            "SELECT DISTINCT url FROM processed_posts WHERE user_id = $1 AND url = ANY($2)",
            user_id, all_urls,
        )
        seen_articles = await db.fetch(
            "SELECT DISTINCT url FROM articles WHERE user_id = $1 AND url = ANY($2)",
            user_id, all_urls,
        )
        existing_urls = {r["url"] for r in seen_processed} | {r["url"] for r in seen_articles}
        new_results = [r for r in all_results if r["url"] not in existing_urls]
    else:
        new_results = []

    log.info("google_search.results", total=len(all_results), new=len(new_results))

    if not new_results:
        await db.execute(
            "UPDATE scan_logs SET feeds_scanned = 1, posts_found = $2, posts_saved = 0, tokens_used = 0 WHERE id = $1",
            scan_log_id, len(all_results),
        )
        return {"scan_log_id": str(scan_log_id), "posts_found": len(all_results), "posts_saved": 0}

    # Resolve API key (BYOK gating)
    api_key = await resolve_api_key(user_id)

    # Build scoring context
    from engine.user_context import get_user_context, format_preferences_block
    interests, learned = await get_user_context(user_id)
    preferences_block = format_preferences_block(interests, learned)
    ratings_context = await _build_ratings_context(user_id)

    # AI filter — score each result individually
    total_tokens = 0
    saved_count = 0

    for post_data in new_results:
        scored, usage = await asyncio.to_thread(score_single_result, post_data, preferences_block, ratings_context, api_key)
        total_tokens += usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        if usage:
            await log_usage(
                user_id=user_id,
                model=usage.get("model", settings.haiku_model),
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                source="google_search_scan",
            )

        score = scored.get("score") if scored else None
        reason = scored.get("reason") if scored else None
        tags = scored.get("tags", []) if scored else []

        if score and score >= min_score:
            try:
                await db.execute(
                    """
                    INSERT INTO articles (user_id, title, url, summary, ai_score, ai_reason, tags, source, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'google_search', 'to_read')
                    ON CONFLICT (user_id, url) DO NOTHING
                    """,
                    user_id,
                    post_data["title"],
                    post_data["url"],
                    post_data.get("snippet"),
                    score,
                    reason,
                    json.dumps(tags),
                )
                saved_count += 1
            except Exception as exc:
                log.warning("google_search.save_error", url=post_data["url"], error=str(exc))

        # Mark as processed
        try:
            await db.execute(
                """
                INSERT INTO processed_posts (user_id, url, saved, processed_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, url) DO NOTHING
                """,
                user_id,
                post_data["url"],
                bool(score and score >= min_score),
            )
        except Exception as e:
            log.warning("google_search.mark_processed.failed", url=post_data["url"], error=str(e))

    # Update scan log
    await db.execute(
        "UPDATE scan_logs SET feeds_scanned = 1, posts_found = $2, posts_saved = $3, tokens_used = $4 WHERE id = $1",
        scan_log_id, len(all_results), saved_count, total_tokens,
    )

    # Auto-chain: queue batch fetch for high-scoring articles
    if saved_count > 0:
        window = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")
        try:
            await db.execute(
                """
                INSERT INTO commands (type, payload, user_id, idempotency_key)
                VALUES ('article.batch_fetch', $1, $2, $3)
                ON CONFLICT (idempotency_key) DO NOTHING
                """,
                json.dumps({}),
                user_id,
                f"auto:article.batch_fetch:{user_id}:{window}",
            )
            log.info("google_search.batch_fetch_queued", user_id=str(user_id))
        except Exception as exc:
            log.warning("google_search.batch_fetch_queue.failed", error=str(exc))

    return {"scan_log_id": str(scan_log_id), "posts_found": len(all_results), "posts_saved": saved_count}


async def search_google(client: httpx.AsyncClient, query: str) -> list[dict]:
    """Execute a search via Serper.dev (Google SERP API)."""
    resp = await client.post(
        SERPER_ENDPOINT,
        headers={
            "X-API-KEY": settings.serper_api_key,
            "Content-Type": "application/json",
        },
        json={"q": query, "num": MAX_RESULTS},
    )
    resp.raise_for_status()
    data = resp.json()

    results = []
    for item in data.get("organic", []):
        url = item.get("link")
        title = item.get("title", "").strip()
        if not url or not title:
            continue
        url = normalize_url(url)
        results.append({
            "title": title[:255],
            "url": url,
            "snippet": (item.get("snippet") or "").strip()[:2000],
            "source_domain": _extract_domain(url),
        })

    return results


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def score_single_result(result: dict, preferences_block: str, ratings_context: str, api_key: str | None = None) -> tuple[dict | None, dict]:
    prompt = f"""Score this search result for relevance to the user's preferences.

{preferences_block}

{ratings_context}

RESULT:
Title: {result['title']}
URL: {result['url']}
Source: {result.get('source_domain', '')}
Snippet: {result.get('snippet', 'N/A')}

Return a JSON object with:
- "score": relevance score 1-10
- "reason": brief explanation (1 sentence)
- "tags": array of up to 5 topic tags

Return ONLY the JSON object, no other text."""

    try:
        text, usage = chat(prompt, max_tokens=300, model=settings.haiku_model, api_key=api_key)
        return extract_json_object(text), usage
    except Exception as exc:
        log.warning("google_search.score_error", title=result["title"][:60], error=str(exc))
        return None, {}


async def _build_ratings_context(user_id: UUID) -> str:
    liked = await db.fetch(
        """
        SELECT a.title FROM votes v
        JOIN articles a ON a.id = v.article_id
        WHERE v.user_id = $1 AND v.direction = 'thumbs_up'
        ORDER BY v.updated_at DESC LIMIT 20
        """,
        user_id,
    )
    disliked = await db.fetch(
        """
        SELECT a.title FROM votes v
        JOIN articles a ON a.id = v.article_id
        WHERE v.user_id = $1 AND v.direction = 'thumbs_down'
        ORDER BY v.updated_at DESC LIMIT 20
        """,
        user_id,
    )
    if not liked and not disliked:
        return ""

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
