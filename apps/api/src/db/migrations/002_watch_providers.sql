ALTER TABLE media_cache
  ADD COLUMN IF NOT EXISTS watch_providers JSONB,
  ADD COLUMN IF NOT EXISTS watch_providers_region TEXT,
  ADD COLUMN IF NOT EXISTS watch_providers_cached_at TIMESTAMPTZ;

ALTER TABLE watchlist_items
  ADD COLUMN IF NOT EXISTS custom_platforms TEXT[] NOT NULL DEFAULT '{}';
