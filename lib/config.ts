import siteSettings from "@/config/settings.json";

export const CLUB_ID = process.env.CLUB_ID ?? "837026";
export const PLATFORM = process.env.PLATFORM ?? "common-gen5";
/** Password the club uses to edit captains, tactics and CPU red cards. */
export const CLUB_PASSWORD = process.env.CLUB_PASSWORD ?? "";
/** Shared secret for the scheduled EA check (Vercel cron / GitHub Actions). */
export const CRON_SECRET = process.env.CRON_SECRET ?? "";
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";
export const SITE_URL = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
/** Read EA responses from JSON files instead of the network (local testing only). */
export const EA_FIXTURE_DIR = process.env.EA_FIXTURE_DIR ?? "";
export const TIMEZONE = process.env.DISPLAY_TIMEZONE ?? "Europe/Berlin";

export type PlayerSettings = {
  /** Position to show on the site, e.g. "CAM". Defaults to the Pro's position from EA. */
  position?: string;
  /** Shown next to the position, e.g. "ANY". */
  role?: string;
  nickname?: string;
  bio?: string;
  /** URL of a picture of the Pro, e.g. /pros/dirty8ightt.png (put files in public/pros). */
  photo?: string;
};

export type LeagueRules = {
  /** safety chances at the start of a season */
  chances: number;
  /** chances you get back after winning a relegation match */
  chancesAfterSurviving: number;
  /** points target per division, e.g. { "4": 9 } */
  targets: Record<string, number>;
  /** the promotion match is a short series: this many games, this many wins to go up */
  promotionMatches: number;
  promotionWins: number;
};

/** An EA Clubs season, copied from the in-game Season Info screen. */
export type ClubSeason = {
  name: string;
  /** first and last day, YYYY-MM-DD */
  start: string;
  end: string;
  /** when the end-of-season Playoffs open, ISO time (the lobby only shows a countdown) */
  playoffsStart?: string;
  /** games in the Season Playoffs (about 15, played until the season ends) */
  playoffsMatches?: number;
};

/** Start and end (seconds) of a season's end-of-season Playoffs, if known. */
export function playoffsWindow(x: ClubSeason): { from: number; to: number } | null {
  if (!x.playoffsStart) return null;
  return { from: Date.parse(x.playoffsStart) / 1000, to: Date.parse(`${x.end}T23:59:59Z`) / 1000 };
}

export type SiteSettings = {
  tagline?: string;
  seasons: ClubSeason[];
  players: Record<string, PlayerSettings>;
  league: LeagueRules;
};

/** Edit config/settings.json and push: the site redeploys with the change. */
export function loadSettings(): SiteSettings {
  const s = siteSettings as Partial<SiteSettings>;
  const league = (s.league ?? {}) as Partial<LeagueRules>;
  return {
    tagline: s.tagline,
    players: s.players ?? {},
    seasons: s.seasons ?? [],
    league: {
      chances: league.chances ?? 3,
      chancesAfterSurviving: league.chancesAfterSurviving ?? 1,
      targets: league.targets ?? {},
      promotionMatches: league.promotionMatches ?? 3,
      promotionWins: league.promotionWins ?? 2,
    },
  };
}

/** The season running at `now` (seconds), else the latest one that has started. */
export function currentSeason(now = Date.now() / 1000): ClubSeason | null {
  const started = loadSettings()
    .seasons.filter((x) => Date.parse(x.start) / 1000 <= now)
    .sort((a, b) => a.start.localeCompare(b.start));
  return started[started.length - 1] ?? null;
}

/** A time (seconds) as YYYY-MM-DD in the site's time zone. */
export const localDay = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-CA", { timeZone: TIMEZONE });

/** The season a game belongs to, by its date. */
export function seasonOf(ts: number): ClubSeason | null {
  const day = localDay(ts);
  return loadSettings().seasons.find((x) => x.start <= day && day <= x.end) ?? null;
}

export type MatchKind = "league" | "playoffs" | "friendly";

/** League, playoff (EA's playoff type or during a season's Playoffs) or friendly. */
export function matchKind(ts: number, matchType: string): MatchKind {
  if (matchType === "friendlyMatch") return "friendly";
  if (matchType === "playoffMatch") return "playoffs";
  const x = seasonOf(ts);
  const win = x ? playoffsWindow(x) : null;
  return win && ts >= win.from && ts <= win.to ? "playoffs" : "league";
}
