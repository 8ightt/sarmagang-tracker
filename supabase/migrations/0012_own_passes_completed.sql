-- Own completed passes are counter 215 alone. Offside passes (153) count as made for EA's
-- passesmade, but the in-game Player Performance screen lists them apart and leaves them out
-- of Completed (checked on dirty8ightt, 13 Oct: 12 passes, 9 completed, 2 intercepted, 1 offside).
-- Pass attempts stay 215 + 153 + 216 + 191.
update match_players
set own_passes_made = coalesce((counters->>'215')::integer, 0)
where own_passes_made is not null and counters is not null;
