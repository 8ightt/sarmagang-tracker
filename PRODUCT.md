# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Captain / installer.** One person per club deploys a copy and runs setup once. Two paths from the same codebase:
  - *Easy:* non-technical captain. One-click "Deploy to Vercel", then everything else happens in the app: a setup screen on first visit, and a settings page for colours, crest and nicknames. Never needs to read docs.
  - *Advanced:* technical user who forks and sets up manually for full control (own database, poller, code changes).
- **Teammates.** The club's players. Mostly on phones, checking results, ratings and records during and after play sessions.
- **Outsiders.** Each club's site is also its public face: shared in group chats and with rivals, mostly for banter.

Sarma gang (EA FC Clubs, PS5) is the first club using it; the current deploy and repo name are theirs.

## Product Purpose

FC Clubs Tracker is a reusable stats tracker for EA SPORTS FC Clubs. Each club deploys its own copy. It saves every match itself, because EA's Clubs API only returns a club's last 10 games and keeps season totals but no per-game history. It turns those saved games into club, player, match, season, record and analysis pages.

Success: a captain gets a working site for their club without docs, and the squad keeps coming back to it during sessions and to argue about who's best.

## Positioning

- Keeps full match history that EA throws away.
- Separates each player's own numbers from the CPU teammates' share that EA mixes into a human's line, using EA's hidden per-player counters. Estimates are labelled; real values from the game replace them.
- One club per deploy: the site belongs to that club, under its own name, crest and colours. It is not a shared multi-club portal.

## Operating Context

- **First visit (planned, not built yet):** setup screen. The captain types the exact club name, picks their club from EA search results, and picks the platform. All EA platforms are supported; setup chooses. Today the club ID and platform still come from environment variables (`lib/config.ts`).
- **Settings page (planned):** colours, crest, nicknames, editable in the app.
- **Play sessions:** EA is checked every 2 minutes while the club is playing (a game in the last 2 hours) and every 10 minutes otherwise; open pages refresh every 30 seconds.
- **Corrections:** a club password unlocks **Fix stats** on match pages (real lines and positions from the in-game Player Performance screen) and moving red cards to and from the CPU. A Telegram screenshot bot (`/iam`, `/rr`, `/undo`) lets players send real ratings.
- **Sharing:** links go into group chats and to rival clubs.

## Capabilities and Constraints

- **Pages:** Club (record, division and reputation ladders, distance to the world top 100, season tracker, Playoffs countdown, form, squad, results, tactics, kits), World top 100, Players (leaderboard and profiles), Seasons (filterable match list), Match pages, Records (hall of fame, single-game records, streaks, hall of shame), Analysis, EA data reference (`/ea-data`).
- **Stack:** Next.js 16 on Vercel, Postgres on Supabase, GitHub Actions poller posting to `/api/ingest` (EA's bot filter blocks Vercel's servers). The easy path must work inside these constraints or replace them without needing docs.
- **EA API limits:** last 10 games only, three match types (league, playoffs, friendly); live events, Rush and Drop In can't be tracked; a club needs 2+ humans in a game for it to appear.
- **Gentle on EA's API:** no aggressive polling. Keep request volume at today's level or lower.
- **Terminology:** *own* stats vs *EA* numbers ("EA: n incl. CPU"); **+CPU** marks a line that includes the CPU's share; "≈ 6.9 est." marks an estimated rating; Skill Rating; division; promotion match; Season Playoffs.
- **Open decisions:** how the easy path provisions a database and poller without docs; how settings are protected (today: one club password); how Sarma gang-specific config (`config/settings.json`) becomes per-club settings.

## Brand Commitments

- Product name: **FC Clubs Tracker**. Each deploy shows its own club's name, crest and kits from EA; the product name stays secondary to the club's identity.
- **Not affiliated with EA**, stated on every deploy. No EA logos or wording that suggests an official product.
- Voice: plain, short and factual, like the README. The fun comes from the content itself (records, streaks, hall of shame), not from hype.
- Third-party work the product builds on is credited (README Thanks, `docs/ea-data.json`), e.g. the EA FC Pro Clubs API research project.

## Evidence on Hand

- Live Sarma gang deploy with real saved matches, players, records and ratings.
- `docs/ea-api.md` / `docs/ea-data.json`: every EA field mapped, with confidence level.
- `lib/rating-model.ts`: rating estimate within 0.5 of EA's for about 85% of lines.
- No other clubs use it yet. No testimonials, user counts or endorsements exist; don't invent any.

## Product Principles

1. **Simple first.** A non-technical captain never needs docs. Advanced options exist but never clutter the easy path.
2. **Stat honesty.** A player's own numbers stay apart from the CPU's. Estimates are marked and real values replace them. Never inflate a stat to look better.
3. **The club owns the site.** Name, crest, colours and nicknames come from the club. Nothing Sarma gang-specific is hardcoded.
4. **Live during sessions.** The site keeps up with play, and the club page works as the session scoreboard.
5. **Banter and depth together.** Records, streaks and the hall of shame for the group chat; hidden counters, analysis and EA field docs for the people who want to dig.

## Accessibility & Inclusion

Phone-first for teammates, since most of them read it on phones. Shared links must read well when opened cold from a chat by someone outside the club.
