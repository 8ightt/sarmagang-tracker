-- An estimate of the rating on +CPU lines, where EA's is averaged with the CPU teammates' and the
-- player's own is unknown until someone enters the in-game RR. lib/rating-model.ts works it out from
-- the player's own counters when a match is saved; scripts/rating-model.mjs --backfill fills older
-- lines. Pages show it as "≈ 6.9 est." and count it in averages, never in records. An entered
-- rating (Fix stats or the bot's /rr) replaces it.
alter table match_players add column if not exists rating_est real;

-- Telegram accounts linked to a gamertag with the bot's /iam, so /rr knows whose game it is.
-- The first account to claim a gamertag keeps it.
create table if not exists telegram_links (
  from_id    bigint primary key,
  player     text not null unique,
  from_name  text,
  linked_at  timestamptz not null default now()
);
alter table telegram_links enable row level security;

-- Same view as 0016 with rating_est at the end: only on +CPU lines whose rating wasn't entered.
create or replace view match_players_effective with (security_invoker = true) as
select
  mp.match_id,
  mp.player,
  f.position                              as position,
  mp.pos,
  mp.archetype,
  -- EA averages the CPU teammates' ratings into the controller's; unknown until Fix stats gives the real one
  coalesce(f.rating, case when mp.controls_cpu then null else mp.rating end) as rating,
  coalesce(f.goals, mp.own_goals, mp.goals)     as goals,
  coalesce(f.assists, mp.own_assists, mp.assists) as assists,
  coalesce(f.shots, mp.own_shots, mp.shots)     as shots,
  coalesce(f.passes_made, mp.own_passes_made, mp.passes_made) as passes_made,
  case when f.passes_made is not null then null else coalesce(mp.own_pass_attempts, mp.pass_attempts) end as pass_attempts,
  coalesce(f.tackles_made, mp.own_tackles_made, mp.tackles_made) as tackles_made,
  case
    when f.tackles_made is not null then null
    when mp.own_tackles_made is not null and mp.own_tackles_made <> mp.tackles_made then null
    else mp.tackle_attempts
  end                                     as tackle_attempts,
  mp.saves,
  mp.reds,
  case
    when f.match_id is not null then f.motm
    when exists (select 1 from match_player_fixes x where x.match_id = mp.match_id and x.motm) then false
    else mp.motm
  end                                     as motm,
  mp.seconds,
  (mp.controls_cpu and f.match_id is null) as controls_cpu,
  (f.match_id is not null)                as fixed,
  mp.goals   as ea_goals,
  mp.assists as ea_assists,
  mp.motm    as ea_motm,
  mp.goals_conceded,
  mp.clean_sheet,
  mp.idle_seconds,
  mp.real_seconds,
  mp.reflex_saves,
  mp.parry_saves,
  mp.punch_saves,
  mp.dive_saves,
  mp.cross_saves,
  mp.direction_saves,
  mp.passes_made     as ea_passes_made,
  mp.pass_attempts   as ea_pass_attempts,
  mp.tackles_made    as ea_tackles_made,
  mp.counters,
  mp.quit,
  mp.rating         as ea_rating,
  case when mp.controls_cpu and f.rating is null then mp.rating_est end as rating_est
from match_players mp
left join match_player_fixes f on f.match_id = mp.match_id and f.player = mp.player;
