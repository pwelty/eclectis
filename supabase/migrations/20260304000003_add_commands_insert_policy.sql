-- Allow users to insert their own commands (e.g., triggering daily.pipeline from onboarding)
-- Engine still uses service role key which bypasses RLS entirely.
CREATE POLICY "Own commands insert" ON commands
    FOR INSERT WITH CHECK (user_id = auth.uid());
