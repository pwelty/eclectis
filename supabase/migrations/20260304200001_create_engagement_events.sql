-- Engagement events for self-improving scoring loop
CREATE TABLE engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('click', 'vote_up', 'vote_down', 'bookmark', 'unbookmark', 'mark_read', 'feed_disable', 'feed_delete')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engagement_events_user ON engagement_events(user_id);
CREATE INDEX idx_engagement_events_type ON engagement_events(event_type);
CREATE INDEX idx_engagement_events_created ON engagement_events(created_at);

-- RLS
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY engagement_events_select ON engagement_events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY engagement_events_insert ON engagement_events
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Learned preferences on user_profiles
ALTER TABLE user_profiles
    ADD COLUMN learned_preferences TEXT,
    ADD COLUMN last_learned_at TIMESTAMPTZ;
