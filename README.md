# Sarma gang tracker

Live stats site for **Sarma gang**, our EA FC 27 Clubs team (PS5).
Next.js on Vercel, data in Supabase, near-live: EA checked every 2 minutes while the club is playing.

- **Club**: record, division and reputation ladders, distance to EA's world top 100, season
  tracker, form, squad, recent results, tactics and kits
- **World top 100**: EA's 100 best clubs by Skill Rating, and how far Sarma gang is from #100
- **Players**: sortable leaderboard (goals, assists, rating, clean sheets…) and a profile per
  player with a match-by-match log, clean sheets, goals conceded, saves by type and, for
  players who switch, results per archetype (Creator, Magician…)
- **Seasons**: every saved game, filtered by season, type (league, playoffs, friendly),
  result, dates or opponent, with the record and goals for the selection
- **Match pages**: each game with both clubs' kits, team stats, player
  ratings, goals the CPU scored, keepers' saves by type, AFK flags and the captain, plus
  interceptions, through passes, dribbles, second assists, aerial duels, possession and fouls
  per player from EA's hidden counters
- **Records**: hall of fame, single-game records, streaks and the hall of shame
- **Analysis**: form, results with and without each player, best duos, positions, and
  results against stronger and weaker opponents (by EA Skill Rating)

## Why it saves matches itself

EA's Clubs API only returns a club's **last 10 games**, and keeps season totals but no
per-game history. The site checks EA on a schedule and stores every match in Supabase,
so nothing drops off.

## What EA does and doesn't give us

| Available from EA | Not available, so the site lets the club fill it in |
|---|---|
| Club record, division, points, streaks, reputation tier, Skill Rating | Captain per match |
| Crest, stadium name, kit colours (ours and the opponent's) | Tactics (saved with their in-game share codes) |
| Per player: games, goals, assists, ratings, MOTM, passes, tackles, red cards | Exact formation slot (e.g. CAM): set in `config/settings.json` |
| Per match: every human player's line, team totals, who quit early, goals conceded, idle time, saves by type, archetype | The CPU teammates' own passes, tackles and cards |

[docs/ea-api.md](docs/ea-api.md) maps every field EA sends, endpoint by endpoint: what it means,
how sure we are of it (verified, assumed, unknown or useless) and where the site uses it. It's
generated from [docs/ea-data.json](docs/ea-data.json) by `node scripts/ea-docs.mjs`; pass a folder
of saved EA responses to list any field EA has added that the doc doesn't cover yet.

## Own stats vs EA's numbers

When a player runs the CPU teammates (playing ANY, or one of only two humans), EA adds the
CPU's goals, assists, shots, passes, tackles and cards to that player's line. Each player
line also carries hidden event counters that count **only the human's own** actions. The
site uses them for goals (counter 214), assists (11) and shots (217 + 218), so:

- Goals, assists and shots everywhere are each player's own. Goals the CPU scored show as
  **CPU** among the scorers on match pages and in Discord posts.
- Passes (counter 215 completed, plus 216 missed and 153 offside) and tackles won (164) are each
  player's own too. These are newer finds: they match EA exactly on most human-only lines
  and within 1–2 on the rest. They also keep the stats of a player who quit, which EA wipes.
- Season totals take the CPU's share out for every game the site saved; EA's figure stays
  visible as "EA: n incl. CPU". Games from before the site saved matches can't be corrected.
- Red cards: a player's own red shows in their counters as a straight red (96) or a second
  yellow (95 + 213). An EA red without either is the CPU's, and the site moves it to the CPU by
  itself. A red with them stays with the player; if it was still the CPU's, it can be moved
  with the club password (and given back the same way).
- Tackle attempts still include the CPU's for whoever controls it. The site marks that line
  **+CPU**, and **Fix stats** takes the real numbers from the in-game screen.
- Ratings: EA's on that line is the average of the player's and every CPU teammate's, and EA
  doesn't send the CPU's. The site shows an estimate instead, "≈ 6.9 est.", worked out from the
  player's own counters and the result by a model (`lib/rating-model.ts`) trained on the research
  dataset's human-only lines and tuned on our games without the CPU: within 0.5 of EA's rating
  for about 85% of lines. Estimates count in averages, never in records. The real in-game rating
  replaces it: send it to the bot (`/iam <gamertag>` once, then `/rr 7.4`) or use **Fix stats**.
  Retrain with `node --experimental-strip-types --env-file=.env.local scripts/rating-model.mjs <csv>`,
  then `... scripts/rating-model.mjs --backfill`.

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
club's data from EA itself and posts it to the site's `/api/ingest` endpoint. For games from
the last 3 hours it also fetches each opponent's Skill Rating (one call per opponent; EA
only gives today's rating, so it's saved right after the game). In the repo:
**Settings → Secrets and variables → Actions**, add

- `SITE_URL`: e.g. `https://sarmagang-tracker.vercel.app`
- `CRON_SECRET`: the same value as in Vercel

Then **Actions → Check EA for new matches → Run workflow** once, and open
`/api/health` on the site: it shows how many matches are saved and when EA was last checked.

### 4. Check every 10 minutes

GitHub runs scheduled workflows late, often hours apart, and EA keeps only the last
10 games. Supabase starts the workflow every 10 minutes instead:

1. Create a fine-grained token at **GitHub → Settings → Developer settings → Fine-grained
   tokens**: repository access *only* `sarmagang-tracker`, permission **Actions: Read and write**.
2. In the Supabase SQL Editor, paste `supabase/migrations/0002_schedule_ea_check.sql`,
   replace both `PASTE_YOUR_GITHUB_TOKEN_HERE` with the token, and run it. The token is
   kept encrypted in Supabase Vault.

