import type postgres from "postgres";
import { CLUB_ID, DISCORD_WEBHOOK_URL, SITE_URL } from "./config";
import { getSnapshot, setSnapshot, sql } from "./db";
import { ea, eaHeaderMode, type EaMatch } from "./ea";

const MATCH_TYPES = ["leagueMatch", "playoffMatch", "friendlyMatch"] as const;
const n = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Number(v));

/**
 * A player "controls the CPU" when his passing volume dwarfs everyone else's:
 * that happens when he plays ANY, or is one of only two humans online.
 */
export function cpuController(players: Record<string, string>[]): string | null {
  const byPasses = players
    .map((p) => ({ name: p.playername, att: n(p.passattempts), secs: n(p.secondsPlayed) }))
    .filter((p) => p.secs > 0)
    .sort((a, b) => b.att - a.att);
  if (!byPasses.length) return null;
  const top = byPasses[0];
  const second = byPasses[1]?.att ?? 0;
  // scale the threshold for short games (opponent quit early etc.)
  const minAttempts = Math.max(12, 45 * Math.min(1, top.secs / 60 / 90));
  return top.att >= minAttempts && top.att >= 2.2 * Math.max(second, 1) ? top.name : null;
}

/**
 * EA's hidden per-player event counters ("id:count" pairs in match_event_aggregate_0..3).
 * Unlike the headline stats they count only the human's own actions; see docs/ea-data.json.
 * Returns null when the line has no counters.
 */
export function eventCounters(p: Record<string, string>): Map<number, number> | null {
  const parts = [0, 1, 2, 3].flatMap((i) => (p[`match_event_aggregate_${i}`] ?? "").split(",")).filter((x) => x.includes(":"));
  if (!parts.length) return null;
  const counts = new Map<number, number>();
  for (const part of parts) {
    const [id, count] = part.split(":").map(Number);
    if (Number.isFinite(id) && Number.isFinite(count)) counts.set(id, (counts.get(id) ?? 0) + count);
  }
  return counts;
}

const OWN_GOALS = 214;
const OWN_ASSISTS = 11;
const OWN_SHOTS = [217, 218];

/** The player's own goals, assists and shots (without the CPU's), or null without counters. */
export function ownStats(p: Record<string, string>) {
  const c = eventCounters(p);
  if (!c) return null;
  const get = (id: number) => c.get(id) ?? 0;
  return { goals: get(OWN_GOALS), assists: get(OWN_ASSISTS), shots: OWN_SHOTS.reduce((s, id) => s + get(id), 0) };
}

/** The kit colours EA sends with a match: body, trim, sleeve, extra. */
function kitColors(club?: EaMatch["clubs"][string]): number[] | null {
  const kit = club?.details?.customKit;
  return kit ? [kit.kitColor1, kit.kitColor2, kit.kitColor3, kit.kitColor4].map(n) : null;
}

