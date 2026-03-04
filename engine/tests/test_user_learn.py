import pytest
from engine.handlers.user_learn import _build_learning_prompt


def test_build_learning_prompt_with_votes():
    events = [
        {"event_type": "vote_up", "title": "AI breakthrough", "tags": ["AI", "research"]},
        {"event_type": "vote_down", "title": "Celebrity gossip", "tags": ["entertainment"]},
        {"event_type": "bookmark", "title": "Deep learning tutorial", "tags": ["AI", "tutorial"]},
    ]
    prompt = _build_learning_prompt(
        events=events,
        current_interests="AI and technology",
        current_learned="",
    )
    assert prompt is not None
    assert "AI breakthrough" in prompt
    assert "Celebrity gossip" in prompt
    assert "Deep learning tutorial" in prompt
    assert "AI and technology" in prompt


def test_build_learning_prompt_empty_events():
    result = _build_learning_prompt(events=[], current_interests="AI", current_learned="")
    assert result is None


def test_build_learning_prompt_with_existing_learned():
    events = [
        {"event_type": "vote_up", "title": "New article", "tags": ["tech"]},
    ]
    prompt = _build_learning_prompt(
        events=events,
        current_interests="AI",
        current_learned="User prefers deep technical content over news summaries.",
    )
    assert prompt is not None
    assert "User prefers deep technical content" in prompt


def test_build_learning_prompt_clicks_only():
    events = [
        {"event_type": "click", "title": "Interesting post", "tags": []},
    ]
    prompt = _build_learning_prompt(
        events=events,
        current_interests="",
        current_learned="",
    )
    assert prompt is not None
    assert "Interesting post" in prompt
    assert "ARTICLES THE USER CLICKED" in prompt


def test_build_learning_prompt_no_actionable_events():
    # feed_delete and feed_disable events don't have articles, so they get filtered
    # But they still have event_type in the events list — they just won't match any section
    events = [
        {"event_type": "feed_delete", "title": "Untitled", "tags": []},
    ]
    result = _build_learning_prompt(
        events=events,
        current_interests="AI",
        current_learned="",
    )
    # feed_delete doesn't match any section, so no sections = None
    assert result is None
