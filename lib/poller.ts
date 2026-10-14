import type postgres from "postgres";
import { CLUB_ID, DISCORD_WEBHOOK_URL, SITE_URL } from "./config";
import { getSnapshot, setSnapshot, sql } from "./db";
import { ea, eaHeaderMode, type EaMatch } from "./ea";

const MATCH_TYPES = ["leagueMatch", "playoffMatch", "friendlyMatch"] as const;
const n = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Number(v));

/**
 * A player "controls the CPU" when their passing volume dwarfs everyone else's:
 * that happens when he plays ANY, or is one of only two humans online.
 */
export function cpuController(players: Record<string, string>[]): string | null {
  const live = players.filter((p) => n(p.secondsPlayed) > 0);
  if (!live.length) return null;
  // certain: EA's headline goals/assists/shots exceed the player's own counters only on the CPU controller's line
  const extra = live
    .map((p) => {
      const own = ownStats(p);
      return { name: p.playername, extra: own ? n(p.goals) - own.goals + (n(p.assists) - own.assists) + (n(p.shots) - own.shots) : 0 };
    })
    .sort((a, b) => b.extra - a.extra);
  if (extra[0].extra > 0) return extra[0].name;
  // nearly as certain: the CPU always passes, so EA's passes run well above the controller's own
  const passGap = live
    .map((p) => {
      const own = ownStats(p);
      return { name: p.playername, gap: own ? n(p.passesmade) - own.passesMade : 0 };
    })
    .sort((a, b) => b.gap - a.gap);
  if (passGap[0].gap >= 5) return passGap[0].name;
  // otherwise a guess: the controller also makes the CPU's passes AND tackles, so both are far above a human's
  const byPasses = live
    .map((p) => ({ name: p.playername, att: n(p.passattempts), tackles: n(p.tackleattempts), mins: Math.max(1, n(p.secondsPlayed) / 60) }))
    .sort((a, b) => b.att - a.att);
  const top = byPasses[0];
  const second = byPasses[1]?.att ?? 0;
  return top.att >= 12 && top.att / top.mins >= 0.6 && top.tackles / top.mins >= 0.15 && top.att >= 2.2 * Math.max(second, 1) ? top.name : null;
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
// completed passes; offside passes (153) count as made for EA but not on the in-game screen
const OWN_PASSES_MADE = [215];
const OWN_PASSES_MISSED = [153, 216];
const OWN_TACKLES_MADE = 164;
const OWN_STRAIGHT_RED = 96;
const OWN_YELLOWS = [95, 213];

/**
 * Whether the counters show the player's own red card: a straight red (96) or a second yellow.
 * On 42,451 human-only lines of the research dataset every EA red has one of these, so an EA red
 * without them is the CPU's. Not the other way round: two yellows without a red happen too.
 */
function ownRedPossible(p: Record<string, string>): boolean | null {
  const c = eventCounters(p);
  if (!c) return null;
  return (c.get(OWN_STRAIGHT_RED) ?? 0) > 0 || OWN_YELLOWS.reduce((s, id) => s + (c.get(id) ?? 0), 0) >= 2;
}

/** The player's own goals, assists, shots, passes and tackles (without the CPU's), or null without counters. */
export function ownStats(p: Record<string, string>) {
  const c = eventCounters(p);
  if (!c) return null;
  const get = (id: number) => c.get(id) ?? 0;
  const sum = (ids: number[]) => ids.reduce((s, id) => s + get(id), 0);
  const passesMade = sum(OWN_PASSES_MADE);
  return {
    goals: get(OWN_GOALS),
    assists: get(OWN_ASSISTS),
    shots: sum(OWN_SHOTS),
    passesMade,
    passAttempts: passesMade + sum(OWN_PASSES_MISSED),
    tacklesMade: get(OWN_TACKLES_MADE),
  };
}

/** The kit colours EA sends with a match: body, trim, sleeve, extra. */
function kitColors(club?: EaMatch["clubs"][string]): number[] | null {
  const kit = club?.details?.customKit;
  return kit ? [kit.kitColor1, kit.kitColor2, kit.kitColor3, kit.kitColor4].map(n) : null;
}

const CPU_RED_NOTE = "CPU card: no straight red (96) or second yellow (95 + 213) in the player's own counters";

/** Only games this recent get today's Skill Ratings; older ones would get misleading values. */
const SR_WINDOW_SECONDS = 3 * 3600;

/** Saves one match; returns true if it wasn't in the database yet. */
async function saveMatch(m: EaMatch, matchType: string, ourSr: number | null): Promise<boolean> {
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
    our_sr: Date.now() / 1000 - n(m.timestamp) < SR_WINDOW_SECONDS ? ourSr : null,
    raw: db.json(m as unknown as postgres.JSONValue),
  };
  const players = ours.map((p) => {
    const own = ownStats(p);
    const counters = eventCounters(p);
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
      // EA wipes a quitter's line (userResult 6) to 0; the game ends there, so they conceded the team's goals
      quit: n(p.userResult) === 6,
      goals_conceded: n(p.userResult) === 6 ? ga : n(p.goalsconceded),
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
      own_passes_made: own?.passesMade ?? null,
      own_pass_attempts: own?.passAttempts ?? null,
      own_tackles_made: own?.tacklesMade ?? null,
      counters: counters ? db.json(Object.fromEntries(counters) as postgres.JSONValue) : null,
    };
  });

  return db.begin(async (tx) => {
    const [res] = await tx`
      insert into matches ${tx(row)}
      on conflict (id) do update set raw = excluded.raw, team = excluded.team, minutes = excluded.minutes,
        our_kit = excluded.our_kit, opp_kit = excluded.opp_kit, our_sr = coalesce(matches.our_sr, excluded.our_sr)
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
          quit = excluded.quit, goals_conceded = excluded.goals_conceded, clean_sheet = excluded.clean_sheet,
          idle_seconds = excluded.idle_seconds, real_seconds = excluded.real_seconds,
          reflex_saves = excluded.reflex_saves, parry_saves = excluded.parry_saves, punch_saves = excluded.punch_saves,
          dive_saves = excluded.dive_saves, cross_saves = excluded.cross_saves, direction_saves = excluded.direction_saves,
          own_goals = excluded.own_goals, own_assists = excluded.own_assists, own_shots = excluded.own_shots,
          own_passes_made = excluded.own_passes_made, own_pass_attempts = excluded.own_pass_attempts,
          own_tackles_made = excluded.own_tackles_made, counters = excluded.counters`;
    }
    // Only on the first save, so a red the club gave back to the player stays theirs
    const cpuReds = ours.filter((p) => n(p.redcards) > 0 && ownRedPossible(p) === false);
    if (res?.inserted && cpuReds.length) {
      await tx`
        insert into corrections ${tx(
          cpuReds.map((p) => ({
            match_id: m.matchId,
            player: p.playername,
            stat: "reds",
            amount: n(p.redcards),
            note: CPU_RED_NOTE,
            created_by: "auto",
          })),
        )}`;
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

/** The fields of an allTimeLeaderboard entry the site uses. */
function topClub(c: Record<string, unknown>) {
  const kit = ((c.clubInfo as Record<string, unknown> | undefined)?.customKit ?? {}) as Record<string, unknown>;
  return {
    rank: n(c.rank),
    clubId: String(c.clubId ?? ""),
    name: String(c.clubName ?? ""),
    crest: kit.crestAssetId ? String(kit.crestAssetId) : null,
    skillRating: n(c.skillRating),
    division: n(c.currentDivision),
    reputationTier: n(c.reputationtier),
    reputationLevel: n(c.reputationlevel),
    games: n(c.gamesPlayed),
    wins: n(c.wins),
    ties: n(c.ties),
    losses: n(c.losses),
    goals: n(c.goals),
    goalsAgainst: n(c.goalsAgainst),
  };
}
export type TopClub = ReturnType<typeof topClub>;

/** Everything one check collected from EA. Parts that couldn't be fetched are simply missing. */
export type EaPayload = {
  source: string;
  matches?: Partial<Record<MatchType, EaMatch[]>>;
  info?: unknown;
  overall?: unknown;
  members?: unknown;
  career?: unknown;
  search?: unknown;
  /** allTimeLeaderboard: the top 100 clubs by Skill Rating */
  leaderboard?: unknown;
  /** Skill Rating of recent opponents, by club id */
  opponents?: Record<string, { skillRating?: string | number | null }>;
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
  const overall = Array.isArray(payload.overall) ? (payload.overall[0] as Record<string, string> | undefined) : undefined;
  const ourSr = overall?.skillRating ? n(overall.skillRating) : null;

  for (const type of MATCH_TYPES) {
    const list = payload.matches?.[type];
    if (!Array.isArray(list)) continue;
    // oldest first so Discord posts arrive in order
    for (const m of [...list].sort((a, b) => n(a.timestamp) - n(b.timestamp))) {
      if (!m?.matchId || !m.clubs) continue;
      if (await saveMatch(m, type, ourSr)) {
        newMatches++;
        // don't spam Discord with old games on the very first run
        if (!firstRun && Date.now() / 1000 - n(m.timestamp) < 6 * 3600) await announce(m);
      }
    }
  }
  if (!Array.isArray(payload.matches?.leagueMatch)) errors.push("no league matches in this check");

  for (const [club, o] of Object.entries(payload.opponents ?? {})) {
    if (o?.skillRating) await db`update matches set opp_sr = ${n(o.skillRating)} where opp_id = ${club} and opp_sr is null`;
  }

  for (const key of ["info", "overall", "members", "career", "search"] as const) {
    const value = payload[key];
    if (value !== undefined && value !== null) await setSnapshot(key, value);
  }
  // every page loads all snapshots, so keep only what the site shows of the top 100 (~105 kB raw)
  if (Array.isArray(payload.leaderboard) && payload.leaderboard.length) {
    await setSnapshot("leaderboard", payload.leaderboard.map((c) => topClub(c as Record<string, unknown>)));
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
  const recent = Date.now() / 1000 - SR_WINDOW_SECONDS;
  const opponentIds = [
    ...new Set(
      (payload.matches!.leagueMatch ?? [])
        .filter((m) => n(m.timestamp) > recent)
        .flatMap((m) => Object.keys(m.clubs ?? {}))
        .filter((club) => club !== CLUB_ID),
    ),
  ];
  payload.opponents = {};
  await Promise.all([
    ...opponentIds.map((club) =>
      ea.clubStats(club).then((d) => { payload.opponents![club] = { skillRating: d?.[0]?.skillRating }; }).catch(() => {
        /* opponent strength is optional */
      }),
    ),
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
    ea.leaderboard().then((d) => { payload.leaderboard = d; }).catch(() => {
      /* the top 100 changes slowly: try again next check */
    }),
  ]);
  const mode = eaHeaderMode();
  if (mode) payload.source = `server, ${mode} headers`;
  return ingest(payload);
}
