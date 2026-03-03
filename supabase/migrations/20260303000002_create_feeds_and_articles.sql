-- Feeds and articles for Eclectis
-- Unified content model: RSS, podcasts, newsletters all stored as articles

-- ── Feeds ─────────────────────────────────────────────────────────────────

CREATE TABLE feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'rss'
        CHECK (type IN ('rss', 'podcast', 'newsletter')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, url)
);

CREATE INDEX idx_feeds_user ON feeds(user_id);
CREATE INDEX idx_feeds_active ON feeds(active);
CREATE INDEX idx_feeds_type ON feeds(type);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON feeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Articles ──────────────────────────────────────────────────────────────

CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'article'
        CHECK (content_type IN ('article', 'podcast', 'newsletter')),
    ai_score INTEGER,
    ai_reason TEXT,
    summary TEXT,
    content_summary TEXT,
    content TEXT,
    audio_url TEXT,
    duration_seconds INTEGER,
    source TEXT NOT NULL DEFAULT 'rss',
    status TEXT NOT NULL DEFAULT 'to_read'
        CHECK (status IN ('to_read', 'reading', 'read')),
    tags JSONB NOT NULL DEFAULT '[]',
    published_at TIMESTAMPTZ,
    found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, url)
);

CREATE INDEX idx_articles_user ON articles(user_id);
CREATE INDEX idx_articles_feed ON articles(feed_id);
CREATE INDEX idx_articles_url ON articles(url);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_ai_score ON articles(ai_score);
CREATE INDEX idx_articles_source ON articles(source);
CREATE INDEX idx_articles_content_type ON articles(content_type);
CREATE INDEX idx_articles_found_at ON articles(found_at);
CREATE INDEX idx_articles_published_at ON articles(published_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
