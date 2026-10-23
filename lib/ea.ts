import fs from "node:fs";
import path from "node:path";
import { clubId, EA_FIXTURE_DIR, platform } from "./config";

const BASE = "https://proclubs.ea.com/api/fc";

// EA sits behind a bot filter. A server pretending to be Chrome can get stalled
// (its TLS fingerprint doesn't match the user agent), so try plain headers first
// and only fall back to browser-like ones.
const HEADER_SETS: Record<string, Record<string, string>> = {
  plain: {
    "User-Agent": "sarmagang-tracker/1.0 (+https://github.com/8ightt/sarmagang-tracker)",
    Accept: "application/json",
  },
  browser: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    Referer: "https://www.ea.com/",
    Origin: "https://www.ea.com",
  },
};

/** Per-request timeout. Keep the whole check well inside Vercel's function limit. */
const TIMEOUT_MS = Number(process.env.EA_TIMEOUT_MS ?? 9000);

/** Remembers which header set EA accepted, so later calls in the same check go straight to it. */
let preferred: keyof typeof HEADER_SETS | null = null;

export type EaMatch = {
  matchId: string;
  timestamp: number;
  clubs: Record<
    string,
    {
      goals: string;
      goalsAgainst: string;
      result?: string;
      winnerByDnf?: string;
      details?: { name?: string; clubId?: number; teamId?: number; customKit?: { crestAssetId?: string; kitColor1?: string; kitColor2?: string; kitColor3?: string; kitColor4?: string } };
    }
  >;
  players: Record<string, Record<string, Record<string, string>>>;
  aggregate?: Record<string, Record<string, number>>;
};

export type EaMember = Record<string, string> & { name: string };

async function get<T>(endpoint: string, params: Record<string, string>, fixture: string): Promise<T> {
  if (EA_FIXTURE_DIR) {
    return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ path.join(EA_FIXTURE_DIR, fixture), "utf8")) as T;
  }
  const url = `${BASE}/${endpoint}?${new URLSearchParams({ platform: platform(), ...params })}`;
  const order = (preferred ? [preferred] : (["plain", "browser"] as const)) as (keyof typeof HEADER_SETS)[];
  const failures: string[] = [];
  for (const name of order) {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        headers: HEADER_SETS[name],
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as T;
      preferred = name;
      return data;
    } catch (err) {
      const e = err as Error;
      const why = e.name === "TimeoutError" || e.name === "AbortError" ? `no answer in ${TIMEOUT_MS / 1000}s` : e.message;
      failures.push(`${name} headers: ${why} (${Date.now() - started} ms)`);
    }
  }
  throw new Error(`EA ${endpoint} failed: ${failures.join("; ")}`);
}

export const eaHeaderMode = () => preferred;

export const ea = {
  clubInfo: () => get<Record<string, Record<string, unknown>>>("clubs/info", { clubIds: clubId() }, "info.json"),
  overallStats: () => get<Record<string, string>[]>("clubs/overallStats", { clubIds: clubId() }, "overall.json"),
  /** another club's totals (EA rejects several ids in one call) */
  clubStats: (clubId: string) => get<Record<string, string>[]>("clubs/overallStats", { clubIds: clubId }, "overall.json"),
  search: (clubName: string, onPlatform?: string) =>
    get<Record<string, string>[]>("allTimeLeaderboard/search", { clubName, ...(onPlatform ? { platform: onPlatform } : {}) }, "search.json"),
  members: () => get<{ members: EaMember[] }>("members/stats", { clubId: clubId() }, "members.json"),
  career: () => get<{ members: EaMember[] }>("members/career/stats", { clubId: clubId() }, "career.json"),
  /** the top 100 clubs on the platform by Skill Rating */
  leaderboard: () => get<Record<string, unknown>[]>("allTimeLeaderboard", {}, "leaderboard.json"),
  matches: (matchType: "leagueMatch" | "playoffMatch" | "friendlyMatch") =>
    get<EaMatch[]>(
      "clubs/matches",
      { clubIds: clubId(), matchType, maxResultCount: "10" },
      `matches-${matchType}.json`,
    ),
};
