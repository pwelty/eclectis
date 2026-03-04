"""Tests for RSS feed encoding handling (issue #58).

Verifies that feedparser receives raw bytes and handles various encodings correctly.
"""

from __future__ import annotations

import feedparser
import pytest

from engine.handlers.rss_scan import _ensure_str


# -- _ensure_str helper -------------------------------------------------------


def test_ensure_str_with_str():
    assert _ensure_str("hello") == "hello"


def test_ensure_str_with_utf8_bytes():
    assert _ensure_str("caf\u00e9".encode("utf-8")) == "caf\u00e9"


def test_ensure_str_with_latin1_bytes():
    # Latin-1 bytes that are NOT valid UTF-8 -> replacement chars
    raw = "caf\u00e9".encode("latin-1")
    result = _ensure_str(raw)
    assert isinstance(result, str)
    assert "caf" in result


def test_ensure_str_empty():
    assert _ensure_str("") == ""
    assert _ensure_str(b"") == ""


# -- feedparser with bytes (the core fix) ------------------------------------

_UTF8_FEED = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Caf\xc3\xa9 culture in Paris</title>
      <link>https://example.com/cafe</link>
      <description>A guide to caf\xc3\xa9s.</description>
    </item>
  </channel>
</rss>"""

_LATIN1_FEED = b"""<?xml version="1.0" encoding="ISO-8859-1"?>
<rss version="2.0">
  <channel>
    <title>Latin-1 Feed</title>
    <item>
      <title>Caf\xe9 culture</title>
      <link>https://example.com/latin</link>
      <description>R\xe9sum\xe9 of caf\xe9 culture.</description>
    </item>
  </channel>
</rss>"""

_UTF8_BOM_FEED = b"\xef\xbb\xbf" + b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BOM Feed</title>
    <item>
      <title>Article with BOM</title>
      <link>https://example.com/bom</link>
      <description>Feed starts with UTF-8 BOM.</description>
    </item>
  </channel>
</rss>"""

_MISMATCHED_FEED = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mismatched Feed</title>
    <item>
      <title>Caf\xe9 mismatch</title>
      <link>https://example.com/mismatch</link>
      <description>XML says UTF-8 but content is Latin-1.</description>
    </item>
  </channel>
</rss>"""


class TestFeedparserWithBytes:
    """Verify feedparser handles various encodings when given raw bytes."""

    def test_utf8_feed(self):
        parsed = feedparser.parse(_UTF8_FEED)
        assert len(parsed.entries) == 1
        assert "Caf\u00e9" in parsed.entries[0].title

    def test_latin1_feed(self):
        parsed = feedparser.parse(_LATIN1_FEED)
        assert len(parsed.entries) == 1
        # feedparser should decode Latin-1 correctly via the XML declaration
        title = parsed.entries[0].title
        assert "Caf" in title
        assert isinstance(title, str)

    def test_utf8_bom_feed(self):
        parsed = feedparser.parse(_UTF8_BOM_FEED)
        assert len(parsed.entries) == 1
        assert parsed.entries[0].title == "Article with BOM"

    def test_mismatched_encoding(self):
        """XML says UTF-8 but content has Latin-1 bytes. feedparser should not crash."""
        parsed = feedparser.parse(_MISMATCHED_FEED)
        # feedparser may set bozo=True but should still parse entries
        assert len(parsed.entries) >= 1
        title = parsed.entries[0].title
        assert isinstance(title, str)
        assert "Caf" in title

    def test_utf8_feed_no_regression(self):
        """Standard UTF-8 feed should work exactly as before."""
        parsed = feedparser.parse(_UTF8_FEED)
        assert not parsed.bozo or parsed.entries
        entry = parsed.entries[0]
        assert entry.title == "Caf\u00e9 culture in Paris"
        assert entry.link == "https://example.com/cafe"
        assert "caf\u00e9" in entry.description.lower()
