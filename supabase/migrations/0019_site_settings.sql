-- Settings the club edits on /settings (look, player profiles, seasons, league rules).
-- One row, key 'main'; its data is laid over config/settings.json (lib/config.ts).
create table if not exists site_settings (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
