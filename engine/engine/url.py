"""Shared URL utilities for normalization and domain extraction."""

from __future__ import annotations

from urllib.parse import urlparse, urlencode, parse_qs

_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid",
}


def normalize_url(url: str) -> str:
    """Normalize a URL: https upgrade, lowercase host, strip tracking params, remove trailing slash."""
    if not url or not isinstance(url, str):
        return url or ""
    url = url.strip()
    if not url:
        return ""

    if url.startswith("http://"):
        url = "https://" + url[7:]

    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        scheme = parsed.scheme or "https"

        # Strip www. prefix
        if hostname.startswith("www."):
            hostname = hostname[4:]

        # Strip tracking params
        qs = parse_qs(parsed.query, keep_blank_values=True)
        filtered = {k: v for k, v in qs.items() if k.lower() not in _TRACKING_PARAMS}
        query = urlencode(filtered, doseq=True) if filtered else ""

        # Remove trailing slashes from path
        path = parsed.path.rstrip("/") or ""

        result = f"{scheme}://{hostname}"
        if parsed.port and parsed.port not in (80, 443):
            result += f":{parsed.port}"
        if path:
            result += path
        if query:
            result += "?" + query
        if parsed.fragment:
            result += "#" + parsed.fragment

        return result
    except Exception:
        return url.lower().rstrip("/")


def extract_domain(url: str) -> str:
    """Extract the domain from a URL, stripping www. prefix."""
    try:
        hostname = urlparse(url).netloc.lower()
        if hostname.startswith("www."):
            hostname = hostname[4:]
        return hostname
    except Exception:
        return ""
