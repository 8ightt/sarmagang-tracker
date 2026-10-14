-- A red card is the player's own only if their counters show a straight red (96) or a second
-- yellow (95 + 213 >= 2): on 42,451 human-only lines of the EA FC Pro Clubs API research dataset
-- every EA red has one of these. An EA red without them is the CPU's, so it's moved to the CPU
-- like the manual "CPU card" button does. Lines the club already flagged are left alone.
insert into corrections (match_id, player, stat, amount, note, created_by)
select mp.match_id, mp.player, 'reds', mp.reds,
  'CPU card: no straight red (96) or second yellow (95 + 213) in the player''s own counters', 'auto'
from match_players mp
where mp.reds > 0 and mp.counters is not null
  and coalesce((mp.counters->>'96')::integer, 0) = 0
  and coalesce((mp.counters->>'95')::integer, 0) + coalesce((mp.counters->>'213')::integer, 0) < 2
  and not exists (
    select 1 from corrections c where c.match_id = mp.match_id and c.player = mp.player and c.stat = 'reds');
