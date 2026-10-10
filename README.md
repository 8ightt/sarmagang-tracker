# Sarma gang tracker

Live stats site for **Sarma gang**, our EA FC 27 Clubs team (PS5).
Next.js on Vercel, data in Supabase, EA checked by a GitHub Actions workflow.

- **Club**: record, division, form, reputation, squad, recent results, tactics and kits
- **Players**: sortable leaderboard and a profile per player with a match-by-match log
- **Matches**: every game the site has saved, with team stats, player ratings and the captain
- **Records**: hall of fame, single-game records, streaks and the hall of shame

## Why it saves matches itself

EA's Clubs API only returns a club's **last 10 games**, and keeps season totals but no
per-game history. The site checks EA on a schedule and stores every match in Supabase,
so nothing drops off.

## What EA does and doesn't give us

| Available from EA | Not available, so the site lets the club fill it in |
|---|---|
| Club record, division, points, streaks, reputation tier | Captain per match |
| Crest, stadium name, kit colours | Tactics (saved with their in-game share codes) |
| Per player: games, goals, assists, ratings, MOTM, passes, tackles, red cards | Exact formation slot (e.g. CAM): set in `config/settings.json` |
| Per match: every human player's line, team totals, who quit early | Anything about the CPU teammates |

**Playing ANY:** EA puts the CPU teammates' passes, tackles and cards on the line of
whoever controls them. The site detects that player per match (marked **+CPU**), and any
red card in such a game can be moved to the CPU with the club password.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (a region near you, e.g. Frankfurt).
2. **SQL Editor → New query**, paste `supabase/migrations/0001_init.sql`, run it.
3. **Project Settings → Database → Connection string → Transaction pooler**: copy it
   (port `6543`) and fill in your database password. That's `DATABASE_URL`.

### 2. Vercel

1. **Add New → Project**, import `sarmagang-tracker` from GitHub.
2. Add the environment variables from `.env.example`: at least `DATABASE_URL`,
   `CLUB_PASSWORD` and `CRON_SECRET` (`openssl rand -hex 32`).
3. Deploy.

### 3. GitHub Actions (the regular EA check)

EA's bot filter blocks requests from Vercel's servers, so the GitHub workflow fetches the
club's data from EA itself and posts it to the site's `/api/ingest` endpoint. In the repo: **Settings → Secrets and variables → Actions**, add

- `SITE_URL`: e.g. `https://sarmagang-tracker.vercel.app`
- `CRON_SECRET`: the same value as in Vercel

Then **Actions → Check EA for new matches → Run workflow** once, and open
`/api/health` on the site: it shows how many matches are saved and when EA was last checked.

### 4. Optional

- **Discord**: set `DISCORD_WEBHOOK_URL` and every new result gets posted to your channel.
- **Positions, nicknames, bios, Pro pictures**: edit `config/settings.json`. Pictures go in
  `public/pros/` and are referenced as `/pros/name.png`.

## Local development

```bash
npm install
cp .env.example .env.local   # point DATABASE_URL at a Supabase project or any Postgres
npm run dev
```

Set `EA_FIXTURE_DIR=./fixtures` to use the saved EA responses in `fixtures/` instead of the
live API, then trigger a check with:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
```

## Notes

- EA's Clubs API is unofficial and undocumented. It occasionally goes down or changes; the
  site keeps showing what it has saved and picks up again on the next check.
- Crests, flags and the reputation badge are loaded from EA's servers. This is a fan site,
  not affiliated with EA.
