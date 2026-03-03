"""article.fetch_content / article.batch_fetch — Fetch article content via ScrapingBee + summarize."""

from __future__ import annotations

import json
import re
from uuid import UUID

import html2text
import httpx
import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.services.claude import achat

log = structlog.get_logger()

SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/"
SUMMARY_THRESHOLD = 500
MIN_CONTENT_LENGTH = 200  # Below this, retry with JS rendering


# ── Scraping helpers ─────────────────────────────────────────────────────────


async def _scrape_article(url: str) -> tuple[str, str | None]:
    """Scrape article via ScrapingBee with escalating strategies.

    1. Static HTML (1 credit) -- article > main > body cascade
    2. JS rendering (5 credits) -- if content too short
    3. Premium proxy + JS (10-25 credits) -- ONLY if blocked (403/429)
    """
    extract_rules = json.dumps({
        "article_html": {"selector": "article", "output": "html"},
        "main_html": {"selector": "main", "output": "html"},
        "body_html": {"selector": "body", "output": "html"},
        "title": "title",
    })
    blocked = False

    async with httpx.AsyncClient(timeout=60) as client:
        # Strategy 1: Static HTML
        resp = await client.get(SCRAPINGBEE_URL, params={
            "api_key": settings.scrapingbee_api_key,
            "url": url, "render_js": "false", "block_ads": "true",
            "extract_rules": extract_rules,
        })
        text, page_title = _parse_scrape_response(resp)
        if text and len(text) >= MIN_CONTENT_LENGTH:
            return text, page_title
        if resp.status_code in (403, 429):
            blocked = True

        # Strategy 2: JS rendering (for SPAs / dynamic content)
        if not blocked:
            log.info("article.scrape_escalating", url=url, strategy="js", length=len(text or ""))
            resp = await client.get(SCRAPINGBEE_URL, params={
                "api_key": settings.scrapingbee_api_key,
                "url": url, "render_js": "true", "block_ads": "true",
                "extract_rules": extract_rules,
            })
            text, page_title = _parse_scrape_response(resp)
            if text and len(text) >= MIN_CONTENT_LENGTH:
                return text, page_title
            if resp.status_code in (403, 429):
                blocked = True

        # Strategy 3: Premium proxy -- ONLY when actually blocked
        if blocked:
            log.info("article.scrape_premium_proxy", url=url)
            resp = await client.get(SCRAPINGBEE_URL, params={
                "api_key": settings.scrapingbee_api_key,
                "url": url, "render_js": "true", "block_ads": "true",
                "premium_proxy": "true",
                "extract_rules": extract_rules,
            })
            text, page_title = _parse_scrape_response(resp)
            if text:
                return text, page_title

    return text or "", page_title


def _parse_scrape_response(resp: httpx.Response) -> tuple[str, str | None]:
    """Extract HTML, convert to markdown, return (text, page_title)."""
    if resp.status_code != 200:
        return "", None
    try:
        data = resp.json()
        raw_html = (
            data.get("article_html")
            or data.get("main_html")
            or data.get("body_html")
            or ""
        )
        page_title = (data.get("title") or "").strip()[:255]
        if not raw_html:
            return "", page_title
        text = _html_to_markdown(raw_html)
        return text, page_title
    except (json.JSONDecodeError, ValueError):
        return _clean_text(resp.text), None


def _html_to_markdown(html: str) -> str:
    """Convert HTML to clean markdown using html2text."""
    h = html2text.HTML2Text()
    h.body_width = 0  # No line wrapping
    h.ignore_images = True
    h.ignore_emphasis = False
    h.skip_internal_links = True
    md = h.handle(html)
    # Strip leading nav/menu lines before real content starts
    lines = md.split("\n")
    start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^[*\-+\s]*\[.*?\]\(.*?\)\s*$", stripped):
            start = i + 1
            continue
        if re.match(r"^[←→•|·>»«]\s", stripped):
            start = i + 1
            continue
        if stripped.lower() in ("menu", "search", "skip to content", "close", "toggle navigation"):
            start = i + 1
            continue
        break
    md = "\n".join(lines[start:])
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r"\n +\n", "\n\n", text)
    return text.strip()


