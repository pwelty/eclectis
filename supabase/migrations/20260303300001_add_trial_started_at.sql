-- Add trial_started_at to user_profiles for trial-to-paid tracking (M4)

ALTER TABLE user_profiles
    ADD COLUMN trial_started_at TIMESTAMPTZ;

-- Backfill existing rows: use created_at as the trial start
UPDATE user_profiles SET trial_started_at = created_at WHERE trial_started_at IS NULL;

-- Update signup trigger to set trial_started_at for new users
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

    -- Create user profile with trial start
    INSERT INTO public.user_profiles (id, name, trial_started_at)
    VALUES (NEW.id, user_name, NOW());

    -- Create unique newsletter address: {hash}@in.eclectis.io
    email_hash := SUBSTR(MD5(NEW.id::TEXT || NOW()::TEXT), 1, 12);
    INSERT INTO public.newsletter_addresses (user_id, address)
    VALUES (NEW.id, email_hash || '@in.eclectis.io');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
