-- Newsletter issues: tracks each incoming newsletter email
CREATE TABLE newsletter_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    subject TEXT NOT NULL DEFAULT '',
    sender_email TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processing', 'complete', 'failed')),
    content_type TEXT
        CHECK (content_type IN ('content', 'links')),
    article_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_newsletter_issues_feed ON newsletter_issues(feed_id);
CREATE INDEX idx_newsletter_issues_user ON newsletter_issues(user_id);
CREATE INDEX idx_newsletter_issues_received ON newsletter_issues(received_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON newsletter_issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Link articles to their newsletter issue
ALTER TABLE articles ADD COLUMN newsletter_issue_id UUID REFERENCES newsletter_issues(id) ON DELETE SET NULL;
CREATE INDEX idx_articles_newsletter_issue ON articles(newsletter_issue_id);

-- RLS
ALTER TABLE newsletter_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own newsletter issues"
    ON newsletter_issues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to newsletter issues"
    ON newsletter_issues FOR ALL USING (auth.role() = 'service_role');
