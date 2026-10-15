-- What the bot's last /rr changed for each linked account, so /undo can put it back:
-- the match, and the rating that was there before (null with had_fix false = there was no fix row).
alter table telegram_links
  add column if not exists last_match_id text,
  add column if not exists last_prev_rating real,
  add column if not exists last_had_fix boolean,
  add column if not exists last_at timestamptz;
