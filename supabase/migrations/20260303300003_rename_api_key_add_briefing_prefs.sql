-- Rename api_key_encrypted to api_key (deferring encryption to M4)
ALTER TABLE user_profiles RENAME COLUMN api_key_encrypted TO api_key;

-- Briefing preferences stored in existing JSONB preferences column
-- Default: { "briefing_frequency": "daily", "briefing_send_hour": 7 }
-- No schema change needed — JSONB is flexible

-- Ensure preferences column has sensible defaults for existing users
UPDATE user_profiles
SET preferences = preferences || '{"briefing_frequency": "daily", "briefing_send_hour": 7}'::jsonb
WHERE NOT (preferences ? 'briefing_frequency');
