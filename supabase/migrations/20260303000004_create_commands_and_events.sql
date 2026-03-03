-- Engine command/event tables for Eclectis
-- Commands: UI writes, engine reads and processes
-- Domain events: engine writes, UI subscribes via Realtime

-- ── Commands ────────────────────────────────────────────────────────────

CREATE TABLE commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    idempotency_key TEXT UNIQUE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    result JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commands_pending ON commands(status, created_at)
    WHERE status = 'pending';
CREATE INDEX idx_commands_user ON commands(user_id);
CREATE INDEX idx_commands_type ON commands(type);
CREATE INDEX idx_commands_idempotency ON commands(idempotency_key);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON commands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Domain events ───────────────────────────────────────────────────────

CREATE TABLE domain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    command_id UUID REFERENCES commands(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domain_events_user ON domain_events(user_id);
CREATE INDEX idx_domain_events_type ON domain_events(event_type);
CREATE INDEX idx_domain_events_command ON domain_events(command_id);
CREATE INDEX idx_domain_events_created ON domain_events(created_at);
