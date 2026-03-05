"""briefing.generate — Generate and send a daily email briefing."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone, timedelta
from uuid import UUID

import structlog

from engine import db
from engine.config import settings
from engine.handlers import register
from engine.services.byok import resolve_api_key
from engine.services.claude import chat, extract_json_object
from engine.services.email import send_email
from engine.services.usage import log_usage

log = structlog.get_logger()

LOOKBACK_HOURS = 48
MAX_ARTICLES = 15
MIN_ARTICLES = 3


@register("briefing.generate")
async def handle(*, command_id: UUID, payload: dict, user_id: UUID) -> dict:
    bound_log = log.bind(user_id=str(user_id))
    bound_log.info("briefing.starting")

    lookback_hours = payload.get("lookback_hours", LOOKBACK_HOURS)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)

    # Fetch top articles
    articles = await db.fetch(
        """
        SELECT id, title, url, summary, content_summary, ai_score, ai_reason, tags, source, content_type
        FROM articles
        WHERE user_id = $1 AND ai_score >= 6 AND found_at >= $2
        ORDER BY ai_score DESC
        LIMIT $3
        """,
        user_id,
        cutoff,
        MAX_ARTICLES,
    )

    if len(articles) < MIN_ARTICLES:
        bound_log.info("briefing.not_enough_articles", count=len(articles))
        return {"status": "skipped", "reason": f"Only {len(articles)} articles (need {MIN_ARTICLES})"}

    # Get user info
    from engine.user_context import get_user_context, format_preferences_block
    profile = await db.fetchrow("SELECT name FROM user_profiles WHERE id = $1", user_id)
    user_email_row = await db.fetchrow("SELECT email FROM auth.users WHERE id = $1", user_id)

    if not user_email_row:
        return {"status": "error", "reason": "User not found"}

    user_name = (profile["name"] or "").strip() if profile else ""
    user_email = user_email_row["email"]
    interests, learned = await get_user_context(user_id)
    preferences_block = format_preferences_block(interests, learned)

    # Build article context for Claude
    articles_text = []
    for i, a in enumerate(articles):
        summary = a["content_summary"] or a["summary"] or a["ai_reason"] or ""
        tags = json.loads(a["tags"]) if isinstance(a["tags"], str) else (a["tags"] or [])
        tag_str = ", ".join(tags[:3]) if tags else ""
        prefix = "[Podcast] " if a["content_type"] == "podcast" else ""
        articles_text.append(
            f"{i+1}. {prefix}{a['title']} (score: {a['ai_score']}/10)\n"
            f"   URL: {a['url']}\n"
            f"   Summary: {summary[:300]}\n"
            f"   Tags: {tag_str}"
        )

    # Resolve API key (BYOK gating)
    api_key = await resolve_api_key(user_id)

    # Generate briefing with Claude
    briefing_data, briefing_usage = await asyncio.to_thread(
        _generate_briefing,
        "\n\n".join(articles_text),
        preferences_block,
        user_name,
        len(articles),
        api_key,
    )
    if briefing_usage:
        await log_usage(
            user_id=user_id,
            model=briefing_usage.get("model", settings.haiku_model),
            input_tokens=briefing_usage.get("input_tokens", 0),
            output_tokens=briefing_usage.get("output_tokens", 0),
            source="briefing_generate",
        )

    if not briefing_data:
        return {"status": "error", "reason": "Claude failed to generate briefing"}

    subject = briefing_data.get("subject", "Your daily briefing")
    html = _render_html(briefing_data, articles, user_name)

    # Store briefing
    briefing_id = await db.fetchval(
        "INSERT INTO briefings (user_id, html) VALUES ($1, $2) RETURNING id",
        user_id,
        html,
    )

    # Send email
    sent = await send_email(
        to_email=user_email,
        to_name=user_name,
        subject=subject,
        html_body=html,
    )

    if sent:
        await db.execute(
            "UPDATE briefings SET sent_at = NOW() WHERE id = $1",
            briefing_id,
        )

    bound_log.info("briefing.done", briefing_id=str(briefing_id), sent=sent, articles=len(articles))
    return {"briefing_id": str(briefing_id), "sent": sent, "articles": len(articles)}


def _generate_briefing(articles_text: str, preferences_block: str, user_name: str, article_count: int, api_key: str | None = None) -> tuple[dict | None, dict]:
    greeting = f"Hi {user_name}" if user_name else "Hi"

    prompt = f"""Generate a daily intelligence briefing email from these curated articles.

