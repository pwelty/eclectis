# Eclectis — project design

*March 3, 2026*

## What it is

An AI intelligence layer for personal content curation. Not a reader — a curator that outputs to wherever you already consume. You tell it what you care about. It discovers, scores, and filters content. It delivers curated results as RSS feeds, email briefings, or pushes to your existing tools.

> "You pick the sources. You pick where it shows up. We make sure you only see what matters."

## Monorepo structure

```
eclectis/
├── web/                    # Next.js app (Vercel)
├── engine/                 # Python engine (Railway)
├── supabase/               # Migrations, seed, RLS
├── docs/                   # Product docs, plans, concept
├── work-log/               # Session logs
├── CLAUDE.md
├── PRODUCT.md
├── DECISIONS.md
└── README.md
```

## Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Web | Next.js, shadcn, Tailwind | Vercel |
| Engine | Python | Railway |
| Database | PostgreSQL | Supabase (new project, separate from Authexis) |
| Auth | Supabase Auth | Supabase |
| Analytics | PostHog | Cloud |
| Error tracking | Sentry | Cloud |
| Outbound email | Brevo | Cloud |
| Inbound email | Brevo inbound webhook | `in.eclectis.io` subdomain |

## Visual design

Carried from old Eclectis project — navy-slate brand palette, warm amber accent, Inter font, shadcn components, light + dark mode. Full design system already exists in old `globals.css` (brand colors, surfaces, text hierarchy, borders, shadows, score colors).

Landing page copy needs rewrite for new "intelligence layer" positioning.

## Data model

Single-user model. No workspaces, teams, or memberships.

### Core tables

- **users** — Supabase Auth user, profile preferences, BYOK API keys
- **feeds** — type enum: `rss`, `podcast`, `newsletter`. URL, name, active, last_scanned_at
- **newsletter_addresses** — unique `{hash}@in.eclectis.io` per user, maps to inbound email parsing
- **search_terms** — user-entered Google discovery terms
- **articles** — unified table for all content types. `content_type` enum: `article`, `podcast`, `newsletter`. Fields: title, url, ai_score, ai_reason, summary, content_summary, content, audio_url, duration_seconds, source, status, tags
- **ideas** — clusters generated from article themes across sources
- **votes** — user thumbs-up/down on articles, used as scoring feedback loop

## Engine

Forked from Authexis engine, stripped to single-user model.

### Scanning pipeline

1. **RSS + podcast scanning** — fetch feeds, parse entries, detect audio enclosures for podcasts
2. **Google search scanning** — search user's discovery terms, score results
3. **Newsletter ingestion** — Brevo inbound webhook on `in.eclectis.io` receives email, engine parses HTML, extracts content, scores like any other article
4. **AI scoring** — Claude Haiku scores each item against user interests + search terms. Votes feed back into scoring calibration over time
5. **Article fetch + summarize** — fetch full content from URLs (articles, podcast show notes, newsletter web versions), generate summaries
6. **Idea generation** — cluster related articles into emerging themes
7. **Briefing generation** — synthesize top findings into email digest

### Feedback loop

User votes (thumbs up/down) on articles are stored and included in the scoring prompt as calibration context. Over time, scoring aligns more closely with what the user actually finds valuable.

## Output surfaces

- **Curated RSS feed endpoint** — XML feed of top-scored content. Subscribe in Feedbin, Reeder, NetNewsWire, etc.
- **Email briefing** — daily or weekly digest via Brevo
- **Integration hooks** (later) — push to Raindrop, Readwise, Pocket alternatives via API

## User-facing features

### Onboarding
- Describe interests in plain text
- Add feeds: paste URL (auto-discover RSS), OPML import, browse suggestions
- Enter Google search discovery terms
- Get unique newsletter forwarding address (`{hash}@in.eclectis.io`)

### Day-to-day
- **Feed management** — add/edit/remove RSS, podcast, newsletter sources
- **Search term management** — add/edit/remove Google discovery terms
- **Voting** — thumbs up/down on articles for scoring feedback
- **Curated feed URL** — copy RSS feed URL to add to your reader
- **Briefing settings** — frequency, delivery preferences

### Settings
- **BYOK** — bring your own Anthropic/OpenAI API key (required on free tier)
- **Preferences** — interests, content depth, delivery frequency
- **Integrations** — connected read-later apps (later)

## Pricing

| Tier | Price | What's included |
|------|-------|-----------------|
| Free | $0/mo | BYOK required, basic curation, RSS output only, limited feeds |
| Pro | $5-10/mo | We cover AI costs, email briefings, unlimited feeds/scans, integrations |

BYOK on free tier defrays costs and targets the exact early-adopter audience (people who already have Anthropic/OpenAI API keys).

## Marketing & growth

### Positioning
Intelligence layer, not a reader. "We deliver to wherever you already live." Differentiated by: discovery (Google search), output flexibility (RSS, email, integrations), and the reader graveyard (we don't need you in our app).

### Launch channels
- **Product Hunt** — launch day with demo video
- **Hacker News** — Show HN post, RSS revival angle
- **IndieHackers** — building in public, revenue transparency
- **RSS/newsletter communities** — Feedbin forums, Reddit r/rss, Mastodon

### Content marketing
- Blog posts: RSS revival, algorithmic feed alternatives, POSSE philosophy, content curation without lock-in
- SEO targets: "AI RSS reader", "curated RSS feed", "personalized news feed", "AI content curation"

### Growth mechanics
- Shareable curated feed URLs (viral loop — people see your feed, want their own)
- "Powered by Eclectis" attribution in RSS feed metadata
- Referral program (later, after product-market fit)

### Paid acquisition
- Defer until organic validation
- PostHog funnels to measure conversion before spending

## Inbound email architecture

```
Newsletter sender
    → {hash}@in.eclectis.io
    → MX record points to Brevo
    → Brevo parses email, POSTs to engine webhook
    → Engine extracts content, scores, stores as article (content_type: newsletter)
```

DNS setup: add MX record for `in.eclectis.io` pointing to Brevo inbound. Root domain MX stays on Fastmail (unused but untouched).

## What comes from Authexis (then simplified)

- RSS/podcast scanning handlers
- Google search scanning
- AI scoring (Claude Haiku)
- Article fetch + summarize
- Idea generation
- Briefing generation
- Supabase auth patterns
- shadcn component patterns

## What's new

- Single-user data model
- Newsletter ingestion via inbound email webhook
- RSS feed output endpoint (XML generation)
- Voting / feedback loop for scoring calibration
- BYOK API key management
- Search term self-service UI
- Integration hooks (Feedbin, Raindrop, Readwise)
- Consumer landing page and marketing

## Open questions

- Exact Brevo inbound webhook format — need to test parsing
- Scoring feedback loop mechanics — how exactly do votes weight future scores?
- RSS feed output format — Atom vs RSS 2.0? How many items? Refresh interval?
- BYOK key validation — how to verify a user's API key works before accepting it?
- Podcast-specific features — episode player embed? Or just link out?
