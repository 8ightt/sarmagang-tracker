import type postgres from "postgres";
import { cache } from "react";
import { CLUB_ID, loadSettings } from "./config";
import { getSnapshot, sql } from "./db";
import type { EaMember } from "./ea";
import { positionName } from "./ea-assets";

/**
 * Player lines with the club's stat fixes applied. Falls back to EA's raw lines
 * until supabase/migrations/0004 has been run.
 */
const playersTable = cache(async (): Promise<string> => {
  const [r] = await sql()`select to_regclass('public.match_players_effective') is not null as ok`;
  return r?.ok ? "match_players_effective" : "match_players";
});

const num = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Number(v));

export type MatchRow = {
  id: string;
  ts: number;
  match_type: string;
  opp_id: string;
  opp_name: string;
  opp_crest: string | null;
  goals_for: number;
  goals_against: number;
  result: "W" | "D" | "L";
  dnf: boolean;
  minutes: number;
  team: { us: Record<string, number> | null; them: Record<string, number> | null } | null;
  captain?: string | null;
};

export type MatchPlayer = {
  match_id: string;
  player: string;
  /** exact position from a stat fix (e.g. "ST"), if the club entered one */
  position: string | null;
  /** EA's broad group: forward / midfielder / defender / goalkeeper */
  pos: string;
  archetype: number;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  passes_made: number;
  pass_attempts: number | null;
  tackles_made: number;
  tackle_attempts: number | null;
  saves: number;
  reds: number;
  motm: boolean;
  seconds: number;
  controls_cpu: boolean;
  /** true when the club corrected this line from the in-game screen */
  fixed: boolean;
};

export type Club = {
  name: string;
  crestAssetId?: string;
  stadium?: string;
  kits: { name: string; colors: number[] }[];
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  points: number | null;
  division: number | null;
  bestDivision: number | null;
  promotions: number;
  relegations: number;
  skillRating: number | null;
  reputationTier: number;
  winStreak: number;
  unbeatenStreak: number;
  /** oldest → newest */
  form: ("W" | "D" | "L")[];
  updatedAt: number | null;
};

export const getClub = cache(async (): Promise<Club> => {
  const [info, overallSnap, searchSnap] = await Promise.all([
    getSnapshot<Record<string, Record<string, any>>>("info"),
    getSnapshot<Record<string, string>[]>("overall"),
    getSnapshot<Record<string, string>[]>("search"),
  ]);
  const overall = overallSnap?.data?.[0];
  const search = searchSnap?.data?.find((c) => String(c.clubId) === CLUB_ID);
  const c = info?.data?.[CLUB_ID] ?? {};
  const kit = c.customKit ?? {};
  const code: Record<string, "W" | "L" | "D"> = { "1": "W", "2": "L", "3": "D" };
  const form = Array.from({ length: 10 }, (_, i) => code[overall?.[`lastMatch${i}`] ?? ""])
    .filter(Boolean)
    .slice(0, 5)
    .reverse();
  const nn = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  return {
    name: c.name ?? "Sarma gang",
    crestAssetId: kit.crestAssetId,
    stadium: kit.stadName?.trim(),
    kits: [
      { name: "Home", colors: [kit.kitColor1, kit.kitColor2, kit.kitColor3, kit.kitColor4].map(num) },
      { name: "Away", colors: [kit.kitAColor1, kit.kitAColor2, kit.kitAColor3, kit.kitAColor4].map(num) },
      { name: "Third", colors: [kit.kitThrdColor1, kit.kitThrdColor2, kit.kitThrdColor3, kit.kitThrdColor4].map(num) },
    ],
    played: num(overall?.gamesPlayed ?? search?.gamesPlayed),
    wins: num(overall?.wins ?? search?.wins),
    draws: num(overall?.ties ?? search?.ties),
    losses: num(overall?.losses ?? search?.losses),
    goalsFor: num(overall?.goals ?? search?.goals),
    goalsAgainst: num(overall?.goalsAgainst ?? search?.goalsAgainst),
    cleanSheets: num(search?.cleanSheets),
    points: nn(search?.points),
    division: nn(search?.currentDivision),
    bestDivision: nn(search?.bestDivision ?? overall?.bestDivision),
    promotions: num(overall?.promotions ?? search?.promotions),
    relegations: num(overall?.relegations ?? search?.relegations),
    skillRating: nn(overall?.skillRating),
    reputationTier: num(overall?.reputationtier ?? search?.reputationtier),
    winStreak: num(overall?.wstreak),
    unbeatenStreak: num(overall?.unbeatenstreak),
    form,
    updatedAt: info?.updatedAt ?? null,
  };
});

