ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'gemini';
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_base_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_api_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_model TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recap_min_interval INTEGER DEFAULT 5;

CREATE TABLE IF NOT EXISTS progress_recaps (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type media_type NOT NULL,
  progress_percent INTEGER,
  progress_season INTEGER,
  progress_episode INTEGER,
  recap_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tmdb_id, media_type)
);
