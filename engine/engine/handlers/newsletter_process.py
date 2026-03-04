"""newsletter.process — Parse inbound newsletter, detect type, queue article.add.

Detects whether the newsletter is a content newsletter (the body IS the article)
or a link newsletter (a roundup/digest with links to external articles). Then
queues article.add for each article found — no scoring or fetching here.
"""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from urllib.parse import urlparse
from uuid import UUID

import html2text
import structlog

from engine import db
from engine.handlers import register
from engine.url import normalize_url

log = structlog.get_logger()

MAX_LINKS = 20
CONTENT_LINK_THRESHOLD = 3   # <= this many links may indicate content newsletter
CONTENT_WORD_THRESHOLD = 200  # must have >= this many words to be content

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


# ── HTML parsing helpers ─────────────────────────────────────────────────────


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
        # Normalize URL using shared utility
        url = normalize_url(url)
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


def _html_to_text(html: str) -> str:
    """Convert newsletter HTML to clean plain text."""
    h = html2text.HTML2Text()
    h.body_width = 0
    h.ignore_images = True
    h.ignore_links = True
    h.ignore_emphasis = False
    text = h.handle(html)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _detect_newsletter_type(html: str, links: list[dict]) -> str:
    """Detect whether a newsletter is 'content' or 'links'.

    Content newsletter: few outbound links, substantial body text.
    Link newsletter: many outbound links, short intros between them.
    """
    plain_text = _html_to_text(html)
    word_count = len(plain_text.split())

    if len(links) <= CONTENT_LINK_THRESHOLD and word_count >= CONTENT_WORD_THRESHOLD:
        return "content"
    return "links"


# ── Handler ──────────────────────────────────────────────────────────────────


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

    # Classify newsletter
    links = _extract_links(html)
    newsletter_type = _detect_newsletter_type(html, links)
    bound_log.info("newsletter.classified", type=newsletter_type, links=len(links))

    queued = 0

    if newsletter_type == "content":
        # The newsletter IS the article — queue article.add with body content
        plain_text = _html_to_text(html)
        await db.execute(
            """
            INSERT INTO commands (type, user_id, payload)
            VALUES ('article.add', $1, $2)
            """,
            user_id,
            json.dumps({
                "title": subject,
                "content": plain_text[:100_000],
                "source": "newsletter",
                "feed_id": feed_id,
                "content_type": "newsletter",
            }),
        )
        queued = 1
    else:
        # Link newsletter — queue article.add for each extracted link
        for link in links:
            await db.execute(
                """
                INSERT INTO commands (type, user_id, payload)
                VALUES ('article.add', $1, $2)
                """,
                user_id,
                json.dumps({
                    "url": link["url"],
                    "title": link["title"],
                    "source": "newsletter",
                    "feed_id": feed_id,
                    "content_type": "article",
                }),
            )
            queued += 1

    bound_log.info("newsletter.done", type=newsletter_type, queued=queued)
    return {"type": newsletter_type, "links_found": len(links), "queued": queued}
