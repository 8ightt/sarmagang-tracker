-- Skill Rating (EA's matchmaking Elo) of both clubs around each match, for opponent strength.
-- EA only gives a club's current rating, so it's saved when a match is first seen:
-- usually a few minutes after the final whistle.
alter table matches
  add column if not exists our_sr integer,
  add column if not exists opp_sr integer;
