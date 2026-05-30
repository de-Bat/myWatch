CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('manual', 'smart')),
  smart_rules JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id UUID PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  tmdb_id INT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  position INT NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (playlist_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS playlists_user_id_idx ON playlists(user_id);
CREATE INDEX IF NOT EXISTS playlists_updated_at_idx ON playlists(updated_at);
CREATE INDEX IF NOT EXISTS playlist_items_playlist_id_idx ON playlist_items(playlist_id);
