import { CRON_SECRET } from "./config";
import { ea } from "./ea";
import type { EaPayload } from "./poller";

/**
 * EA's bot filter rejects Node's connection from Vercel, so on Vercel the site reaches EA through
 * its own Python functions (api/ea-search.py, api/ea-fetch.py), which connect like Chrome.
 * Running locally (next dev doesn't run them) it calls EA directly.
 */
const onVercel = () => Boolean(process.env.VERCEL_URL);
const self = (path: string) => `https://${process.env.VERCEL_URL}${path}`;
// previews sit behind Vercel's login; with "Protection Bypass for Automation" on, this gets through
const bypass = (): Record<string, string> =>
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};

export type FoundClub = {
  clubId: string;
  clubName: string;
  platform: string;
  wins: number;
  draws: number;
  losses: number;
  games: number;
};

const toClub = (c: Record<string, unknown>): FoundClub => ({
  clubId: String(c.clubId ?? ""),
  clubName: String(c.clubName ?? ""),
  platform: String(c.platform ?? ""),
  wins: Number(c.wins ?? 0),
  draws: Number(c.ties ?? 0),
  losses: Number(c.losses ?? 0),
  games: Number(c.gamesPlayed ?? 0),
  // no division: EA's currentDivision runs behind the lobby (docs/ea-api.md), so it'd mislead here
});

/** Clubs whose name starts with `name` on a platform (EA's search, up to 25). */
export async function searchClubs(name: string, platform: string): Promise<FoundClub[]> {
  if (!onVercel()) return (await ea.search(name, platform)).map(toClub);
  const res = await fetch(self(`/api/ea-search?${new URLSearchParams({ name, platform })}`), { headers: bypass(), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { clubs?: Record<string, unknown>[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `search failed (HTTP ${res.status})`);
  return (body.clubs ?? []).map(toClub);
}

/** The club's full EA data, on Vercel; null when running locally (use pollOnce there). */
export async function fetchPayload(club: string, platform: string): Promise<EaPayload | null> {
  if (!onVercel()) return null;
  const res = await fetch(self(`/api/ea-fetch?${new URLSearchParams({ club, platform })}`), {
    headers: { Authorization: `Bearer ${CRON_SECRET}`, ...bypass() },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as EaPayload & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `EA fetch failed (HTTP ${res.status})`);
  return body;
}
