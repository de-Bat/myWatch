ALTER TABLE users ADD COLUMN IF NOT EXISTS jellyfin_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jellyfin_api_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jellyfin_user_id TEXT;

CREATE TABLE IF NOT EXISTS jellyfin_progress (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type media_type NOT NULL,
  jellyfin_status TEXT NOT NULL,
  movie_percent INTEGER,
  season INTEGER,
  episode INTEGER,
  episode_percent INTEGER,
  watched_episodes INTEGER,
  total_episodes INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tmdb_id, media_type)
);
