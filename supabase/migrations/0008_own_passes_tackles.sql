-- Each player's OWN passes and tackles, from EA's hidden event counters (docs/ea-data.json):
--   passes made    = 215 + 153
--   pass attempts  = 215 + 216 + 153 + 191
--   tackles made   = 164
-- EA's headline passes and tackles add the CPU teammates' to one player's line; the counters
-- don't. They also keep a quitter's numbers, which EA wipes to 0. No counter for tackle attempts yet.

alter table match_players
  add column if not exists own_passes_made   integer,
  add column if not exists own_pass_attempts integer,
  add column if not exists own_tackles_made  integer;

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
  own_passes_made   = pg_temp.counter(x.p, 215) + pg_temp.counter(x.p, 153),
  own_pass_attempts = pg_temp.counter(x.p, 215) + pg_temp.counter(x.p, 216) + pg_temp.counter(x.p, 153) + pg_temp.counter(x.p, 191),
  own_tackles_made  = pg_temp.counter(x.p, 164)
from matches m,
  lateral (select value as p from jsonb_each(m.raw->'players'->(
    select k from jsonb_object_keys(m.raw->'players') k where k <> m.opp_id limit 1))) x
where m.id = mp.match_id and x.p->>'playername' = mp.player;

-- The CPU nearly always passes but rarely scores, so EA's passes running 5+ above the counter
-- finds controllers that the goals/assists/shots check missed (one per match, the biggest gap).
update match_players mp set controls_cpu = true
from (
  select distinct on (match_id) match_id, player
  from match_players
  where own_passes_made is not null and passes_made - own_passes_made >= 5 and seconds > 0
  order by match_id, passes_made - own_passes_made desc
) g
where mp.match_id = g.match_id and mp.player = g.player
  and not exists (select 1 from match_players x where x.match_id = mp.match_id and x.controls_cpu);

-- passes/tackles now mean the player's own; ea_* keep EA's numbers (incl. CPU). Tackle attempts
-- only show where they still fit the own tackles. New columns go at the end so the view can be replaced.
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
  mp.tackles_made    as ea_tackles_made
from match_players mp
left join match_player_fixes f on f.match_id = mp.match_id and f.player = mp.player;
