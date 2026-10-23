import archetypeStats from "@/config/archetype-stats.json";
import siteSettings from "@/config/settings.json";

/** EA platforms a club can be on (EA rejects common-gen4 for FC 27). */
export const PLATFORMS = { "common-gen5": "PS5, Xbox Series and PC", nx: "Switch" } as const;
export type Platform = keyof typeof PLATFORMS;

/**
 * The club this site follows: picked on /setup (saved in site_settings), else CLUB_ID from the
 * environment. Empty until set up. Read after refreshSettings(), like every setting.
 */
export const clubId = () => loadSettings().club?.id || process.env.CLUB_ID || "";
export const platform = (): string => loadSettings().club?.platform || process.env.PLATFORM || "common-gen5";
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
  /** the promotion match per division: a short series of `matches` games, `wins` of them to go up */
  promotion: Record<string, { matches: number; wins: number; confirmed?: boolean }>;
  /** points the club keeps after missing promotion, per division; missing = one win short of the target */
  pointsAfterMissedPromotion: Record<string, number>;
};

/** An EA Clubs season, copied from the in-game Season Info screen. */
export type ClubSeason = {
  name: string;
  /** first and last day, YYYY-MM-DD */
  start: string;
  end: string;
  /** when the season ends on its last day, ISO time (the lobby shows a countdown); missing = end of that day */
  endsAt?: string;
  /** when the end-of-season Playoffs open, ISO time (the lobby only shows a countdown) */
  playoffsStart?: string;
  /** games in the Season Playoffs (12 in Season 1; the lobby counts down Matches Remaining) */
  playoffsMatches?: number;
};

/** When a season ends (seconds). */
export const seasonEnd = (x: ClubSeason) => Date.parse(x.endsAt ?? `${x.end}T23:59:59Z`) / 1000;

/** Start and end (seconds) of a season's end-of-season Playoffs, if known. */
export function playoffsWindow(x: ClubSeason): { from: number; to: number } | null {
  if (!x.playoffsStart) return null;
  return { from: Date.parse(x.playoffsStart) / 1000, to: seasonEnd(x) };
}

/** The club's own look, overriding what EA sends: colours as #rrggbb, the crest as an image data URL. */
export type LookSettings = { club?: string; accent?: string; crest?: string };

/** The club picked on /setup. */
export type ClubIdentity = { id: string; platform: string; name: string };

export type SiteSettings = {
  club?: ClubIdentity;
  tagline?: string;
  look: LookSettings;
  seasons: ClubSeason[];
  players: Record<string, PlayerSettings>;
  league: LeagueRules;
};

/** What the club saved on /settings (the site_settings table), laid over config/settings.json. */
let saved: Partial<SiteSettings> = {};
let savedAt = 0;
const SETTINGS_TTL_MS = 10_000;

/**
 * Reads the club's saved settings from the database, at most every SETTINGS_TTL_MS (force after a
 * save). The data functions that use settings call it first, so loadSettings() can stay synchronous.
 */
export async function refreshSettings(force = false) {
  if (!force && Date.now() - savedAt < SETTINGS_TTL_MS) return;
  try {
    const { sql } = await import("./db");
    const [row] = await sql()`select data from site_settings where key = 'main'`;
    saved = (row?.data as Partial<SiteSettings> | undefined) ?? {};
  } catch {
    // table not there yet (supabase/migrations/0019): the file alone
    saved = {};
  }
  savedAt = Date.now();
}

/**
 * config/settings.json with the club's saved settings on top. Players merge field by field, so a
 * nickname saved on /settings keeps the position set in the file; seasons and league rules saved
 * on /settings replace the file's.
 */
export function loadSettings(): SiteSettings {
  const file = siteSettings as Partial<SiteSettings>;
  const s = { ...file, ...saved };
  const players: Record<string, PlayerSettings> = { ...(file.players ?? {}) };
  for (const [name, p] of Object.entries(saved.players ?? {})) players[name] = { ...players[name], ...p };
  const league = { ...(file.league ?? {}), ...(saved.league ?? {}) } as Partial<LeagueRules>;
  return {
    club: saved.club,
    tagline: s.tagline,
    look: { ...(file.look ?? {}), ...(saved.look ?? {}) },
    players,
    seasons: s.seasons ?? [],
    league: {
      chances: league.chances ?? 3,
      chancesAfterSurviving: league.chancesAfterSurviving ?? 1,
      targets: league.targets ?? {},
      promotion: league.promotion ?? {},
      pointsAfterMissedPromotion: league.pointsAfterMissedPromotion ?? {},
    },
  };
}

/**
 * The promotion match series for a division (Division 1 is the top numbered one; above it is
 * Elite). Divisions missing from config/settings.json: one more win than the division below.
 */
export function promotionRule(division: number): { matches: number; wins: number; confirmed: boolean } {
  const r = loadSettings().league.promotion[String(division)];
  return r ? { ...r, confirmed: r.confirmed ?? false } : { matches: Math.max(1, 7 - division), wins: Math.max(1, 6 - division), confirmed: false };
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
  return loadSettings().seasons.find((x) => x.start <= day && day <= x.end && ts <= seasonEnd(x)) ?? null;
}

export type MatchKind = "league" | "promotion" | "playoffs" | "friendly";

/**
 * League, promotion match (EA sends those as league games, so the caller passes what the
 * season replay found), playoff (EA's playoff type or during a season's Playoffs) or friendly.
 */
export function matchKind(ts: number, matchType: string, promotion = false): MatchKind {
  if (matchType === "friendlyMatch") return "friendly";
  if (promotion) return "promotion";
  if (matchType === "playoffMatch") return "playoffs";
  const x = seasonOf(ts);
  const win = x ? playoffsWindow(x) : null;
  return win && ts >= win.from && ts <= win.to ? "playoffs" : "league";
}

/** One archetype's season totals from the in-game Archetypes > Statistics screen. */
export type InGameArchetype = {
  matches: number;
  motm: number;
  goals?: number;
  assists?: number;
  passesMade?: number;
  tackles?: number;
  interceptions?: number;
  conversionPct?: number;
  passPct?: number;
  tacklePct?: number;
  avgPasses?: number;
  avgTackles?: number;
  avgShots?: number;
  saves?: number;
  cleanSheets?: number;
  goalsConceded?: number;
  savePct?: number;
  avgSaves?: number;
};

/** A player's in-game archetype screen, copied by hand (config/archetype-stats.json). */
export type InGameArchetypes = { season: string; asOf: string; archetypes: Record<string, InGameArchetype> };

export function inGameArchetypes(player: string): InGameArchetypes | null {
  return (archetypeStats.players as Record<string, InGameArchetypes>)[player] ?? null;
}