Then run `supabase/migrations/0003_live_schedule.sql` the same way (no token needed): it
checks every 2 minutes while the club is playing (a game in the last 2 hours) and every
10 minutes otherwise. Open pages refresh themselves every 30 seconds.

### 5. Real stats and the season tracker

Run `supabase/migrations/0004_stat_fixes_and_season.sql` once. It adds:

- **Fix stats** on every match page: EA puts the CPU teammates' passes, tackles and cards on
  one player's line and only records forward/midfielder/defender/keeper. Copy the real lines
  and exact positions from the in-game Player Performance screen; totals and records follow.
- **Season tracker** on the club page, worked out from every result: win +3 points,
  draw +1, loss −1 chance. Reaching the division's target starts the promotion match, a short
  series that needs one more win per division (Division 4: 2 wins from 3). Missing promotion
  gives all chances back and leaves the points one win short of the target (Division 3: 9 of
  12; `league.pointsAfterMissedPromotion` if a division differs). Losing the last
  chance means a relegation match (win to stay, lose to go down). Series lengths per
  division are in `config/settings.json` under `league.promotion`.
  Points targets per division and the chances you get back after surviving are set in
  `config/settings.json` under `league`.
- **Season dates**: each EA season's dates and when its end-of-season Playoffs open go in
  `config/settings.json` under `seasons` (copied from the in-game Season Info screen); the
  club page shows them with a countdown. These Season Playoffs are separate from the
  promotion match: about 15 games in the highest division the club reached, until the
  season ends. While they run, the club page shows a Playoffs card (games, W-D-L, points,
  Skill Rating change) and league points and chances stay paused. Playoff games still count
  in every other stat.

### 6. Automatic migrations

Add a `DATABASE_URL` repository secret in GitHub (same value as in Vercel). From then on
the **Apply database migrations** workflow runs every new file in `supabase/migrations`
when it's pushed, and remembers what ran in a `schema_migrations` table. Start it once by
hand under Actions → Apply database migrations → Run workflow to catch up.

Migrations that add columns also fill them from the EA data already saved
(`matches.raw`), so new stats cover past games too. Push a migration before the code that
uses it: the pages work without the new columns, but saving matches doesn't.

### 7. Optional

- **Discord**: set `DISCORD_WEBHOOK_URL` and every new result gets posted to your channel.
- **Screenshot bot**: set `TELEGRAM_TOKEN` (from @BotFather) in Vercel and `.env.local`, then run
  `node --env-file=.env.local scripts/telegram-setup.mjs` once. Teammates send in-game screenshots to
  the bot; they're kept in a private table until `node --env-file=.env.local scripts/telegram-pull.mjs`
  copies them into `inbox/` (local only) and clears them. Limits: 20 MB a file, 150 a day per sender.
  The bot also takes ratings: `/iam <gamertag>` links a Telegram account to a gamertag (the first
  account to claim one keeps it), then `/rr 7.4` saves that player's in-game rating for the game
  they just played, if they ran the CPU: it has to be their latest saved game and under an hour
  old, so a game that isn't saved yet can't send it to an older one. `/rr 7.4 Toz` picks the latest
  CPU game against a club matching "Toz". `/undo` puts back what the last `/rr` changed.
- **Season by archetype**: every player page splits the season by archetype from the saved league
  games, with the rest of EA's season totals as "Earlier games". EA's API can't split those, but the game
  can. Copy a player's in-game Archetypes › Statistics screen (one screenshot per archetype) into
  `config/archetype-stats.json` with the time it was taken; the player page then shows the
  whole season per archetype, plus every game saved after that time.
- **Positions, nicknames, bios, Pro pictures**: edit `config/settings.json`. Pictures go in
  `public/pros/` and are referenced as `/pros/name.png`.

## Local development

```bash
npm install
cp .env.example .env.local   # point DATABASE_URL at a Supabase project or any Postgres
npm run dev
```

Set `EA_FIXTURE_DIR=./fixtures` to use the saved EA responses in `fixtures/` instead of the
live API. They're trimmed samples without the hidden event counters, so own goals, assists
and shots fall back to EA's numbers. Trigger a check with:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
```

## Notes

- EA's Clubs API is unofficial and undocumented. It occasionally goes down or changes; the
  site keeps showing what it has saved and picks up again on the next check.
- Crests, flags and the reputation badge are loaded from EA's servers. This is a fan site,
  not affiliated with EA.

## Thanks

Other people's work this site builds on. Thank you!

- **[frdceri/clubs-hub](https://github.com/frdceri/clubs-hub)**: their lookup tables
  (`lib/lookups.js`) cracked two of EA's codes for us: which `archetypeid` is which FC 27
  archetype, and that a club's `regionId` is ASCII text in hex (e.g. 5719381 → "WEU").
  Both are noted in [docs/ea-data.json](docs/ea-data.json).
- **[EA FC Pro Clubs API research](https://github.com/Interactive-63/eafc-pro-clubs-api-research)**
  (Interactive-63): their decoded event counters, worked out on 51,395 FC 27 player lines, give
  the site interceptions, second assists, through passes, dribbles, aerial duels, possession
  won/lost, fouls and yellow cards, and explained counter 153 (offside passes). Their raw dataset of those lines
  also showed our counter 191 doesn't belong in missed passes, decoded red cards (96 or a second
  yellow) and cross saves (51 + 52), and is what the rating estimate for +CPU lines learned from. Found through
  [Pro Clubs Tracker](https://proclubstracker.com), which credits it. Mapped in
  [docs/ea-data.json](docs/ea-data.json).
- **[Pro Clubs Analytics](https://www.proclubsanalytics.com)**: the division and reputation
  ladders on the club page follow their club overview, which also showed us the name of the
  first reputation tier ("Hometown Heroes").
