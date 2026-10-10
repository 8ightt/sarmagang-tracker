-- Near-live checks: every 2 minutes while the club is playing, every 10 minutes otherwise.
--
-- "Playing" = a game was saved in the last 2 hours. The first game of a night is picked up
-- by the 10-minute check, after which the fast checks keep going until 2 hours after the
-- last game. Uses the token stored by 0002_schedule_ea_check.sql, so nothing to paste here.

select cron.unschedule('trigger-ea-check') where exists (select 1 from cron.job where jobname = 'trigger-ea-check');
select cron.schedule(
  'trigger-ea-check',
  '*/2 * * * *',
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
  )
  where exists (select 1 from public.matches where ts > extract(epoch from now())::bigint - 2 * 3600)
     or extract(minute from now())::int % 10 = 0;
  $$
);

-- Check it's working a few minutes later (status 204 = GitHub accepted the trigger):
--   select status_code, created from net._http_response order by created desc limit 5;