/** Saves one match; returns true if it wasn't in the database yet. */
async function saveMatch(m: EaMatch, matchType: string): Promise<boolean> {
  const us = m.clubs[CLUB_ID];
  if (!us) return false;
  const oppId = Object.keys(m.clubs).find((k) => k !== CLUB_ID) ?? "";
  const opp = m.clubs[oppId];
  const gf = n(us.goals);
  const ga = n(us.goalsAgainst);
  const ours = Object.values(m.players?.[CLUB_ID] ?? {});
  const controller = cpuController(ours);
  const db = sql();

  const row = {
    id: m.matchId,
    ts: n(m.timestamp),
    match_type: matchType,
    opp_id: oppId,
    opp_name: opp?.details?.name ?? "Unknown club",
    opp_crest: opp?.details?.customKit?.crestAssetId ?? null,
    goals_for: gf,
    goals_against: ga,
    result: gf > ga ? "W" : gf < ga ? "L" : "D",
    dnf: n(us.winnerByDnf) === 1,
    minutes: Math.round(Math.max(0, ...ours.map((p) => n(p.secondsPlayed))) / 60),
    team: db.json({ us: m.aggregate?.[CLUB_ID] ?? null, them: m.aggregate?.[oppId] ?? null } as postgres.JSONValue),
    our_kit: kitColors(us),
    opp_kit: kitColors(opp),
    raw: db.json(m as unknown as postgres.JSONValue),
  };
  const players = ours.map((p) => {
    const own = ownStats(p);
    return {
      match_id: m.matchId,
      player: p.playername,
      pos: p.pos ?? null,
      archetype: n(p.archetypeid),
      rating: n(p.rating),
      goals: n(p.goals),
      assists: n(p.assists),
      shots: n(p.shots),
      passes_made: n(p.passesmade),
      pass_attempts: n(p.passattempts),
      tackles_made: n(p.tacklesmade),
      tackle_attempts: n(p.tackleattempts),
      saves: n(p.saves),
      reds: n(p.redcards),
      motm: n(p.mom) === 1,
      seconds: n(p.secondsPlayed),
      controls_cpu: p.playername === controller,
      goals_conceded: n(p.goalsconceded),
      clean_sheet: n(p.cleansheetsany) > 0,
      idle_seconds: n(p.realtimeidle),
      real_seconds: n(p.realtimegame),
      reflex_saves: n(p.reflexSaves),
      parry_saves: n(p.parrySaves),
      punch_saves: n(p.punchSaves),
      dive_saves: n(p.ballDiveSaves),
      cross_saves: n(p.crossSaves),
      direction_saves: n(p.goodDirectionSaves),
      own_goals: own?.goals ?? null,
      own_assists: own?.assists ?? null,
      own_shots: own?.shots ?? null,
    };
  });

  return db.begin(async (tx) => {
    const [res] = await tx`
      insert into matches ${tx(row)}
      on conflict (id) do update set raw = excluded.raw, team = excluded.team, minutes = excluded.minutes,
        our_kit = excluded.our_kit, opp_kit = excluded.opp_kit
      returning (xmax = 0) as inserted`;
    if (players.length) {
      await tx`
        insert into match_players ${tx(players)}
        on conflict (match_id, player) do update set
          pos = excluded.pos, archetype = excluded.archetype, rating = excluded.rating, goals = excluded.goals,
          assists = excluded.assists, shots = excluded.shots, passes_made = excluded.passes_made,
          pass_attempts = excluded.pass_attempts, tackles_made = excluded.tackles_made,
          tackle_attempts = excluded.tackle_attempts, saves = excluded.saves, reds = excluded.reds,
          motm = excluded.motm, seconds = excluded.seconds, controls_cpu = excluded.controls_cpu,
          goals_conceded = excluded.goals_conceded, clean_sheet = excluded.clean_sheet,
          idle_seconds = excluded.idle_seconds, real_seconds = excluded.real_seconds,
          reflex_saves = excluded.reflex_saves, parry_saves = excluded.parry_saves, punch_saves = excluded.punch_saves,
          dive_saves = excluded.dive_saves, cross_saves = excluded.cross_saves, direction_saves = excluded.direction_saves,
          own_goals = excluded.own_goals, own_assists = excluded.own_assists, own_shots = excluded.own_shots`;
    }
    return Boolean(res?.inserted);
  });
}

async function announce(m: EaMatch) {
  if (!DISCORD_WEBHOOK_URL) return;
  const us = m.clubs[CLUB_ID];
  const oppId = Object.keys(m.clubs).find((k) => k !== CLUB_ID) ?? "";
  const opp = m.clubs[oppId];
  const gf = n(us.goals);
  const ga = n(us.goalsAgainst);
  const verdict = gf > ga ? "WIN" : gf < ga ? "LOSS" : "DRAW";
  const players = Object.values(m.players?.[CLUB_ID] ?? {});
  const goalsOf = (p: Record<string, string>) => ownStats(p)?.goals ?? n(p.goals);
  const cpuGoals = gf - players.reduce((s, p) => s + goalsOf(p), 0);
  const scorers = [
    ...players.filter((p) => goalsOf(p) > 0).map((p) => (goalsOf(p) > 1 ? `${p.playername} ×${goalsOf(p)}` : p.playername)),
    ...(cpuGoals > 0 ? [cpuGoals > 1 ? `CPU ×${cpuGoals}` : "CPU"] : []),
  ].join(", ");
  const motm = players.find((p) => n(p.mom) === 1)?.playername;
  const lines = [
    `**${verdict} ${gf}–${ga}** vs ${opp?.details?.name ?? "?"}`,
    scorers ? `⚽ ${scorers}` : "",
    motm ? `⭐ MOTM: ${motm}` : "",
    SITE_URL ? `${SITE_URL.replace(/\/$/, "")}/matches/${m.matchId}` : "",
  ].filter(Boolean);
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Sarma gang stats", content: lines.join("\n") }),
    });
  } catch (err) {
    console.warn("[poll] Discord post failed", err);
  }
}

