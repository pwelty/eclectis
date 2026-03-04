"""Text cleaning utilities for article titles and summaries."""

from __future__ import annotations

import re

# Separators used by sites to append their name to titles
_TITLE_SEPARATORS = re.compile(r" (?:\||-|::) ")

# Control characters (< 0x20) except tab/newline/carriage-return
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

# Collapse whitespace (spaces, tabs, newlines) into a single space
_WHITESPACE = re.compile(r"\s+")

MAX_TITLE_LEN = 255
MAX_SUMMARY_LEN = 500
MAX_CONTENT_LEN = 100_000


def clean_title(title: str | None) -> str:
    """Clean an article title.

    - Strip control characters
    - Normalize whitespace
    - Remove trailing site-name suffixes like " | Site Name"
    - Truncate to 255 chars
    """
    if not title:
        return "Untitled"

    text = _CONTROL_CHARS.sub("", title)
    text = _WHITESPACE.sub(" ", text).strip()

    if not text:
        return "Untitled"

    # Strip trailing site name suffix. We split on the *last* occurrence of
    # a separator and drop the suffix only if it looks like a short site name
    # (< 40 chars). We also keep the left side only if it's non-empty.
    for sep in (" | ", " - ", " :: "):
        idx = text.rfind(sep)
        if idx > 0:
            left = text[:idx].strip()
            right = text[idx + len(sep) :].strip()
            if left and len(right) < 40:
                text = left
                break

    return text[:MAX_TITLE_LEN]


def clean_summary(summary: str | None) -> str | None:
    """Clean an article summary/content snippet.

    - Strip control characters
    - Normalize whitespace
    - Truncate to 500 chars (with ellipsis)
    """
    if summary is None:
        return None

    text = _CONTROL_CHARS.sub("", summary)
    text = _WHITESPACE.sub(" ", text).strip()

    if not text:
        return None

    if len(text) > MAX_SUMMARY_LEN:
        return text[: MAX_SUMMARY_LEN - 1] + "\u2026"

    return text


def clean_content(content: str | None) -> str | None:
    """Clean article body content.

    - Strip control characters
    - Truncate to 100k chars
    Returns None if input is None or empty after cleaning.
    """
    if content is None:
        return None

    text = _CONTROL_CHARS.sub("", content)
    text = text.strip()

    if not text:
        return None

    return text[:MAX_CONTENT_LEN]
