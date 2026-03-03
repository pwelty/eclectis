-- Add bookmarked flag to articles (orthogonal to read status)
ALTER TABLE articles ADD COLUMN bookmarked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_articles_bookmarked ON articles(bookmarked) WHERE bookmarked = TRUE;
