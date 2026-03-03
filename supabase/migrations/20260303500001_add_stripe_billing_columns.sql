-- Add Stripe billing columns to user_profiles for free/pro tiers

ALTER TABLE user_profiles
    ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    ADD COLUMN stripe_customer_id TEXT,
    ADD COLUMN stripe_subscription_id TEXT,
    ADD COLUMN subscription_status TEXT,
    ADD COLUMN current_period_end TIMESTAMPTZ;

-- Index for webhook lookups
CREATE INDEX idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_user_profiles_stripe_subscription ON user_profiles(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