export type MatchType = (typeof MATCH_TYPES)[number];

/** Everything one check collected from EA. Parts that couldn't be fetched are simply missing. */
export type EaPayload = {
  source: string;
  matches?: Partial<Record<MatchType, EaMatch[]>>;
  info?: unknown;
  overall?: unknown;
  members?: unknown;
  career?: unknown;
  search?: unknown;
  /** Problems the fetcher ran into, kept in the poll log. */
  errors?: string[];
};

export type PollResult = { ok: boolean; newMatches: number; message: string };

/** Saves a batch of EA data: new matches into the history, totals into snapshots. */
export async function ingest(payload: EaPayload): Promise<PollResult> {
  const db = sql();
  const errors = [...(payload.errors ?? [])].map(String).slice(0, 20);
  let newMatches = 0;
  const [{ count: existing }] = await db`select count(*)::int as count from matches`;
  const firstRun = existing === 0;

  for (const type of MATCH_TYPES) {
    const list = payload.matches?.[type];
    if (!Array.isArray(list)) continue;
    // oldest first so Discord posts arrive in order
    for (const m of [...list].sort((a, b) => n(a.timestamp) - n(b.timestamp))) {
      if (!m?.matchId || !m.clubs) continue;
      if (await saveMatch(m, type)) {
        newMatches++;
        // don't spam Discord with old games on the very first run
        if (!firstRun && Date.now() / 1000 - n(m.timestamp) < 6 * 3600) await announce(m);
      }
    }
  }
  if (!Array.isArray(payload.matches?.leagueMatch)) errors.push("no league matches in this check");

  for (const key of ["info", "overall", "members", "career", "search"] as const) {
    const value = payload[key];
    if (value !== undefined && value !== null) await setSnapshot(key, value);
  }

  const ok = errors.length === 0;
  const message = `${ok ? "ok" : errors.join("; ")} [${String(payload.source).slice(0, 40)}]`;
  await db`insert into poll_log (ok, new_matches, message) values (${ok}, ${newMatches}, ${message})`;
  await db`delete from poll_log where id not in (select id from poll_log order by id desc limit 500)`;
  console.log(`[poll] ${ok ? "ok" : "partial"} · ${newMatches} new match(es) · ${message}`);
  return { ok, newMatches, message };
}

/**
 * Fetches from EA directly. EA's bot filter blocks Vercel's servers, so in production
 * the GitHub Actions workflow fetches instead and posts the data to /api/ingest.
 */
export async function pollOnce(): Promise<PollResult> {
  const payload: EaPayload = { source: "server", matches: {}, errors: [] };
  try {
    payload.matches!.leagueMatch = await ea.matches("leagueMatch");
  } catch (err) {
    payload.errors!.push((err as Error).message);
    return ingest(payload);
  }
  const grab = async <K extends "info" | "overall" | "members" | "career" | "search">(key: K, fn: () => Promise<unknown>) => {
    try {
      payload[key] = await fn();
    } catch (err) {
      payload.errors!.push(`${key}: ${(err as Error).message}`);
    }
  };
  const previous = (await getSnapshot<Record<string, { name?: string }>>("info"))?.data;
  const clubName = previous?.[CLUB_ID]?.name ?? "Sarma gang";
  await Promise.all([
    ...MATCH_TYPES.filter((t) => t !== "leagueMatch").map((t) =>
      ea.matches(t).then((list) => { payload.matches![t] = list; }).catch(() => {
        /* most clubs have no friendlies or playoffs: ignore */
      }),
    ),
    grab("info", ea.clubInfo),
    grab("overall", ea.overallStats),
    grab("members", ea.members),
    grab("career", ea.career),
    grab("search", () => ea.search(clubName)),
  ]);
  const mode = eaHeaderMode();
  if (mode) payload.source = `server, ${mode} headers`;
  return ingest(payload);
}
