ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS display_overrides JSONB DEFAULT '{}';
