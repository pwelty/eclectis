-- AI usage logs for Pro tier cost tracking
-- Logs every Claude API call with token counts and cost

CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_user ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created ON ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_logs_user_created ON ai_usage_logs(user_id, created_at DESC);

-- RLS: users see own logs, engine writes via service role
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own usage logs read" ON ai_usage_logs
    FOR SELECT USING (user_id = auth.uid());
