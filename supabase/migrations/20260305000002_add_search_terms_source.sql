-- Add source column to distinguish user-entered from auto-generated search terms
ALTER TABLE search_terms ADD COLUMN source TEXT NOT NULL DEFAULT 'user'
    CHECK (source IN ('user', 'learned'));
