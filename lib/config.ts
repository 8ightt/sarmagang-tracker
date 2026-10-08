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

export type SiteSettings = {
  tagline?: string;
  players: Record<string, PlayerSettings>;
};

/** Edit config/settings.json and push: the site redeploys with the change. */
export function loadSettings(): SiteSettings {
  const s = siteSettings as Partial<SiteSettings>;
  return { tagline: s.tagline, players: s.players ?? {} };
}
