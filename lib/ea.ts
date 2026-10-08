import fs from "node:fs";
import path from "node:path";
import { CLUB_ID, EA_FIXTURE_DIR, PLATFORM } from "./config";

const BASE = "https://proclubs.ea.com/api/fc";

// EA's API sits behind a bot filter that rejects requests that don't look like a browser.
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://www.ea.com/",
  Origin: "https://www.ea.com",
};

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
      details?: { name?: string; clubId?: number; teamId?: number; customKit?: { crestAssetId?: string } };
    }
  >;
  players: Record<string, Record<string, Record<string, string>>>;
  aggregate?: Record<string, Record<string, number>>;
};

export type EaMember = Record<string, string> & { name: string };

async function get<T>(endpoint: string, params: Record<string, string>, fixture: string): Promise<T> {
  if (EA_FIXTURE_DIR) {
    return JSON.parse(fs.readFileSync(path.join(EA_FIXTURE_DIR, fixture), "utf8")) as T;
  }
  const qs = new URLSearchParams({ platform: PLATFORM, ...params }).toString();
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/${endpoint}?${qs}`, {
        headers: HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`EA ${endpoint} answered ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  throw lastError;
}

export const ea = {
  clubInfo: () => get<Record<string, Record<string, unknown>>>("clubs/info", { clubIds: CLUB_ID }, "info.json"),
  overallStats: () => get<Record<string, string>[]>("clubs/overallStats", { clubIds: CLUB_ID }, "overall.json"),
  search: (clubName: string) =>
    get<Record<string, string>[]>("allTimeLeaderboard/search", { clubName }, "search.json"),
  members: () => get<{ members: EaMember[] }>("members/stats", { clubId: CLUB_ID }, "members.json"),
  career: () => get<{ members: EaMember[] }>("members/career/stats", { clubId: CLUB_ID }, "career.json"),
  matches: (matchType: "leagueMatch" | "playoffMatch" | "friendlyMatch") =>
    get<EaMatch[]>(
      "clubs/matches",
      { clubIds: CLUB_ID, matchType, maxResultCount: "10" },
      `matches-${matchType}.json`,
    ),
};
