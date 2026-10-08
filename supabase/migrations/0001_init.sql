-- Sarma gang stats: schema
-- Run once in the Supabase SQL editor (or `supabase db push`).

create table if not exists matches (
  id            text primary key,
  ts            bigint  not null,            -- kick-off, unix seconds
  match_type    text    not null,            -- leagueMatch / playoffMatch / friendlyMatch
  opp_id        text,
  opp_name      text,
  opp_crest     text,
  goals_for     integer not null,
  goals_against integer not null,
  result        text    not null check (result in ('W', 'D', 'L')),
  dnf           boolean not null default false, -- we won because they quit
  minutes       integer,
  team          jsonb,                       -- team totals, ours and theirs
  raw           jsonb   not null,            -- EA's full match record
  saved_at      timestamptz not null default now()
);
create index if not exists matches_ts_idx on matches (ts desc);

create table if not exists match_players (
  match_id        text    not null references matches (id) on delete cascade,
  player          text    not null,
  pos             text,
  archetype       integer,
  rating          real,
  goals           integer not null default 0,
  assists         integer not null default 0,
  shots           integer not null default 0,
  passes_made     integer not null default 0,
  pass_attempts   integer not null default 0,
  tackles_made    integer not null default 0,
  tackle_attempts integer not null default 0,
  saves           integer not null default 0,
  reds            integer not null default 0,
  motm            boolean not null default false,
  seconds         integer not null default 0,
  controls_cpu    boolean not null default false, -- ran the CPU teammates (ANY / short-handed)
  primary key (match_id, player)
);
create index if not exists match_players_player_idx on match_players (player);

create table if not exists snapshots (
  key        text primary key,  -- info / overall / search / members / career
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists corrections (
  id         bigint generated always as identity primary key,
  match_id   text references matches (id) on delete cascade, -- null = season-level
  player     text not null,
  stat       text not null check (stat in ('reds')),
  amount     integer not null,
  note       text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists match_notes (
  match_id   text primary key references matches (id) on delete cascade,
  captain    text,               -- EA doesn't record the captain
  note       text,
  updated_at timestamptz not null default now()
);

create table if not exists tactics (
  id         bigint generated always as identity primary key,
  name       text not null,
  formation  text,
  code       text not null,      -- EA FC tactic share code
  note       text,
  added_by   text,
  created_at timestamptz not null default now()
);

create table if not exists poll_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  ok          boolean not null,
  new_matches integer not null default 0,
  message     text
);

-- The site talks to the database server-side only, with its own connection string.
-- Lock the tables away from Supabase's public API.
alter table matches       enable row level security;
alter table match_players enable row level security;
alter table snapshots     enable row level security;
alter table corrections   enable row level security;
alter table match_notes   enable row level security;
alter table tactics       enable row level security;
alter table poll_log      enable row level security;
