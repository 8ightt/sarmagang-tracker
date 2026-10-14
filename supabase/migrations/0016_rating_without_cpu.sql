-- The rating EA gives whoever runs the CPU is the average of their own in-game RR and every CPU
-- teammate's (LA Seigue FC, 14 Oct: 6.0 and five CPU players = 6.7, EA's figure; Angola fest: 6.6
-- and nine = 7.3). EA doesn't send the CPU's ratings, so the player's own can't be worked out:
-- on those lines rating is null unless Fix stats gives the in-game RR. EA's stays as ea_rating.
-- Same view as 0013 with that rating and ea_rating at the end.
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
  mp.rating         as ea_rating
from match_players mp
left join match_player_fixes f on f.match_id = mp.match_id and f.player = mp.player;
