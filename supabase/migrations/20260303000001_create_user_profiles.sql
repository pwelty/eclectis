-- User profiles and signup trigger for Eclectis
-- Single-user model: no workspaces, all tables scoped by user_id = auth.uid()

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- updated_at trigger function (reused across tables)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── User profiles ───────────────────────────────────────────────────────

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    interests TEXT,
    preferences JSONB NOT NULL DEFAULT '{}',
    api_key_encrypted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Newsletter addresses ────────────────────────────────────────────────

CREATE TABLE newsletter_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    address TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_newsletter_addresses_user ON newsletter_addresses(user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON newsletter_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-create profile + newsletter address on signup ──────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    email_hash TEXT;
BEGIN
    -- Extract name from metadata or email
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    -- Create user profile
    INSERT INTO public.user_profiles (id, name)
    VALUES (NEW.id, user_name);

    -- Create unique newsletter address: {hash}@in.eclectis.io
    email_hash := SUBSTR(MD5(NEW.id::TEXT || NOW()::TEXT), 1, 12);
    INSERT INTO public.newsletter_addresses (user_id, address)
    VALUES (NEW.id, email_hash || '@in.eclectis.io');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
