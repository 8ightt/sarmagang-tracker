-- The promotion match series as shown in the lobby when the season state was set:
-- games played and won so far. Lets "Set it from the game" pick up a series already
-- underway (AFC DWS, 1 Nov: 16/16 in Division 2 with one promotion game already won).
alter table season_state add column if not exists promotion_played integer not null default 0;
alter table season_state add column if not exists promotion_wins integer not null default 0;
