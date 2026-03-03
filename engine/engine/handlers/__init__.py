"""Handler registry -- maps command types to async handler functions."""

from __future__ import annotations

from typing import Awaitable, Callable

HandlerFn = Callable[..., Awaitable[dict | None]]

_registry: dict[str, HandlerFn] = {}


def register(command_type: str):
    """Decorator to register a handler for a command type."""

    def decorator(fn: HandlerFn) -> HandlerFn:
        _registry[command_type] = fn
        return fn

    return decorator


def get_handler(command_type: str) -> HandlerFn | None:
    return _registry.get(command_type)


# Import all handler modules so they self-register
from engine.handlers import ping  # noqa: E402, F401
from engine.handlers import rss_scan  # noqa: E402, F401
from engine.handlers import google_search_scan  # noqa: E402, F401
from engine.handlers import article_fetch  # noqa: E402, F401
from engine.handlers import briefing_generate  # noqa: E402, F401
