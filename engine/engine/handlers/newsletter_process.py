"""newsletter.process — Parse inbound newsletter email, extract links, create articles."""

from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlparse
from uuid import UUID

import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.services.claude import chat, extract_json_array

log = structlog.get_logger()

MAX_LINKS = 20
MIN_SCORE = 6

# Domains to skip (social, shorteners)
SKIP_DOMAINS = {
    "twitter.com", "x.com", "facebook.com", "linkedin.com", "instagram.com",
    "youtube.com", "t.co", "bit.ly", "tinyurl.com",
}
# URL patterns to skip (email chrome, unsubscribe, etc.)
SKIP_PATTERNS = re.compile(
    r"(unsubscribe|manage.preferences|email-settings|optout|opt-out|"
    r"view.in.browser|email\.mg\.|list-manage\.com|mailchimp\.com|"
    r"beehiiv\.com/(subscribe|unsubscribe)|substack\.com/(subscribe|account))",
    re.IGNORECASE,
)


class _LinkExtractor(HTMLParser):
    """Extract (url, text) pairs from HTML."""

    def __init__(self):
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._current_href: str | None = None
        self._current_text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href", "")
            if href and href.startswith(("http://", "https://")):
                self._current_href = href
                self._current_text = []

    def handle_data(self, data):
        if self._current_href is not None:
            self._current_text.append(data.replace("\r", "").strip())

    def handle_endtag(self, tag):
        if tag == "a" and self._current_href:
            text = " ".join(self._current_text).strip()
            if text and len(text) > 2:
                self.links.append((self._current_href, text))
            self._current_href = None
            self._current_text = []


def _extract_links(html: str) -> list[dict]:
    """Extract meaningful article links from newsletter HTML."""
    parser = _LinkExtractor()
    try:
        parser.feed(html)
    except Exception as e:
        log.warning("newsletter.link_extraction.failed", error=str(e))
        return []

    seen_urls: set[str] = set()
    results: list[dict] = []

    for url, text in parser.links:
        # Normalize: strip tracking params and fragments
        url = url.split("?utm_")[0].split("#")[0].rstrip("/")
        if url in seen_urls:
            continue

        parsed = urlparse(url)
        domain = parsed.netloc.lower().removeprefix("www.")
        if domain in SKIP_DOMAINS:
            continue
        if SKIP_PATTERNS.search(url):
            continue
        if len(text) < 5:
            continue

        seen_urls.add(url)
        results.append({"url": url, "title": text[:255]})

        if len(results) >= MAX_LINKS:
            break

    return results


@register("newsletter.process")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    subject = payload.get("subject", "Newsletter")
    html = payload.get("html", "")
    sender = payload.get("from", "")
    feed_id = payload.get("feed_id")

    bound_log = log.bind(user_id=str(user_id), sender=sender)
    bound_log.info("newsletter.processing", subject=subject)

    if not html:
        return {"status": "error", "reason": "No HTML body"}

    if feed_id:
        feed_id = UUID(feed_id) if isinstance(feed_id, str) else feed_id

    # Extract links from newsletter HTML
    links = _extract_links(html)
    bound_log.info("newsletter.links_extracted", count=len(links))

    if not links:
        return {"status": "no_links", "links_found": 0, "saved": 0}

    # Bulk dedup against processed_posts
    all_urls = [link["url"] for link in links]
    already_processed = await db.fetch(
        "SELECT DISTINCT url FROM processed_posts WHERE user_id = $1 AND url = ANY($2)",
        user_id,
        all_urls,
    )
    seen_urls = {r["url"] for r in already_processed}
    new_links = [link for link in links if link["url"] not in seen_urls]

    if not new_links:
        bound_log.info("newsletter.all_seen", total=len(links))
        return {"status": "all_seen", "links_found": len(links), "saved": 0}

    # Get user interests for scoring
    profile = await db.fetchrow("SELECT interests FROM user_profiles WHERE id = $1", user_id)
    interests = (profile["interests"] or "") if profile else ""

    # Build ratings context from votes
    ratings_context = await _build_ratings_context(user_id)

    # Score with Claude
    results, _usage = await asyncio.to_thread(
        _score_with_claude, new_links, interests, ratings_context,
    )

    saved = 0
    for idx, result in enumerate(results):
        score = result.get("score")
        if not score or idx >= len(new_links):
            continue

        post = new_links[idx]

        # Save high-scoring articles
        if score >= MIN_SCORE:
            try:
                await db.execute(
                    """
                    INSERT INTO articles (user_id, feed_id, title, url, source, content_type,
                                          ai_score, ai_reason, tags, status, published_at, found_at)
                    VALUES ($1, $2, $3, $4, 'newsletter', 'newsletter', $5, $6, $7, 'to_read', NOW(), NOW())
                    ON CONFLICT (user_id, url) DO NOTHING
                    """,
                    user_id,
                    feed_id,
                    post["title"],
                    post["url"],
                    score,
                    result.get("reason"),
                    json.dumps(result.get("tags", [])),
                )
                saved += 1
            except Exception as exc:
                log.warning("newsletter.save_error", url=post["url"], error=str(exc))

        # Mark as processed
        await db.execute(
            """
            INSERT INTO processed_posts (user_id, url, saved, processed_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, url) DO NOTHING
            """,
            user_id,
            post["url"],
            score >= MIN_SCORE,
        )

    # Auto-queue article.batch_fetch if we saved articles
    if saved > 0:
        await db.execute(
            """
            INSERT INTO commands (type, user_id, payload, idempotency_key)
            VALUES ('article.batch_fetch', $1, '{"limit": 20}', $2)
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            user_id,
            f"newsletter-fetch-{user_id}-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        )

    bound_log.info("newsletter.done", links_found=len(links), new=len(new_links), saved=saved)
    return {"links_found": len(links), "new": len(new_links), "saved": saved}


def _score_with_claude(posts: list[dict], interests: str, ratings_context: str) -> tuple[list[dict], dict]:
    """Score newsletter links for relevance using Claude."""
    posts_text = "\n".join(
        f"{i + 1}. Title: {p['title']} | URL: {p['url']}"
        for i, p in enumerate(posts)
    )

    prompt = f"""You are filtering links extracted from email newsletters for relevance to specific interests.

INTERESTS:
{interests or "General technology and business"}

{ratings_context}

LINKS TO EVALUATE:
{posts_text}

Score EVERY link for relevance. Return a JSON array with EXACTLY {len(posts)} elements, one per link, in the SAME ORDER. Each element:
- "score": relevance score 1-10
- "reason": brief explanation (1-2 sentences)
- "tags": array of up to 3 topic tags

Return ONLY the JSON array."""

    try:
        text, usage = chat(prompt, max_tokens=4000, model=settings.haiku_model)
        results = extract_json_array(text)
        return results, usage
    except Exception as exc:
        log.error("newsletter.claude_error", error=str(exc))
        return [], {}


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