export type Member = {
  gamertag: string;
  proName: string;
  overall: number;
  height: number;
  nation: string;
  eaPosition: string;
  position: string;
  role: string;
  nickname?: string;
  bio?: string;
  photo?: string;
  games: number;
  winRate: number;
  goals: number;
  assists: number;
  rating: number;
  motm: number;
  redsEa: number;
  redsCpu: number;
  reds: number;
  passes: number;
  passPct: number;
  tackles: number;
  tacklePct: number;
  shotPct: number;
  lastTenGoals: number[]; // oldest → newest
  controlsCpu: boolean;
};

export const getMembers = cache(async (): Promise<Member[]> => {
  const db = sql();
  const fixesReady = (await playersTable()) === "match_players_effective";
  const [snap, cpuRows, cpuPlayerRows, fixRows] = await Promise.all([
    getSnapshot<{ members: EaMember[] }>("members"),
    db`select player, sum(amount)::int as n from corrections where stat = 'reds' group by player`,
    db`select distinct player from match_players where controls_cpu`,
    // how far the corrected lines differ from EA's, per player
    fixesReady
      ? db`select player,
             sum(goals - ea_goals)::int as goals,
             sum(assists - ea_assists)::int as assists,
             sum(motm::int - ea_motm::int)::int as motm
          from match_players_effective where fixed or motm <> ea_motm group by player`
      : Promise.resolve([] as postgres.Row[]),
  ]);
  const members = snap?.data?.members ?? [];
  const settings = loadSettings();
  const cpuReds = new Map(cpuRows.map((r) => [r.player as string, r.n as number]));
  const cpuPlayers = new Set(cpuPlayerRows.map((r) => r.player as string));
  const fixDelta = new Map(fixRows.map((r) => [r.player as string, r as unknown as { goals: number; assists: number; motm: number }]));
  return members
    .map((m) => {
      const s = settings.players[m.name] ?? {};
      const eaPos = positionName(m.proPos);
      const redsEa = num(m.redCards);
      const redsCpu = cpuReds.get(m.name) ?? 0;
      const fix = fixDelta.get(m.name) ?? { goals: 0, assists: 0, motm: 0 };
      return {
        gamertag: m.name,
        proName: m.proName || "—",
        overall: num(m.proOverall),
        height: num(m.proHeight),
        nation: m.proNationality ?? "",
        eaPosition: eaPos,
        position: s.position ?? eaPos ?? "",
        role: s.role ?? "",
        nickname: s.nickname,
        bio: s.bio,
        photo: s.photo,
        games: num(m.gamesPlayed),
        winRate: num(m.winRate),
        // EA's season totals, corrected wherever the club fixed a match line
        goals: Math.max(0, num(m.goals) + fix.goals),
        assists: Math.max(0, num(m.assists) + fix.assists),
        rating: num(m.ratingAve),
        motm: Math.max(0, num(m.manOfTheMatch) + fix.motm),
        redsEa,
        redsCpu,
        reds: Math.max(0, redsEa - redsCpu),
        passes: num(m.passesMade),
        passPct: num(m.passSuccessRate),
        tackles: num(m.tacklesMade),
        tacklePct: num(m.tackleSuccessRate),
        shotPct: num(m.shotSuccessRate),
        lastTenGoals: Array.from({ length: 10 }, (_, i) => num(m[`prevGoals${i + 1}`])).reverse(),
        controlsCpu: cpuPlayers.has(m.name) || /any/i.test(s.role ?? ""),
      } satisfies Member;
    })
    .sort((a, b) => b.games - a.games);
});

