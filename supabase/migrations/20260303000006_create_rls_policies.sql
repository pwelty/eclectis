-- Row-level security policies for Eclectis
-- Single-user model: all user-facing tables use user_id = auth.uid()
-- Commands and domain_events: service role only (engine bypasses RLS)

-- ── Enable RLS on all tables ────────────────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

-- ── User profiles ───────────────────────────────────────────────────────

CREATE POLICY "Own profile read" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Own profile update" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- ── Newsletter addresses ────────────────────────────────────────────────

CREATE POLICY "Own addresses read" ON newsletter_addresses
    FOR SELECT USING (user_id = auth.uid());

-- ── Feeds ───────────────────────────────────────────────────────────────

CREATE POLICY "Own feeds read" ON feeds
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Own feeds insert" ON feeds
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own feeds update" ON feeds
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Own feeds delete" ON feeds
    FOR DELETE USING (user_id = auth.uid());

-- ── Articles ────────────────────────────────────────────────────────────

CREATE POLICY "Own articles read" ON articles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Own articles insert" ON articles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own articles update" ON articles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Own articles delete" ON articles
    FOR DELETE USING (user_id = auth.uid());

-- ── Search terms ────────────────────────────────────────────────────────

CREATE POLICY "Own search terms read" ON search_terms
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Own search terms insert" ON search_terms
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own search terms update" ON search_terms
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Own search terms delete" ON search_terms
    FOR DELETE USING (user_id = auth.uid());

-- ── Votes ───────────────────────────────────────────────────────────────

CREATE POLICY "Own votes read" ON votes
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Own votes insert" ON votes
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own votes update" ON votes
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Own votes delete" ON votes
    FOR DELETE USING (user_id = auth.uid());

-- ── Ideas ───────────────────────────────────────────────────────────────

CREATE POLICY "Own ideas read" ON ideas
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Own ideas insert" ON ideas
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own ideas update" ON ideas
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Own ideas delete" ON ideas
    FOR DELETE USING (user_id = auth.uid());

-- ── Idea articles ───────────────────────────────────────────────────────

CREATE POLICY "Own idea articles read" ON idea_articles
    FOR SELECT USING (idea_id IN (
        SELECT id FROM ideas WHERE user_id = auth.uid()
    ));

CREATE POLICY "Own idea articles insert" ON idea_articles
    FOR INSERT WITH CHECK (idea_id IN (
        SELECT id FROM ideas WHERE user_id = auth.uid()
    ));

CREATE POLICY "Own idea articles update" ON idea_articles
    FOR UPDATE USING (idea_id IN (
        SELECT id FROM ideas WHERE user_id = auth.uid()
    ));

CREATE POLICY "Own idea articles delete" ON idea_articles
    FOR DELETE USING (idea_id IN (
        SELECT id FROM ideas WHERE user_id = auth.uid()
    ));

-- ── Commands (service role only — no user RLS policies) ─────────────────
-- Engine uses service role key which bypasses RLS entirely.
-- No SELECT/INSERT/UPDATE policies for authenticated users.

-- ── Domain events (read-only for users, engine writes via service role) ─

CREATE POLICY "Own events read" ON domain_events
    FOR SELECT USING (user_id = auth.uid());

-- ── Scan logs ───────────────────────────────────────────────────────────

CREATE POLICY "Own scan logs read" ON scan_logs
    FOR SELECT USING (user_id = auth.uid());

-- ── Processed posts ─────────────────────────────────────────────────────

CREATE POLICY "Own processed posts read" ON processed_posts
    FOR SELECT USING (user_id = auth.uid());

-- ── Briefings ───────────────────────────────────────────────────────────

CREATE POLICY "Own briefings read" ON briefings
    FOR SELECT USING (user_id = auth.uid());

-- ── Realtime: enable for command/event subscriptions ────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE commands;
ALTER PUBLICATION supabase_realtime ADD TABLE domain_events;
