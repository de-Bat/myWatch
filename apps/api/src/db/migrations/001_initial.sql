CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  UNIQUE(provider, provider_account_id)
);

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('movie', 'tv');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE watch_status AS ENUM ('planned', 'in_progress', 'watched', 'quit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  media_type media_type NOT NULL,
  status watch_status NOT NULL,
  progress_episode INTEGER CHECK (progress_episode >= 0),
  progress_season INTEGER CHECK (progress_season >= 0),
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  quit_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  device_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, tmdb_id, media_type)
);

CREATE TABLE IF NOT EXISTS media_cache (
  tmdb_id INTEGER NOT NULL,
  media_type media_type NOT NULL,
  title TEXT NOT NULL,
  overview TEXT NOT NULL DEFAULT '',
  poster_path TEXT,
  backdrop_path TEXT,
  release_date DATE,
  genres JSONB NOT NULL DEFAULT '[]',
  vote_average NUMERIC(4,2) NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  runtime INTEGER,
  seasons_count INTEGER,
  show_status TEXT,
  cached_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tmdb_id, media_type)
);
