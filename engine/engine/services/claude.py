"""Anthropic Claude API wrapper — sync client wrapped with asyncio.to_thread()."""

from __future__ import annotations

import asyncio
import json
import re

import structlog
from anthropic import Anthropic

from engine.config import settings

log = structlog.get_logger()

_client: Anthropic | None = None


def get_client(api_key: str | None = None) -> Anthropic:
    """Return an Anthropic client. Uses a cached singleton for the platform key,
    or creates a fresh client when a user-provided BYOK key is given."""
    if api_key:
        return Anthropic(api_key=api_key)
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def chat(
    prompt: str,
    *,
    system: str = "",
    max_tokens: int = 4096,
    temperature: float | None = None,
    model: str | None = None,
    api_key: str | None = None,
) -> tuple[str, dict]:
    """Synchronous chat call — wrap with asyncio.to_thread() in async handlers.

    If api_key is provided, uses that key instead of the platform key (BYOK).
    """
    client = get_client(api_key=api_key)
    messages = [{"role": "user", "content": prompt}]
    resolved_model = model or settings.scoring_model
    kwargs = {
        "model": resolved_model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system
    if temperature is not None:
        kwargs["temperature"] = temperature

    response = client.messages.create(**kwargs)

    text = response.content[0].text if response.content else ""
    usage = {
        "model": resolved_model,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }
    return text, usage


async def achat(
    prompt: str,
    *,
    system: str = "",
    max_tokens: int = 4096,
    temperature: float | None = None,
    model: str | None = None,
    api_key: str | None = None,
) -> tuple[str, dict]:
    """Async wrapper around chat() — runs in a thread."""
    return await asyncio.to_thread(
        chat, prompt, system=system, max_tokens=max_tokens,
        temperature=temperature, model=model, api_key=api_key,
    )


def extract_json_array(text: str) -> list[dict]:
    """Extract a JSON array from Claude's response text."""
    match = re.search(r"\[.*]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            log.warning("json_array.parse_failed", text=text[:200])
    return []


def extract_json_object(text: str) -> dict | None:
    """Extract a JSON object from Claude's response text."""
    match = re.search(r"\{.*}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            log.warning("json_object.parse_failed", text=text[:200])
    return None
