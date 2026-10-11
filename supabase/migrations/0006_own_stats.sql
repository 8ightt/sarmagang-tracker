-- Each player's OWN goals, assists and shots, from EA's hidden event counters
-- (match_event_aggregate_0..3, see docs/ea-data.json). EA's headline numbers add the
-- CPU teammates' goals, assists and shots to one player's line; the counters don't.
-- Null when a line has no counters; the view then falls back to EA's number.

alter table match_players
  add column if not exists own_goals   integer,
  add column if not exists own_assists integer,
  add column if not exists own_shots   integer;

-- sum of one counter id over the four counter strings of a player line (null if there are none)
create or replace function pg_temp.counter(p jsonb, id integer) returns integer language sql immutable as $$
  select case when s = '' then null else coalesce(
    (select sum(split_part(x, ':', 2)::integer)::integer
     from unnest(string_to_array(s, ',')) x
     where split_part(x, ':', 1) = id::text and split_part(x, ':', 2) ~ '^[0-9]+$'), 0) end
  from (select concat_ws(',',
    nullif(p->>'match_event_aggregate_0', ''), nullif(p->>'match_event_aggregate_1', ''),
    nullif(p->>'match_event_aggregate_2', ''), nullif(p->>'match_event_aggregate_3', '')) as s) t
$$;

update match_players mp set
  own_goals   = pg_temp.counter(x.p, 214),
  own_assists = pg_temp.counter(x.p, 11),
  own_shots   = pg_temp.counter(x.p, 217) + pg_temp.counter(x.p, 218)
from matches m,
  lateral (select value as p from jsonb_each(m.raw->'players'->(
    select k from jsonb_object_keys(m.raw->'players') k where k <> m.opp_id limit 1))) x
where m.id = mp.match_id and x.p->>'playername' = mp.player;

-- goals/assists/shots now mean the player's own; ea_* keep EA's numbers (incl. CPU).
-- Column list and order unchanged, so the view can be replaced in place.
create or replace view match_players_effective with (security_invoker = true) as
select
  mp.match_id,
  mp.player,
  f.position                              as position,
  mp.pos,
  mp.archetype,
  coalesce(f.rating, mp.rating)           as rating,
  coalesce(f.goals, mp.own_goals, mp.goals)     as goals,
  coalesce(f.assists, mp.own_assists, mp.assists) as assists,
  coalesce(f.shots, mp.own_shots, mp.shots)     as shots,
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
  mp.direction_saves
from match_players mp
left join match_player_fixes f on f.match_id = mp.match_id and f.player = mp.player;
