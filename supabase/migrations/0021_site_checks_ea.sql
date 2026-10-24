-- The site checks EA itself (app/api/cron/poll, through its Python function), started from here:
-- every 2 minutes while the club is playing (a game saved in the last 2 hours), every 10 otherwise.
-- Replaces the GitHub workflow trigger from 0002/0003, which needed a runner to boot first;
-- the workflow's own half-hourly schedule stays as a backup.
--
-- Reads two secrets from Supabase Vault, so nothing secret is in this file:
--   site_url     the site's production address, e.g. https://sarmagang-tracker.vercel.app
--   cron_secret  the CRON_SECRET set on Vercel for that site
-- Until both are stored, the job does nothing and the GitHub trigger keeps running.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('site-checks-ea') where exists (select 1 from cron.job where jobname = 'site-checks-ea');
select cron.schedule(
  'site-checks-ea',
  '*/2 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') || '/api/cron/poll',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    -- a check takes ~10-20 s; pg_net's default 5 s would cut it off
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.secrets where name = 'site_url')
    and exists (select 1 from vault.secrets where name = 'cron_secret')
    and (exists (select 1 from public.matches where ts > extract(epoch from now())::bigint - 2 * 3600)
         or extract(minute from now())::int % 10 = 0);
  $$
);

select cron.unschedule('trigger-ea-check')
where exists (select 1 from cron.job where jobname = 'trigger-ea-check')
  and exists (select 1 from vault.secrets where name = 'site_url');

-- Check it's working a few minutes later (status 200 = the site saved a check):
--   select status_code, left(content::text, 120), created from net._http_response order by created desc limit 5;