export async function getMatches(limit = 50): Promise<MatchRow[]> {
  return (await sql()`
    select m.id, m.ts, m.match_type, m.opp_id, m.opp_name, m.opp_crest, m.goals_for, m.goals_against,
           m.result, m.dnf, m.minutes, m.team, n.captain
    from matches m left join match_notes n on n.match_id = m.id
    order by m.ts desc limit ${limit}`) as unknown as MatchRow[];
}

export async function getMatch(id: string) {
  const db = sql();
  const [match] = (await db`
    select m.id, m.ts, m.match_type, m.opp_id, m.opp_name, m.opp_crest, m.goals_for, m.goals_against,
           m.result, m.dnf, m.minutes, m.team, n.captain
    from matches m left join match_notes n on n.match_id = m.id where m.id = ${id}`) as unknown as MatchRow[];
  if (!match) return null;
  const t = await playersTable();
  const [players, cpuReds] = await Promise.all([
    db`select * from ${db(t)} where match_id = ${id} order by motm desc, rating desc` as unknown as Promise<MatchPlayer[]>,
    db`select player, sum(amount)::int as n from corrections where match_id = ${id} and stat = 'reds' group by player`,
  ]);
  return {
    match,
    players,
    team: match.team ?? { us: null, them: null },
    cpuReds: new Map(cpuReds.map((r) => [r.player as string, r.n as number])),
  };
}

export type LogRow = MatchPlayer & Pick<MatchRow, "ts" | "opp_name" | "opp_crest" | "goals_for" | "goals_against" | "result" | "dnf">;

export async function getPlayerLog(gamertag: string, limit = 20): Promise<LogRow[]> {
  const db = sql();
  const t = await playersTable();
  return (await db`
    select mp.*, m.ts, m.opp_name, m.opp_crest, m.goals_for, m.goals_against, m.result, m.dnf
    from ${db(t)} mp join matches m on m.id = mp.match_id
    where mp.player = ${gamertag} order by m.ts desc limit ${limit}`) as unknown as LogRow[];
}

export async function getSeasonCpuReds(player: string): Promise<number> {
  const [r] = await sql()`select amount from corrections where match_id is null and player = ${player} and stat = 'reds'`;
  return r ? Number(r.amount) : 0;
}

export type Tactic = { id: number; name: string; formation: string | null; code: string; note: string | null; added_by: string | null };

export async function getTactics(): Promise<Tactic[]> {
  return (await sql()`select id, name, formation, code, note, added_by from tactics order by created_at asc`) as unknown as Tactic[];
}

export async function savedMatchCount(): Promise<{ count: number; since: number | null }> {
  const [r] = await sql()`select count(*)::int as c, min(ts) as since from matches`;
  return { count: r.c, since: r.since ?? null };
}

export async function lastPoll() {
  const [r] = await sql()`select at, ok, new_matches, message from poll_log order by id desc limit 1`;
  return r ? { at: new Date(r.at).getTime(), ok: Boolean(r.ok), newMatches: Number(r.new_matches), message: String(r.message ?? "") } : null;
}

export type Rec = { label: string; value: string; who: string; detail: string; matchId?: string; crest?: string | null };

