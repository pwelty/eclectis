# Eclectis — milestone plan

*March 3, 2026*

## Approach

- **Fork strategy:** Clean-room copy. Start with empty engine/ and web/ directories, copy individual files from Authexis as needed, adapting workspace→user as we go.
- **Landing page:** Fresh build using the same design tokens (navy-slate, amber, Inter, shadcn). New layout, new copy for "intelligence layer" positioning.
- **Target:** Full v1 launch — RSS output + email briefings + newsletter ingestion + voting + onboarding. Everything needed to launch on Product Hunt.

## Milestone 1: Foundation

Get the monorepo, database, auth, and deploy pipeline working. No features yet — just the skeleton that everything plugs into.

- Monorepo scaffolding (Next.js app, Python engine, Supabase migrations)
- Supabase project + core schema (users, feeds, articles, search_terms, votes, newsletter_addresses)
- RLS policies (user_id = auth.uid() pattern throughout)
- Auth (signup, login, password reset)
- Engine scaffold (FastAPI, poller, command queue, scheduler)
- Deploy pipeline (Vercel for web, Railway for engine)
- Health checks, basic CI

**Done when:** You can sign up, log in, and the engine is polling for commands on Railway.

## Milestone 2: Scanning pipeline

The engine's core value — discover, score, and fetch content. No web UI for managing it yet (seed data or admin scripts to test).

- RSS scanning handler (feedparser, dedup, batch scoring)
- Google search scanning handler
- AI scoring with Claude Haiku (interests-based prompt, vote calibration)
- Article fetch + summarize (ScrapingBee, escalation strategy)
- Briefing generation (daily email digest via Claude + Brevo)
- Newsletter inbound webhook (Brevo → engine → parse → score)
- DNS setup for `in.eclectis.io`

**Done when:** You can seed a user with feeds and search terms, run scans, and see scored/summarized articles in the database. Briefing can be generated on demand.

## Milestone 3: Web app

The user-facing product — everything a user needs to set up their curation and see results.

- Onboarding flow (describe interests, add feeds, enter search terms, get newsletter address)
- Feed management (add/edit/remove RSS, podcast, newsletter sources, OPML import)
- Search term management (add/edit/remove discovery terms)
- Articles view (scored articles, vote thumbs up/down)
- Curated RSS feed endpoint (/feed.xml — XML generation from top-scored articles)
- Briefing settings (frequency, preferences)
- BYOK API key management (validate on save, store encrypted)
- Settings page (interests, preferences, delivery)

**Done when:** A real user can sign up, configure their sources, wait a day, and get curated content via RSS feed and email.

## Milestone 4: Launch

Landing page, billing, and everything needed to put it in front of people.

- Landing page (fresh build, navy-slate/amber palette, shadcn, "intelligence layer" positioning)
- Pricing page + Stripe integration (free BYOK tier, Pro tier)
- Usage tracking for Pro tier (token logging, cost per user)
- PostHog analytics
- Sentry error tracking
- SEO basics (meta tags, OG images)
- Product Hunt / Show HN prep

**Done when:** You can share a URL and someone can sign up, pay, and get value.

## Key architectural decisions for implementation

### Command queue scope

Not everything goes through the command queue. Split:

- **Direct Supabase operations** (web → Supabase): CRUD on feeds, votes, search terms, user preferences, BYOK keys
- **Command queue** (web → command → engine): scan feeds, score articles, generate briefings, fetch article content

### Eclectis command types (~10, vs Authexis's 40+)

- `rss.scan` — scan RSS/podcast feeds
- `google.search_scan` — search discovery terms
- `article.fetch_content` — scrape and summarize
- `article.batch_fetch` — batch version
- `briefing.generate` — daily/weekly email digest
- `newsletter.process` — parse inbound email content

### RSS feed output

The curated RSS endpoint (`/feed.xml`) is a synchronous GET route in the Next.js app that queries Supabase directly. Not an engine command.

### Scoring feedback loop

Carried over from Authexis (not new). User votes stored in `votes` table, included in scoring prompt as calibration context. Same pattern as Authexis's article `rating` field.

### Budget/usage tracking

- BYOK users (free tier): no budget tracking — they pay their own API costs
- Pro users: token logging per user for cost control
