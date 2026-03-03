-- Scan logs, processed posts, and briefings for Eclectis
-- Operational tables for tracking engine activity

-- ── Scan logs ───────────────────────────────────────────────────────────

CREATE TABLE scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feeds_scanned INTEGER NOT NULL DEFAULT 0,
    posts_found INTEGER NOT NULL DEFAULT 0,
    posts_saved INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_logs_user ON scan_logs(user_id);
CREATE INDEX idx_scan_logs_created ON scan_logs(created_at);

-- ── Processed posts (dedup tracking) ────────────────────────────────────

CREATE TABLE processed_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    saved BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, url)
);

CREATE INDEX idx_processed_posts_user ON processed_posts(user_id);
CREATE INDEX idx_processed_posts_url ON processed_posts(url);
CREATE INDEX idx_processed_posts_saved ON processed_posts(saved);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON processed_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Briefings ───────────────────────────────────────────────────────────

CREATE TABLE briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    html TEXT,
    sent_at TIMESTAMPTZ,
    frequency TEXT NOT NULL DEFAULT 'daily'
        CHECK (frequency IN ('daily', 'weekly')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_briefings_user ON briefings(user_id);
CREATE INDEX idx_briefings_created ON briefings(created_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON briefings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
