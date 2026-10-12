-- Wrong club-password attempts, so the edit forms can lock out guessing.
-- who = a hash of the visitor's IP (never the IP itself); one row per wrong attempt.
create table if not exists password_failures (
  id   bigserial primary key,
  who  text not null,
  at   timestamptz not null default now()
);
create index if not exists password_failures_who_at on password_failures (who, at);
alter table password_failures enable row level security;