export async function getRecords() {
  const db = sql();
  const t = await playersTable();
  const matches = (await db`select id, ts, opp_name, opp_crest, goals_for, goals_against, result, dnf from matches order by ts asc`) as unknown as MatchRow[];
  const out: { matchRecords: Rec[]; shame: Rec[]; streaks: { win: number; unbeaten: number; losing: number }; captains: { player: string; n: number }[] } = {
    matchRecords: [],
    shame: [],
    streaks: { win: 0, unbeaten: 0, losing: 0 },
    captains: [],
  };
  if (!matches.length) return out;

  const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Berlin" });
  const vs = (m: Pick<MatchRow, "goals_for" | "goals_against" | "opp_name" | "ts" | "dnf">) =>
    `${m.goals_for}–${m.goals_against} vs ${m.opp_name} · ${fmtDate(m.ts)}${m.dnf ? " · they quit" : ""}`;
  const margin = (m: MatchRow) => m.goals_for - m.goals_against;

  const wins = matches.filter((m) => m.result === "W");
  const biggestWin = [...wins].sort((a, b) => margin(b) - margin(a) || b.goals_for - a.goals_for)[0];
  if (biggestWin) out.matchRecords.push({ label: "Biggest win", value: `+${margin(biggestWin)}`, who: "Club", detail: vs(biggestWin), matchId: biggestWin.id, crest: biggestWin.opp_crest });
  const mostGoals = [...matches].sort((a, b) => b.goals_for - a.goals_for)[0];
  out.matchRecords.push({ label: "Most goals in a game", value: String(mostGoals.goals_for), who: "Club", detail: vs(mostGoals), matchId: mostGoals.id, crest: mostGoals.opp_crest });

  const best = async (order: postgres.PendingQuery<postgres.Row[]>) => {
    const [r] = await order;
    return r as (MatchPlayer & MatchRow) | undefined;
  };
  const base = (cond: string, dir: "asc" | "desc", col: string) =>
    db`select mp.player, mp.match_id, mp.goals, mp.assists, mp.rating, mp.saves, m.ts, m.opp_name, m.opp_crest, m.goals_for, m.goals_against, m.dnf
       from ${db(t)} mp join matches m on m.id = mp.match_id
       where ${db.unsafe(cond)} order by ${db.unsafe(col)} ${db.unsafe(dir)}, mp.rating desc limit 1`;

  const hatTricks = await db`
    select mp.player, m.opp_name from ${db(t)} mp join matches m on m.id = mp.match_id
    where mp.goals >= 3 order by m.ts desc`;
  if (hatTricks.length)
    out.matchRecords.push({
      label: "Hat-tricks",
      value: String(hatTricks.length),
      who: [...new Set(hatTricks.map((h) => h.player as string))].join(", "),
      detail: hatTricks.slice(0, 4).map((h) => `${h.player} vs ${h.opp_name}`).join(" · "),
    });
  const topG = await best(base("true", "desc", "mp.goals"));
  if (topG?.goals) out.matchRecords.push({ label: "Most goals by a player", value: String(topG.goals), who: topG.player, detail: vs(topG), matchId: topG.match_id, crest: topG.opp_crest });
  const topA = await best(base("true", "desc", "mp.assists"));
  if (topA?.assists) out.matchRecords.push({ label: "Most assists in a game", value: String(topA.assists), who: topA.player, detail: vs(topA), matchId: topA.match_id, crest: topA.opp_crest });
  const topR = await best(base("mp.seconds >= 2700", "desc", "mp.rating"));
  if (topR) out.matchRecords.push({ label: "Highest match rating", value: topR.rating.toFixed(1), who: topR.player, detail: vs(topR), matchId: topR.match_id, crest: topR.opp_crest });
  const topS = await best(base("true", "desc", "mp.saves"));
  if (topS?.saves) out.matchRecords.push({ label: "Most saves in a game", value: String(topS.saves), who: topS.player, detail: vs(topS), matchId: topS.match_id, crest: topS.opp_crest });

  const losses = matches.filter((m) => m.result === "L");
  const worst = [...losses].sort((a, b) => margin(a) - margin(b) || b.goals_against - a.goals_against)[0];
  if (worst) out.shame.push({ label: "Heaviest defeat", value: `${worst.goals_for}–${worst.goals_against}`, who: `vs ${worst.opp_name}`, detail: fmtDate(worst.ts), matchId: worst.id, crest: worst.opp_crest });
  const leaky = [...matches].sort((a, b) => b.goals_against - a.goals_against)[0];
  if (leaky?.goals_against) out.shame.push({ label: "Most conceded in a game", value: String(leaky.goals_against), who: `vs ${leaky.opp_name}`, detail: fmtDate(leaky.ts), matchId: leaky.id, crest: leaky.opp_crest });
  const lowR = await best(base("mp.seconds >= 2700", "asc", "mp.rating"));
  if (lowR) out.shame.push({ label: "Lowest match rating", value: lowR.rating.toFixed(1), who: lowR.player, detail: vs(lowR), matchId: lowR.match_id, crest: lowR.opp_crest });
  const reds = await db`select player, sum(reds)::int as n from ${db(t)} group by player having sum(reds) > 0 order by n desc`;
  if (reds.length)
    out.shame.push({ label: "Red cards in saved games", value: String(reds[0].n), who: reds[0].player as string, detail: reds.map((r) => `${r.player} ${r.n}`).join(" · ") });

  let w = 0, u = 0, l = 0;
  for (const m of matches) {
    w = m.result === "W" ? w + 1 : 0;
    u = m.result !== "L" ? u + 1 : 0;
    l = m.result === "L" ? l + 1 : 0;
    out.streaks.win = Math.max(out.streaks.win, w);
    out.streaks.unbeaten = Math.max(out.streaks.unbeaten, u);
    out.streaks.losing = Math.max(out.streaks.losing, l);
  }
  out.captains = (await db`
    select captain as player, count(*)::int as n from match_notes
    where captain is not null and captain <> '' group by captain order by n desc`) as unknown as { player: string; n: number }[];
  return out;
}


