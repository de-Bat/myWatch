CREATE TABLE IF NOT EXISTS installed_plugins (
  id          TEXT        PRIMARY KEY,
  display_name TEXT       NOT NULL,
  source      TEXT        NOT NULL CHECK (source IN ('builtin', 'custom')),
  enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  installed_at TIMESTAMPTZ
);
