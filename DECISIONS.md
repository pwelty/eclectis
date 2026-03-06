# Decisions

## 2026-03-03 — Project architecture

**Decision:** Separate project from Authexis, not a shared engine or Authexis consumer tier.

**Context:** Eclectis started as Authexis's discovery feature. The new consumer product concept (intelligence layer that outputs to your tools) has a fundamentally different data model (single-user vs B2B workspace/team). Sharing an engine would mean every change negotiates between two masters.

**Approach:** Fork the Authexis engine, strip workspace/team model, evolve independently. Same tech stack (Python + Railway) for familiarity. Separate Supabase project for clean data isolation.

**Trade-off:** Code will drift from Authexis over time. Accepted — the products serve different audiences and will diverge naturally.

## 2026-03-03 — Newsletter ingestion via Brevo inbound webhook

**Decision:** Use Brevo inbound email parsing on `in.eclectis.io` subdomain, not a real mailbox.

**Context:** Each user gets a unique `{hash}@in.eclectis.io` address for newsletter forwarding. Brevo is already verified on eclectis.io (TXT record exists). Root domain MX is on Fastmail — using a subdomain avoids touching that.

**Approach:** MX record on `in.eclectis.io` → Brevo → webhook POST to engine. Engine parses HTML, extracts content, scores and stores as article with `content_type: newsletter`.

## 2026-03-03 — Descoped: idea generation, daily pipeline, article enrichment

**Decision:** Remove idea generation, daily pipeline orchestrator, article enrichment, and feed discovery from v1.

**Context:** These were carried over from Authexis but aren't core to Eclectis's value. The core loop is: scan → score → fetch content → briefing email. Ideas and enrichment add complexity without clear user value for a v1 consumer product.

**What stays:** rss.scan, google_search.scan, article.fetch_content, article.batch_fetch, briefing.generate, newsletter.process. Scans triggered directly (no pipeline orchestrator). Briefing is standalone.

## 2026-03-03 — Visual design carried from old Eclectis

**Decision:** Reuse the existing Eclectis design system (navy-slate brand, warm amber accent, shadcn, light + dark mode).

**Context:** The old Eclectis project had a complete design system and landing page. The visual identity is solid. Only the copy needs rewriting for the new "intelligence layer" positioning.

## 2026-03-06 — Scout issue selection

**Decision:** During scouting, prefer small execution bugs and workflow mismatches over broader product enhancements.

**Context:** The open backlog is thin and mostly unmilestoned. Several larger opportunities surfaced during exploration, but they were either already represented by existing backlog issues or still needed product decisions before they would be safe for `/grind`.

**Approach:** Create issues only for findings that already have a clear reproduction path in the current codebase, point to specific files/functions, and can likely be completed in one focused agent pass. Skip broader ideas like feed discovery improvements, newsletter inbox scanning, and analytics expansion because they need human product direction or duplicate existing backlog themes.