{preferences_block}

ARTICLES:
{articles_text}

Create a briefing with:
1. A compelling email subject line (short, specific to today's themes — not generic)
2. A brief intro (1-2 sentences, {greeting} tone, mention how many articles were curated)
3. 2-4 themed sections grouping related articles. Each section has:
   - A section heading (theme name)
   - A 2-3 sentence summary of the theme
   - Then EVERY article in the section listed individually with its title as a clickable link to the original source URL, plus a 1-sentence takeaway. Never omit article links — every article must appear as its own linked entry.
4. A brief closing line

Return a JSON object:
{{
  "subject": "...",
  "intro": "...",
  "sections": [
    {{
      "heading": "Theme name",
      "summary": "2-3 sentence overview of this theme.",
      "items": [
        {{"title": "Article title", "url": "https://...", "takeaway": "One sentence."}}
      ]
    }}
  ],
  "closing": "..."
}}

Return ONLY the JSON object."""

    try:
        text, usage = chat(prompt, max_tokens=4000, model=settings.haiku_model, api_key=api_key)
        return extract_json_object(text), usage
    except Exception as exc:
        log.error("briefing.claude_error", error=str(exc))
        return None, {}


def _render_html(data: dict, articles: list, user_name: str) -> str:
    """Render briefing data into a clean HTML email."""
    sections_html = ""
    for section in data.get("sections", []):
        items_html = ""
        for item in section.get("items", []):
            items_html += f"""
            <tr>
              <td style="padding: 8px 0;">
                <a href="{item.get('url', '#')}" style="color: #d97706; text-decoration: none; font-weight: 500;">{item.get('title', 'Untitled')}</a>
                <br><span style="color: #64748b; font-size: 14px;">{item.get('takeaway', '')}</span>
              </td>
            </tr>"""

        summary_html = ""
        if section.get("summary"):
            summary_html = f"""
        <tr>
          <td style="padding: 4px 0 8px 0;">
            <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">{section['summary']}</p>
          </td>
        </tr>"""

        sections_html += f"""
        <tr>
          <td style="padding: 20px 0 8px 0;">
            <h2 style="margin: 0; font-size: 18px; color: #1e293b; font-weight: 600;">{section.get('heading', '')}</h2>
          </td>
        </tr>{summary_html}
        <tr>
          <td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              {items_html}
            </table>
          </td>
        </tr>"""

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="https://www.eclectis.io" style="text-decoration: none;">
                      <img src="https://www.eclectis.io/icon.png" alt="" width="28" height="28" style="vertical-align: middle; border-radius: 6px; margin-right: 10px;" />
                      <span style="color: #ffffff; font-size: 20px; font-weight: 600; vertical-align: middle;">Eclectis</span>
                    </a>
                  </td>
                  <td align="right" style="color: #94a3b8; font-size: 13px;">{today}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Intro -->
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              <p style="margin: 0; color: #334155; font-size: 16px; line-height: 1.6;">{data.get('intro', '')}</p>
            </td>
          </tr>
          <!-- Sections -->
          <tr>
            <td style="padding: 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                {sections_html}
              </table>
            </td>
          </tr>
          <!-- Closing -->
          <tr>
            <td style="padding: 24px 32px 32px 32px;">
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">{data.get('closing', '')}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                Curated by <a href="https://eclectis.io" style="color: #d97706; text-decoration: none;">Eclectis</a> — your intelligence layer
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
