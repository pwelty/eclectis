"""Utility to strip HTML tags and decode entities from text content."""

from __future__ import annotations

import re
from html import unescape


# Matches HTML tags including comments like <!-- SC_OFF -->
_HTML_TAG_RE = re.compile(r"<[^>]+>|<!--.*?-->", re.DOTALL)


def strip_html(text: str | None) -> str | None:
    """Strip HTML tags and decode HTML entities from text.

    Returns None if input is None. Handles:
    - HTML tags (open, close, self-closing)
    - HTML comments (<!-- ... -->)
    - HTML entities (&amp; &lt; &#123; etc.)
    - Nested HTML structures
    - Script/style tag contents
    """
    if text is None:
        return None

    # Remove script and style elements entirely (content + tags)
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", text, flags=re.DOTALL | re.IGNORECASE)

    # Remove all HTML tags and comments
    text = _HTML_TAG_RE.sub("", text)

    # Decode HTML entities (&amp; -> &, etc.)
    text = unescape(text)

    # Collapse excessive whitespace but preserve single newlines
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