# ── Core fetch + summarize ───────────────────────────────────────────────────


async def _fetch_and_summarize(article_id: UUID, user_id: UUID) -> dict:
    """Fetch content via ScrapingBee, summarize with Claude. Returns result dict."""
    article = await db.fetchrow(
        "SELECT id, title, url, content, content_summary FROM articles WHERE id = $1 AND user_id = $2",
        article_id,
        user_id,
    )
    if not article:
        return {"status": "not_found", "article_id": str(article_id)}

    if article["content"] and article["content_summary"]:
        return {"status": "already_fetched", "article_id": str(article_id)}

    if not settings.scrapingbee_api_key:
        return {"status": "no_api_key", "article_id": str(article_id)}

    # Step 1: Fetch content
    content = article["content"]
    title = article["title"]

    if not content:
        # Skip PDFs
        url_lower = (article["url"] or "").lower()
        if url_lower.endswith(".pdf") or "/pdf/" in url_lower:
            return {"status": "skipped_pdf", "article_id": str(article_id)}

        text, page_title = await _scrape_article(article["url"])

        if not text:
            # Store empty content so batch_fetch skips it next time
            await db.execute(
                "UPDATE articles SET content = '' WHERE id = $1",
                article_id,
            )
            return {"status": "no_content", "article_id": str(article_id)}

        content = text[:100_000]
        await db.execute(
            "UPDATE articles SET content = $2 WHERE id = $1",
            article["id"],
            content,
        )

    # Step 2: Summarize if long enough
    summary = article["content_summary"]
    summary_text = None
    if not summary and len(content) > SUMMARY_THRESHOLD:
        prompt = f"""Summarize the following article into 2-3 clear, readable paragraphs.
Focus on the key arguments, findings, or insights. Write in a neutral,
informative tone. Do not use bullet points or headers -- just flowing prose paragraphs.

Article title: {title}

Article text:
{content[:50_000]}"""

        try:
            summary_text, _usage = await achat(
                prompt, max_tokens=1500, model=settings.haiku_model,
            )
            if summary_text:
                await db.execute(
                    "UPDATE articles SET content_summary = $2 WHERE id = $1",
                    article["id"],
                    summary_text,
                )
        except Exception as exc:
            log.warning("article.summarize_error", error=str(exc))

    return {"status": "fetched", "article_id": str(article_id), "has_summary": bool(summary or summary_text)}


# ── Handlers ─────────────────────────────────────────────────────────────────


@register("article.fetch_content")
async def handle_fetch(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    """Fetch content for a single article."""
    raw_id = payload.get("article_id")
    if not raw_id:
        raise ValueError("article_id is required")
    article_id = UUID(raw_id)

    result = await _fetch_and_summarize(article_id, user_id)

    if result["status"] == "not_found":
        raise ValueError(f"Article {article_id} not found")
    if result["status"] == "no_api_key":
        raise ValueError("SCRAPINGBEE_API_KEY not configured")

    return result


@register("article.batch_fetch")
async def handle_batch(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    """Fetch content for unfetched articles, ordered by AI score."""
    limit = payload.get("limit", 20)

    articles = await db.fetch(
        """SELECT id FROM articles
        WHERE user_id = $1 AND content IS NULL AND status = 'to_read'
        ORDER BY ai_score DESC NULLS LAST
        LIMIT $2""",
        user_id,
        limit,
    )

    if not articles:
        return {"fetched": 0, "total": 0}

    fetched = 0
    errors = 0
    for row in articles:
        try:
            result = await _fetch_and_summarize(row["id"], user_id)
            if result["status"] == "fetched":
                fetched += 1
        except Exception as exc:
            errors += 1
            log.warning("article.batch_fetch_error", article_id=str(row["id"]), error=str(exc))

    log.info("article.batch_fetch_done", fetched=fetched, errors=errors, total=len(articles))
    return {"fetched": fetched, "errors": errors, "total": len(articles)}
