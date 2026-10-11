-- More of EA's match feed: goals conceded and clean sheets per player, idle (AFK) time,
-- the keeper's saves by type, and both clubs' kit colours. Everything is already in
-- matches.raw, so this also fills the new columns for every saved match.

alter table match_players
  add column if not exists goals_conceded   integer not null default 0, -- while this player was on the pitch
  add column if not exists clean_sheet      boolean not null default false,
  add column if not exists idle_seconds     integer not null default 0, -- real-world seconds EA counted as idle
  add column if not exists real_seconds     integer not null default 0, -- real-world seconds in the match
  add column if not exists reflex_saves     integer not null default 0,
  add column if not exists parry_saves      integer not null default 0,
  add column if not exists punch_saves      integer not null default 0,
  add column if not exists dive_saves       integer not null default 0,
  add column if not exists cross_saves      integer not null default 0,
  add column if not exists direction_saves  integer not null default 0;

alter table matches
  add column if not exists our_kit integer[], -- home kit colours EA sent with the match (body, trim, sleeve, extra)
  add column if not exists opp_kit integer[];

create or replace function pg_temp.int_of(v text) returns integer language sql immutable as
$$ select case when v ~ '^-?[0-9]+$' then v::integer else 0 end $$;

create or replace function pg_temp.kit_of(c jsonb) returns integer[] language sql immutable as $$
  select case when c->'details'->'customKit' is null then null else array[
    pg_temp.int_of(c->'details'->'customKit'->>'kitColor1'),
    pg_temp.int_of(c->'details'->'customKit'->>'kitColor2'),
    pg_temp.int_of(c->'details'->'customKit'->>'kitColor3'),
    pg_temp.int_of(c->'details'->'customKit'->>'kitColor4')] end
$$;

update match_players mp set
  goals_conceded  = pg_temp.int_of(p->>'goalsconceded'),
  clean_sheet     = pg_temp.int_of(p->>'cleansheetsany') > 0,
  idle_seconds    = pg_temp.int_of(p->>'realtimeidle'),
  real_seconds    = pg_temp.int_of(p->>'realtimegame'),
  reflex_saves    = pg_temp.int_of(p->>'reflexSaves'),
  parry_saves     = pg_temp.int_of(p->>'parrySaves'),
  punch_saves     = pg_temp.int_of(p->>'punchSaves'),
  dive_saves      = pg_temp.int_of(p->>'ballDiveSaves'),
  cross_saves     = pg_temp.int_of(p->>'crossSaves'),
  direction_saves = pg_temp.int_of(p->>'goodDirectionSaves')
from matches m,
  lateral (select value as p from jsonb_each(m.raw->'players'->(
    select k from jsonb_object_keys(m.raw->'players') k where k <> m.opp_id limit 1))) x
where m.id = mp.match_id and x.p->>'playername' = mp.player;

update matches m set
  our_kit = pg_temp.kit_of((select value from jsonb_each(m.raw->'clubs') where key <> m.opp_id limit 1)),
  opp_kit = pg_temp.kit_of(m.raw->'clubs'->m.opp_id);

-- New columns go at the end so the view can be replaced in place.
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
