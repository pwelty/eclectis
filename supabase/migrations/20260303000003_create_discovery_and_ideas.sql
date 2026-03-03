-- Discovery and idea tables for Eclectis
-- Search terms, votes, ideas, and idea-article junction

-- ── Search terms ────────────────────────────────────────────────────────

CREATE TABLE search_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, term)
);

CREATE INDEX idx_search_terms_user ON search_terms(user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON search_terms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Votes ───────────────────────────────────────────────────────────────

CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    direction TEXT NOT NULL
        CHECK (direction IN ('thumbs_up', 'thumbs_down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, article_id)
);

CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_article ON votes(article_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Ideas ───────────────────────────────────────────────────────────────

CREATE TABLE ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
    strength INTEGER NOT NULL DEFAULT 0,
    last_synthesized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ideas_user ON ideas(user_id);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_strength ON ideas(strength);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ideas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Idea-article junction ───────────────────────────────────────────────

CREATE TABLE idea_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    relevance_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(idea_id, article_id)
);

CREATE INDEX idx_idea_articles_idea ON idea_articles(idea_id);
CREATE INDEX idx_idea_articles_article ON idea_articles(article_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON idea_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
