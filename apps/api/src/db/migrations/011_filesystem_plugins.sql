ALTER TABLE installed_plugins DROP CONSTRAINT IF EXISTS installed_plugins_source_check;
ALTER TABLE installed_plugins ADD CONSTRAINT installed_plugins_source_check CHECK (source IN ('builtin', 'custom', 'filesystem'));
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS path TEXT;
