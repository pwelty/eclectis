-- Add HTTP caching columns to feeds for ETag/Last-Modified support
ALTER TABLE feeds ADD COLUMN etag TEXT;
ALTER TABLE feeds ADD COLUMN last_modified TEXT;
ALTER TABLE feeds ADD COLUMN last_item_count INTEGER;
