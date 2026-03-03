"""Server-side PostHog analytics for engine events."""

from __future__ import annotations

from uuid import UUID

import structlog

from engine.config import settings

log = structlog.get_logger()

_posthog = None


def _get_client():
    """Lazily initialise the PostHog client."""
    global _posthog
    if _posthog is not None:
        return _posthog

    if not settings.posthog_api_key:
        return None

    try:
        from posthog import Posthog

        _posthog = Posthog(
            settings.posthog_api_key,
            host=settings.posthog_host,
        )
        return _posthog
    except Exception:
        log.warning("posthog.init_failed", exc_info=True)
        return None


def track(user_id: UUID | str, event: str, properties: dict | None = None) -> None:
    """Capture a server-side event. No-ops if PostHog is not configured."""
    client = _get_client()
    if client is None:
        return

    try:
        client.capture(
            distinct_id=str(user_id),
            event=event,
            properties=properties or {},
        )
    except Exception:
        log.warning("posthog.capture_failed", event=event, exc_info=True)


def shutdown() -> None:
    """Flush and close the PostHog client."""
    global _posthog
    if _posthog is not None:
        try:
            _posthog.shutdown()
        except Exception:
            pass
        _posthog = None
