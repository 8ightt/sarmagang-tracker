-- Stat fixes and the league season tracker.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- 1. Real numbers from the in-game post-match screen.
--    EA's public data puts every CPU teammate's stats on one human's line, so the club
--    can enter the true line per player. Empty fields keep EA's value.
create table if not exists match_player_fixes (
  match_id     text not null references matches (id) on delete cascade,
  player       text not null,
  position     text,          -- exact position played, e.g. ST, CAM (EA only logs forward/midfielder/…)
  rating       real,
  goals        integer,
  assists      integer,
  shots        integer,
  passes_made  integer,
  tackles_made integer,
  motm         boolean not null default false,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  primary key (match_id, player)
);
alter table match_player_fixes enable row level security;

-- Every read goes through this view, so a fix shows up everywhere: match pages,
-- player logs and records.
create or replace view match_players_effective with (security_invoker = true) as
select
  mp.match_id,
  mp.player,
  f.position                              as position,
  mp.pos,
  mp.archetype,
  coalesce(f.rating, mp.rating)           as rating,
  coalesce(f.goals, mp.goals)             as goals,
  coalesce(f.assists, mp.assists)         as assists,
  coalesce(f.shots, mp.shots)             as shots,
  coalesce(f.passes_made, mp.passes_made) as passes_made,
  case when f.passes_made is not null then null else mp.pass_attempts end   as pass_attempts,
  coalesce(f.tackles_made, mp.tackles_made) as tackles_made,
  case when f.tackles_made is not null then null else mp.tackle_attempts end as tackle_attempts,
  mp.saves,
  mp.reds,
  case
    when f.match_id is not null then f.motm
    when exists (select 1 from match_player_fixes x where x.match_id = mp.match_id and x.motm) then false
    else mp.motm
  end                                     as motm,
  mp.seconds,
  -- a corrected line is the player's own, without the CPU's stats
  (mp.controls_cpu and f.match_id is null) as controls_cpu,
  (f.match_id is not null)                as fixed,
  -- EA's original numbers, so season totals can be adjusted by the difference
  mp.goals   as ea_goals,
  mp.assists as ea_assists,
  mp.motm    as ea_motm
from match_players mp
left join match_player_fixes f on f.match_id = mp.match_id and f.player = mp.player;

-- 2. League season: points towards the target, and chances left.
--    Win +3 points, draw +1 point, loss -1 chance. Reaching the target = promotion,
--    running out of chances ends the season. Results after anchor_ts are applied
--    automatically; the club can reset the state from the site.
create table if not exists season_state (
  id         integer primary key default 1 check (id = 1),
  division   integer not null,
  points     integer not null default 0,
  chances    integer not null default 3,
  target     integer not null,
  anchor_ts  bigint  not null,   -- state is as of this moment (unix seconds)
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table season_state enable row level security;

-- Starting point: the lobby after the 8–1 vs betong blokka on 11 Oct showed
-- Division 4, 4/9 points, 3 chances.
insert into season_state (id, division, points, chances, target, anchor_ts, updated_by)
values (1, 4, 4, 3, 9, coalesce((select ts from matches where id = '89228290200488'), 1791677124), 'setup')
on conflict (id) do nothing;
