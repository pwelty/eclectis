from __future__ import annotations

import asyncio
from uuid import uuid4

from engine.handlers import google_search_scan


def test_load_queries_for_all_active_terms(monkeypatch):
    user_id = uuid4()

    async def fake_fetch(query, *args):
        assert "active = TRUE" in query
        assert args == (user_id,)
        return [{"term": " alpha "}, {"term": "beta"}, {"term": "   "}]

    monkeypatch.setattr(google_search_scan.db, "fetch", fake_fetch)

    queries = asyncio.run(google_search_scan._load_queries(user_id))

    assert queries == ["alpha", "beta"]


def test_load_queries_for_single_term(monkeypatch):
    user_id = uuid4()
    term_id = str(uuid4())

    async def fake_fetch(query, *args):
        assert "id = $2" in query
        assert args == (user_id, term_id)
        return [{"term": " focused query "}]

    monkeypatch.setattr(google_search_scan.db, "fetch", fake_fetch)

    queries = asyncio.run(google_search_scan._load_queries(user_id, term_id))

    assert queries == ["focused query"]
