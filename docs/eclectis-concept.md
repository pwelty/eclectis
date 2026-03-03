# Eclectis — product concept

*Captured March 3, 2026*

## Core idea

An AI intelligence layer for personal content curation. Not a reader — a curator that **outputs to wherever you already consume**.

You tell it what you care about. It discovers, scores, and filters content. It delivers curated results as:

- **RSS feed** — subscribe in Feedbin, Reeder, whatever you already use
- **Email briefing** — daily digest (already built in Authexis engine)
- **Podcast feed** — curated episodes, possibly AI-narrated summaries
- **Read-later push** — Raindrop, Pocket (RIP), Readwise, Omnivore (RIP) via API

The product is the curation, not the container.

## How it works

1. **Preferences** — you tell Eclectis what you care about (interests, topics, depth preferences)
2. **Discovery** — Google search, RSS feed discovery, possibly ingest from your existing Feedbin/Raindrop via API to learn what you already read
3. **Scoring and filtering** — AI scores articles for relevance, deduplicates, summarizes
4. **Briefing** — synthesize top findings into a briefing
5. **Output** — curated RSS feed endpoint, email, push to read-later apps

## What already exists (from Authexis)

The Authexis engine does ~80% of this today:
- Google search scanning with configurable search terms
- RSS feed discovery and scanning
- AI scoring and relevance filtering (Claude Haiku)
- Article enrichment (fetch, summarize, extract key claims/quotes)
- Idea generation from article clusters
- Email briefing generation and delivery

**New parts needed:**
- Per-user model (not per-workspace/team)
- RSS feed output endpoint (XML generation from curated articles)
- Integration hooks (Feedbin API, Raindrop API, etc.)
- Newsletter ingestion (Eclectis email address → parse → score)
- Podcast episode scoring/filtering

## Positioning

> "You pick the sources. You pick where it shows up. We make sure you only see what matters."

Not a reader. Not a newsletter. The intelligence layer that delivers to wherever you already live.

## Pricing

- **Free** — BYOK (bring your own API key) required, basic curation, RSS output only
- **$5-10/mo** — we cover AI costs, briefing emails, multiple delivery surfaces, integrations

BYOK on free tier defrays costs and targets the exact early-adopter audience (people who already have Anthropic/OpenAI API keys).

## Why this works (from competitive survey)

### Nobody does this

Every competitor is either:
- A **reader** that wants you inside their app (Feedly, Readwise, Matter, Particle)
- A **briefing tool** that only emails you (Refind, NewsForYou, Mailbrew)

The "intelligence layer that outputs to your existing tools" position is **unoccupied**.

### The reader graveyard validates the approach

- **Artifact** — dead (acquihired by Yahoo, Jan 2024)
- **Omnivore** — dead (acquihired by ElevenLabs, Nov 2024)
- **Pocket** — dead (Mozilla shut it down, July 2025)
- **Stoop** — dead

Building another reader is a proven losing strategy. Being the invisible layer that feeds existing readers avoids this trap.

### Discovery is the biggest gap

Most "AI curation" products (Feedly Leo, Inoreader, Summate) only apply AI to sources you've already found. They don't discover new content. The few that discover (Refind, Particle, SmartNews) lock you into their reader app.

**Google search as a systematic discovery channel is novel.** Nobody else does this.

### RSS output is almost nonexistent

Only Feedly Pro+ offers RSS export. Push to read-later apps is essentially zero across all competitors.

## Competitive landscape (March 2026)

### Direct competitors

| Product | Discovers | AI scoring | RSS out | Email | Read-later push | Price |
|---------|-----------|-----------|---------|-------|----------------|-------|
| **Eclectis** | Yes (Google + RSS) | Yes | Yes | Yes | Yes | $5-10/mo |
| Feedly Leo | No | Yes | Yes (Pro+) | No | No | $8.25/mo |
| Refind | Yes (own network) | Yes | No | Yes | No | Free/premium |
| Concise | Yes (own network) | Yes | No | Yes | No | Subscription |
| Particle | Yes (news only) | Yes | No | No | No | Free/$2.99 |
| Summate | No | Yes | No | Yes | No | $4-8/mo |
| NewsForYou | Yes (own network) | Yes | No | Yes | No | Free |
| Perplexity Discover | Yes (search) | Editorial | No | No | No | Free |

### Adjacent (readers with AI)

- **Feedly + Leo** ($8.25/mo) — closest competitor but no discovery, no email, locked in their reader
- **Inoreader** ($7.50/mo) — powerful RSS reader, AI analysis, but no discovery or output
- **Readwise Reader** ($9.99/mo) — best knowledge management, but you save content yourself
- **Matter** — read-later with AI co-reader, iOS focused, no curation
- **Meco** ($3.99/mo) — newsletter-only reader, no discovery

### Market signals

- Feedly reported 25% user growth Q4 2024 from users seeking algorithmic feed alternatives
- Andrej Karpathy's Jan 2026 RSS advocacy signals cultural shift back to user-controlled consumption
- Content curation market projected to reach $15B by 2028

## Open questions

- Where does Eclectis live? Standalone project? Authexis consumer tier?
- How much of the Authexis engine can be reused vs. needs to be forked?
- Newsletter ingestion: custom email address? Gmail integration? IMAP?
- How to handle podcast discovery specifically (podcast index API?)
- What's the onboarding flow? Topic picker? Import OPML? Connect Feedbin?
