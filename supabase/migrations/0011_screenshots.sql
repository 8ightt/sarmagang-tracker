-- Screenshots teammates send to the Telegram bot (/api/telegram). The image is kept here until
-- scripts/telegram-pull.mjs copies it into the local inbox/ folder, then `bytes` is cleared.
create table if not exists screenshots (
  id             bigserial primary key,
  update_id      bigint unique,
  chat_id        bigint not null,
  from_id        bigint,
  from_name      text,
  caption        text,
  media_group_id text,
  file_id        text not null,
  file_unique_id text not null unique,
  mime           text,
  size           integer,
  bytes          bytea,
  received_at    timestamptz not null default now(),
  pulled_at      timestamptz
);
create index if not exists screenshots_from_received on screenshots (from_id, received_at);
create index if not exists screenshots_unpulled on screenshots (id) where pulled_at is null;
alter table screenshots enable row level security;