export type SeasonEvent = { ts: number; kind: "promoted" | "season-over"; division: number };

export type Season = {
  division: number;
  points: number;
  target: number;
  chances: number;
  maxChances: number;
  /** league results since the state was last set, newest last */
  results: { id: string; ts: number; result: "W" | "D" | "L"; opp: string; score: string }[];
  events: SeasonEvent[];
  setAt: number;
  setBy: string | null;
};

const MAX_CHANCES = 3;
const POINTS = { W: 3, D: 1, L: 0 } as const;

/**
 * League season from the last known state plus every league result since:
 * win +3 points, draw +1, loss -1 chance. Hitting the target promotes the club
 * and starts a new season; running out of chances ends the season (same division).
 */
export const getSeason = cache(async (): Promise<Season | null> => {
  const db = sql();
  const [exists] = await db`select to_regclass('public.season_state') is not null as ok`;
  if (!exists?.ok) return null; // supabase/migrations/0004 not run yet
  const [state] = await db`select division, points, chances, target, anchor_ts, updated_by, updated_at from season_state where id = 1`;
  if (!state) return null;
  const games = (await db`
    select id, ts, result, opp_name, goals_for, goals_against from matches
    where match_type = 'leagueMatch' and ts > ${Number(state.anchor_ts)} order by ts asc`) as unknown as (MatchRow & { opp_name: string })[];

  let { division, points, chances } = state as { division: number; points: number; chances: number };
  const target = Number(state.target);
  const events: SeasonEvent[] = [];
  let results: Season["results"] = [];
  for (const g of games) {
    results.push({ id: g.id, ts: Number(g.ts), result: g.result, opp: g.opp_name, score: `${g.goals_for}–${g.goals_against}` });
    points += POINTS[g.result];
    if (g.result === "L") chances -= 1;
    if (points >= target) {
      division = Math.max(1, division - 1);
      events.push({ ts: Number(g.ts), kind: "promoted", division });
      points = 0;
      chances = MAX_CHANCES;
      results = [];
    } else if (chances <= 0) {
      events.push({ ts: Number(g.ts), kind: "season-over", division });
      points = 0;
      chances = MAX_CHANCES;
      results = [];
    }
  }
  return {
    division,
    points,
    target,
    chances,
    maxChances: MAX_CHANCES,
    results,
    events,
    setAt: new Date(state.updated_at).getTime(),
    setBy: (state.updated_by as string) ?? null,
  };
});
