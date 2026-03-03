# Eclectis product vision

## Problem

Information overload makes it impossible to keep up with what matters. RSS readers show everything chronologically. Social feeds optimize for engagement, not relevance. Knowledge workers waste hours sifting through noise to find signal.

## Vision

Eclectis is an AI intelligence layer for personal content curation. Not a reader — a curator that **outputs to wherever you already consume**.

You tell it what you care about. It discovers, scores, and filters content. It delivers curated results as:

- **RSS feed** — subscribe in Feedbin, Reeder, whatever you already use
- **Email briefing** — daily digest with picks, themes, and ideas
- **Podcast feed** — curated episodes with AI-narrated summaries
- **Read-later push** — Raindrop, Readwise via API

The product is the curation, not the container.

## How it works

1. **Preferences** — tell Eclectis what you care about (interests, topics, depth)
2. **Discovery** — Google search, RSS feeds, newsletter ingestion, podcast index
3. **Scoring** — AI scores articles for relevance, deduplicates, summarizes
4. **Briefing** — synthesize top findings into a daily intelligence briefing
5. **Output** — curated RSS feed, email, push to read-later apps

## Principles

- Signal over noise — every feature should reduce time-to-insight
- Show your work — AI decisions are explainable and auditable
- Own your data — standard formats in, standard formats out (OPML, RSS, export)
- Output, not lock-in — deliver to existing tools, not a proprietary reader

## Architecture

- **web/** — Next.js app (React 19, TypeScript, Tailwind, shadcn)
- **engine/** — Python engine (FastAPI, Claude AI, content pipeline)
- **supabase/** — database migrations, RLS policies, seed data

## Pricing

- **Free** — BYOK (bring your own API key), basic curation, RSS output only
- **Paid ($5-10/mo)** — we cover AI costs, briefing emails, integrations
