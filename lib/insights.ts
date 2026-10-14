import { cache } from "react";
import { sql } from "./db";
import { groupShort } from "./ea-assets";
import { getClub } from "./stats";

/**
 * Stats worked out from the saved matches rather than taken from EA:
 * form, with/without, duos, positions and results by opponent strength.
 * Goals and assists are each player's own (see docs/ea-data.json).
 */

type Result = "W" | "D" | "L";
const POINTS: Record<Result, number> = { W: 3, D: 1, L: 0 };

type Game = {
  id: string;
  ts: number;
  result: Result;
  gf: number;
  ga: number;
  opp: string;
  crest: string | null;
  dnf: boolean;
  ourSr: number | null;
  oppSr: number | null;
};

/** rating is null on a +CPU line without a fix (EA averages the CPU's into it) */
type Line = { matchId: string; player: string; rating: number | null; goals: number; assists: number; position: string };

export type Record3 = { games: number; w: number; d: number; l: number; ppg: number; gf: number; ga: number };

function record(games: Game[]): Record3 {
  const n = games.length;
  const count = (r: Result) => games.filter((g) => g.result === r).length;
  const sum = (f: (g: Game) => number) => games.reduce((s, g) => s + f(g), 0);
  return {
    games: n,
    w: count("W"),
    d: count("D"),
    l: count("L"),
    ppg: n ? sum((g) => POINTS[g.result]) / n : 0,
    gf: n ? sum((g) => g.gf) / n : 0,
    ga: n ? sum((g) => g.ga) / n : 0,
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** average rating over the lines whose rating is known */
const avgRating = (ls: Line[]) => {
  const xs = ls.flatMap((l) => (l.rating === null ? [] : [l.rating]));
  return xs.length ? avg(xs) : null;
};

/** Fewest games for a row to be shown; small samples say little. */
export const MIN_GAMES = 3;
/** Skill Rating gap that counts as a stronger/weaker opponent. */
export const SR_GAP = 100;
/** Change in average rating that counts as hot/cold form. */
const FORM_GAP = 0.3;

const load = cache(async () => {
  const db = sql();
  const [srCols] = await db`
    select exists (select 1 from information_schema.columns where table_name = 'matches' and column_name = 'opp_sr') as ok`;
  const srSelect = db.unsafe(srCols?.ok ? "our_sr, opp_sr" : "null as our_sr, null as opp_sr");
  const [gameRows, lineRows] = await Promise.all([
    db`select id, ts, result, goals_for, goals_against, opp_name, opp_crest, dnf, ${srSelect} from matches order by ts desc`,
    db`select match_id, player, rating, goals, assists, position, pos from match_players_effective where seconds > 0`,
  ]);
  const games: Game[] = gameRows.map((r) => ({
    id: r.id,
    ts: Number(r.ts),
    result: r.result,
    gf: r.goals_for,
    ga: r.goals_against,
    opp: r.opp_name,
    crest: r.opp_crest,
    dnf: r.dnf,
    ourSr: r.our_sr ?? null,
    oppSr: r.opp_sr ?? null,
  }));
  const lines: Line[] = lineRows.map((r) => ({
    matchId: r.match_id,
    player: r.player,
    rating: r.rating === null ? null : Number(r.rating),
    goals: r.goals,
    assists: r.assists,
    position: r.position || groupShort(r.pos) || "?",
  }));
  return { games, lines };
});

export type FormRow = {
  player: string;
  games: number;
  rating: number;
  last5Rating: number;
  last5GoalsAssists: number;
  trend: "hot" | "cold" | "steady";
  /** newest last */
  recent: { rating: number | null; result: Result }[];
};

export type WithWithoutRow = { player: string; with: Record3; without: Record3; ppgDiff: number | null };

export type DuoRow = { players: [string, string]; rec: Record3; goalsAssists: number };

export type PositionRow = { player: string; position: string; games: number; rating: number | null; goalsAssistsPerGame: number };

export type OpponentBucket = { label: string; note: string; rec: Record3 };

export type Insights = {
  games: number;
  since: number | null;
  form: FormRow[];
  withWithout: WithWithoutRow[];
  duos: DuoRow[];
  positions: PositionRow[];
  opponents: {
    buckets: OpponentBucket[];
    upsets: (Game & { gap: number })[];
    toughest: (Game & { gap: number }) | null;
    rated: number;
    /** true when some games use today's club rating because ours wasn't saved at the time */
    estimated: boolean;
  };
};

export const getInsights = cache(async (): Promise<Insights> => {
  const [{ games, lines }, club] = await Promise.all([load(), getClub()]);
  const byId = new Map(games.map((g) => [g.id, g]));
  const byPlayer = new Map<string, Line[]>();
  for (const l of lines) {
    if (!byId.has(l.matchId)) continue;
    byPlayer.set(l.player, [...(byPlayer.get(l.player) ?? []), l]);
  }
  // newest first, like games
  for (const ls of byPlayer.values()) ls.sort((a, b) => byId.get(b.matchId)!.ts - byId.get(a.matchId)!.ts);
  const regulars = [...byPlayer.entries()].filter(([, ls]) => ls.length >= MIN_GAMES).map(([p]) => p);

  const form: FormRow[] = regulars
    .map((player) => {
      const ls = byPlayer.get(player)!;
      const last5 = ls.slice(0, 5);
      // ratings only from the games where it's known: the last 5 of those
      const rating = avgRating(ls) ?? 0;
      const last5Rating = avgRating(ls.filter((l) => l.rating !== null).slice(0, 5)) ?? rating;
      const diff = last5Rating - rating;
      return {
        player,
        games: ls.length,
        rating,
        last5Rating,
        last5GoalsAssists: last5.reduce((s, l) => s + l.goals + l.assists, 0),
        trend: (diff >= FORM_GAP ? "hot" : diff <= -FORM_GAP ? "cold" : "steady") as FormRow["trend"],
        recent: last5.map((l) => ({ rating: l.rating, result: byId.get(l.matchId)!.result })).reverse(),
      };
    })
    .sort((a, b) => b.last5Rating - a.last5Rating);

  const withWithout: WithWithoutRow[] = regulars
    .map((player) => {
      const played = new Set(byPlayer.get(player)!.map((l) => l.matchId));
      const w = record(games.filter((g) => played.has(g.id)));
      const wo = record(games.filter((g) => !played.has(g.id)));
      return { player, with: w, without: wo, ppgDiff: wo.games ? w.ppg - wo.ppg : null };
    })
    .sort((a, b) => (b.ppgDiff ?? -99) - (a.ppgDiff ?? -99) || b.with.ppg - a.with.ppg);

  const duos: DuoRow[] = [];
  for (let i = 0; i < regulars.length; i++) {
    for (let j = i + 1; j < regulars.length; j++) {
      const [a, b] = [regulars[i], regulars[j]];
      const la = new Map(byPlayer.get(a)!.map((l) => [l.matchId, l]));
      const lb = byPlayer.get(b)!.filter((l) => la.has(l.matchId));
      if (lb.length < MIN_GAMES) continue;
      const together = lb.map((l) => byId.get(l.matchId)!);
      const goalsAssists = lb.reduce((s, l) => s + l.goals + l.assists + la.get(l.matchId)!.goals + la.get(l.matchId)!.assists, 0);
      duos.push({ players: [a, b], rec: record(together), goalsAssists });
    }
  }
  duos.sort((x, y) => y.rec.ppg - x.rec.ppg || y.rec.games - x.rec.games);

  const positions: PositionRow[] = [];
  for (const [player, ls] of byPlayer) {
    const byPos = new Map<string, Line[]>();
    for (const l of ls) byPos.set(l.position, [...(byPos.get(l.position) ?? []), l]);
    for (const [position, pl] of byPos) {
      positions.push({
        player,
        position,
        games: pl.length,
        rating: avgRating(pl),
        goalsAssistsPerGame: pl.reduce((s, l) => s + l.goals + l.assists, 0) / pl.length,
      });
    }
  }
  positions.sort((a, b) => a.player.localeCompare(b.player) || b.games - a.games);

  // opponent strength: their Skill Rating minus ours (today's rating when ours wasn't saved)
  const rated = games
    .filter((g) => g.oppSr !== null && (g.ourSr ?? club.skillRating) !== null)
    .map((g) => ({ ...g, gap: g.oppSr! - (g.ourSr ?? club.skillRating!) }));
  const buckets: OpponentBucket[] = [
    { label: "Stronger", note: `${SR_GAP}+ SR above us`, rec: record(rated.filter((g) => g.gap >= SR_GAP)) },
    { label: "Even", note: `within ${SR_GAP} SR`, rec: record(rated.filter((g) => Math.abs(g.gap) < SR_GAP)) },
    { label: "Weaker", note: `${SR_GAP}+ SR below us`, rec: record(rated.filter((g) => g.gap <= -SR_GAP)) },
  ];
  const upsets = rated.filter((g) => g.result === "W" && !g.dnf && g.gap >= SR_GAP).sort((a, b) => b.gap - a.gap);
  const toughest = [...rated].sort((a, b) => b.gap - a.gap)[0] ?? null;

  return {
    games: games.length,
    since: games.length ? games[games.length - 1].ts : null,
    form,
    withWithout,
    duos,
    positions,
    opponents: { buckets, upsets, toughest, rated: rated.length, estimated: rated.some((g) => g.ourSr === null) },
  };
});
