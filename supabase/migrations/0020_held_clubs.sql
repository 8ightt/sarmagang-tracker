-- Another club's EA data, held until it has a site of its own (lib/hold.ts). EA only keeps a club's
-- last 10 games of each type, so the regular check saves them here; scripts/replay-held.mjs later
-- sends everything to the club's own site, whose /api/ingest saves it like any other check.
create table if not exists held_matches (
  club_id text not null,
  match_id text not null,
  match_type text not null,
  ts bigint not null,
  data jsonb not null,
  -- the opponent's Skill Rating at the time (EA only gives today's), when it was fetched
  opp_sr integer,
  saved_at timestamptz not null default now(),
  primary key (club_id, match_id)
);

-- the latest club info, squad and totals (info, overall, members, career, search, leaderboard)
create table if not exists held_snapshots (
  club_id text not null,
  key text not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (club_id, key)
);
