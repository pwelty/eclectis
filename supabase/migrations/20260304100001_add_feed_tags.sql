-- Add tags to feeds for folder/category labeling
ALTER TABLE feeds ADD COLUMN tags JSONB NOT NULL DEFAULT '[]';
CREATE INDEX idx_feeds_tags ON feeds USING gin(tags);
