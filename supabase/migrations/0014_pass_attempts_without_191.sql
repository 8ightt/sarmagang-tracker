-- Own pass attempts are 215 + 216 + 153, without counter 191. On 42,451 human-only FC 27 lines
-- from the EA FC Pro Clubs API research dataset, 215 + 216 + 153 equals EA's passattempts on
-- 89.1% and adding 191 drops it to 86.9%; 1,038 of the 1,252 lines where 191 fires already
-- match without it.
update match_players
set own_pass_attempts = coalesce((counters->>'215')::integer, 0)
                      + coalesce((counters->>'216')::integer, 0)
                      + coalesce((counters->>'153')::integer, 0)
where own_pass_attempts is not null and counters is not null;
