-- Add sender_email to feeds for newsletter-type feeds
ALTER TABLE feeds ADD COLUMN sender_email TEXT;
CREATE INDEX idx_feeds_sender_email ON feeds(sender_email) WHERE sender_email IS NOT NULL;
