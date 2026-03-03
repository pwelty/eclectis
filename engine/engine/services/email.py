"""Brevo transactional email sender."""

from __future__ import annotations

import httpx
import structlog

from engine.config import settings

log = structlog.get_logger()

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email(
    *,
    to_email: str,
    to_name: str = "",
    subject: str,
    html_body: str,
    from_email: str | None = None,
    from_name: str | None = None,
) -> bool:
    """Send a transactional email via Brevo. Returns True if sent."""
    api_key = settings.brevo_api_key
    if not api_key:
        log.warning("email.brevo.skipped", reason="BREVO_API_KEY not configured")
        return False

    payload = {
        "sender": {
            "name": from_name or settings.briefing_from_name,
            "email": from_email or settings.briefing_from_email,
        },
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_body,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            BREVO_API_URL,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code in (200, 201):
        log.info("email.brevo.sent", to=to_email, subject=subject)
        return True

    log.error("email.brevo.failed", status=resp.status_code, body=resp.text[:500])
    return False
