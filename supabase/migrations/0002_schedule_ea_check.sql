-- Start the "Check EA for new matches" GitHub workflow every 10 minutes.
--
-- GitHub's own schedule runs the workflow only every few hours on quiet repos, and EA
-- keeps just the last 10 games, so Supabase triggers it instead (pg_cron + pg_net).
--
-- Before running: replace PASTE_YOUR_GITHUB_TOKEN_HERE with a fine-grained token that
-- has access to only this repository and the permission "Actions: Read and write".
-- The token is stored encrypted in Supabase Vault, not in this table or the repo.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- store (or replace) the token
select vault.create_secret('PASTE_YOUR_GITHUB_TOKEN_HERE', 'github_dispatch_token', 'Starts the EA check workflow')
where not exists (select 1 from vault.secrets where name = 'github_dispatch_token');
select vault.update_secret(id, 'PASTE_YOUR_GITHUB_TOKEN_HERE')
from vault.secrets where name = 'github_dispatch_token';

-- (re)create the schedule
select cron.unschedule('trigger-ea-check') where exists (select 1 from cron.job where jobname = 'trigger-ea-check');
select cron.schedule(
  'trigger-ea-check',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://api.github.com/repos/8ightt/sarmagang-tracker/actions/workflows/poll-ea.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'sarmagang-tracker',
      'Content-Type', 'application/json'
    ),
    body := '{"ref": "main"}'::jsonb
  );
  $$
);

-- Check it's working a few minutes later (status 204 = GitHub accepted the trigger):
--   select status_code, content, created from net._http_response order by created desc limit 5;
