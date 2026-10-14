-- Players who quit mid-game (EA userResult 6). EA wipes their line to 0 — goals conceded
-- included — but the hidden counters survive. The game ends there for the club and counts as a
-- loss, so a quitter conceded the team's goals against.
alter table match_players add column if not exists quit boolean not null default false;

update match_players mp set quit = true, goals_conceded = m.goals_against
from matches m,
  lateral (select value as p from jsonb_each(m.raw->'players'->(
    select k from jsonb_object_keys(m.raw->'players') k where k <> m.opp_id limit 1))) x
where m.id = mp.match_id and x.p->>'playername' = mp.player and x.p->>'userResult' = '6';

-- same view as 0010 plus quit at the end
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
  mp.tackles_made    as ea_tackles_made,
  mp.counters,
  mp.quit
from match_players mp
left join match_player_fixes f on f.match_id = mp.match_id and f.player = mp.player;
