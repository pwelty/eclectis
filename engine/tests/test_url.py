"""Tests for shared URL normalization and domain extraction."""

from engine.url import extract_domain, normalize_url


def test_http_to_https():
    assert normalize_url("http://example.com/feed") == "https://example.com/feed"


def test_keeps_https():
    assert normalize_url("https://example.com/feed") == "https://example.com/feed"


def test_lowercases_hostname():
    result = normalize_url("https://Example.COM/Feed")
    assert result == "https://example.com/Feed"


def test_strips_www():
    assert normalize_url("https://www.example.com/page") == "https://example.com/page"


def test_strips_utm_params():
    result = normalize_url("https://example.com/page?utm_source=rss&utm_medium=feed&id=5")
    assert "utm_source" not in result
    assert "utm_medium" not in result
    assert "id=5" in result


def test_strips_fbclid_gclid():
    result = normalize_url("https://example.com/page?fbclid=abc&gclid=def")
    assert "fbclid" not in result
    assert "gclid" not in result
    assert result == "https://example.com/page"


def test_preserves_legitimate_params():
    result = normalize_url("https://example.com/search?q=test&page=2")
    assert "q=test" in result
    assert "page=2" in result


def test_removes_trailing_slash():
    assert normalize_url("https://example.com/feed/") == "https://example.com/feed"


def test_root_url_trailing_slash():
    assert normalize_url("https://example.com/") == "https://example.com"


def test_full_normalization():
    result = normalize_url("http://www.Example.COM/feed/?utm_source=rss")
    assert result == "https://example.com/feed"


def test_empty_string():
    assert normalize_url("") == ""


def test_none_input():
    assert normalize_url(None) == ""


def test_malformed_url():
    result = normalize_url("not-a-url")
    assert result == "not-a-url" or "not-a-url" in result


def test_preserves_hash():
    result = normalize_url("https://example.com/page#section")
    assert result == "https://example.com/page#section"


def test_http_vs_https_same():
    """Same article with http:// vs https:// normalizes identically."""
    assert normalize_url("http://example.com/article") == normalize_url("https://example.com/article")


def test_www_vs_no_www_same():
    """Same article with www. vs without normalizes identically."""
    assert normalize_url("https://www.example.com/article") == normalize_url("https://example.com/article")


def test_tracking_params_vs_clean_same():
    """Same article with tracking params vs without normalizes identically."""
    clean = normalize_url("https://example.com/article")
    tracked = normalize_url("https://example.com/article?utm_source=rss&utm_medium=feed")
    assert clean == tracked


def test_extract_domain():
    assert extract_domain("https://www.example.com/page") == "example.com"
    assert extract_domain("https://blog.example.com/page") == "blog.example.com"
    assert extract_domain("") == ""


def test_extract_domain_no_www():
    assert extract_domain("https://example.com/page") == "example.com"
