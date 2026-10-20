import { cache } from "react";
import { sql } from "./db";
import { getInsights } from "./insights";
import { getMembers, playersTable } from "./stats";

/**
 * One short, factual line per player for the club page, worked out fresh from their own last
 * games (up to RECENT of them) and the analysis: scoring form against the season, streaks, MOTMs,
 * rating, results with them in the side and clean sheets in goal. Goals and assists are each
 * player's own; a rating built on estimates is marked "≈". Nothing here is written by hand: the
 * handwritten bio stays on the player's own page.
 */

const RECENT = 20;
/** fewer recent games than this and there's nothing fair to say about form */
const MIN_RECENT = 5;

type Line = {
  player: string;
  goals: number;
  assists: number;
  rating: number | null;
  rating_est: number | null;
  motm: boolean;
  pos: string;
  clean_sheet: boolean;
  result: "W" | "D" | "L";
};

type Fact = { score: number; text: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** Every notable fact about a player, most notable first, and the two-fact line built from them. */
export type PlayerFacts = { recentGames: number; facts: string[]; take: string };

export const getPlayerFacts = cache(async (): Promise<Map<string, PlayerFacts>> => {
  const db = sql();
  const t = await playersTable();
  const [lines, members, insights] = await Promise.all([
    db`
      select player, goals, assists, rating, rating_est, motm, pos, clean_sheet, result from (
        select mp.*, m.result, m.ts, row_number() over (partition by mp.player order by m.ts desc) as rn
        from ${db(t)} mp join matches m on m.id = mp.match_id
        where mp.seconds > 0
      ) x where rn <= ${RECENT}
      order by player, ts desc` as unknown as Promise<Line[]>,
    getMembers(),
    getInsights(),
  ]);

  const byPlayer = new Map<string, Line[]>();
  for (const l of lines) byPlayer.set(l.player, [...(byPlayer.get(l.player) ?? []), l]);

  // squad-wide reference points, over players with enough recent games
  const recentRating = (ls: Line[]) => {
    const rated = ls.map((l) => (l.rating ?? l.rating_est) as number | null).filter((r): r is number => r !== null);
    return rated.length >= MIN_RECENT ? rated.reduce((a, b) => a + Number(b), 0) / rated.length : null;
  };
  const ratings = [...byPlayer.entries()]
    .filter(([, ls]) => ls.length >= MIN_RECENT)
    .map(([p, ls]) => ({ p, r: recentRating(ls) }))
    .filter((x): x is { p: string; r: number } => x.r !== null)
    .sort((a, b) => b.r - a.r);
  const withWithout = new Map(insights.withWithout.map((w) => [w.player, w]));

  const out = new Map<string, PlayerFacts>();
  for (const m of members.filter((x) => x.games > 0)) {
    const ls = byPlayer.get(m.gamertag) ?? [];
    const n = ls.length;
    if (n < MIN_RECENT) {
      out.set(m.gamertag, { recentGames: n, facts: [], take: n ? `Only ${plural(n, "saved game")} so far: too early to call.` : "No saved games yet." });
      continue;
    }
    const facts: Fact[] = [];
    const goals = ls.reduce((a, l) => a + l.goals, 0);
    const assists = ls.reduce((a, l) => a + l.assists, 0);
    const gaRecent = (goals + assists) / n;
    const gaSeason = m.games ? (m.goals + m.assists) / m.games : 0;
    // "in the last 20", or "in 11 games" for someone who has only played that many
    const last = n === RECENT ? `the last ${RECENT}` : plural(n, "game");

    // scoring streak from the newest game back
    let streak = 0;
    while (streak < n && ls[streak].goals > 0) streak++;
    if (streak >= 3) facts.push({ score: 90 + streak, text: `Scored in ${streak} games in a row.` });

    // drought: a regular scorer who's stopped
    let dry = 0;
    while (dry < n && ls[dry].goals === 0) dry++;
    if (dry >= 5 && m.games && m.goals / m.games >= 0.4) facts.push({ score: 70 + dry, text: `No goal in ${plural(dry, "game")}, for someone who scores ${(m.goals / m.games).toFixed(1)} a game.` });

    if (goals + assists > 0 && gaSeason > 0) {
      const ratio = gaRecent / gaSeason;
      const line = `${plural(goals, "goal")} and ${plural(assists, "assist")} in ${last}`;
      if (ratio >= 1.25) facts.push({ score: 60 + ratio * 10, text: `${line}: ${gaRecent.toFixed(2)} a game, up from ${gaSeason.toFixed(2)} over the season.` });
      else if (ratio <= 0.7) facts.push({ score: 55 + (1 - ratio) * 20, text: `${line}: ${gaRecent.toFixed(2)} a game, down from ${gaSeason.toFixed(2)} over the season.` });
      else facts.push({ score: 30 + gaRecent * 10, text: `${line}.` });
    }

    const motm = ls.filter((l) => l.motm).length;
    if (motm >= 3) facts.push({ score: 50 + motm * 4, text: `${plural(motm, "MOTM", "MOTM")} in ${last}.` });

    const rank = ratings.findIndex((x) => x.p === m.gamertag);
    if (rank === 0) {
      const est = ls.some((l) => l.rating === null && l.rating_est !== null);
      facts.push({ score: 75, text: `Best rating in the squad lately: ${est ? "≈ " : ""}${ratings[0].r.toFixed(1)}.` });
    }

    const keeper = ls.filter((l) => l.pos === "goalkeeper");
    const sheets = keeper.filter((l) => l.clean_sheet).length;
    if (keeper.length >= 3 && sheets >= 2) facts.push({ score: 65 + sheets * 3, text: `${plural(sheets, "clean sheet")} in ${plural(keeper.length, "game")} in goal.` });

    const wins = ls.filter((l) => l.result === "W").length;
    const ww = withWithout.get(m.gamertag);
    if (ww?.ppgDiff !== null && ww?.ppgDiff !== undefined && Math.abs(ww.ppgDiff) >= 0.3 && ww.with.games >= 10 && ww.without.games >= 5) {
      facts.push({
        score: 45 + Math.abs(ww.ppgDiff) * 20,
        text: ww.ppgDiff > 0
          ? `The club takes ${ww.ppgDiff.toFixed(1)} more points a game when they play.`
          : `The club takes ${Math.abs(ww.ppgDiff).toFixed(1)} fewer points a game when they play.`,
      });
    } else if (pct(wins, n) >= 60) {
      facts.push({ score: 40 + pct(wins, n) / 5, text: n === RECENT ? `Won ${wins} of ${last}.` : `Won ${wins} of ${n}.` });
    }

    const sorted = facts.sort((a, b) => b.score - a.score).map((f) => f.text);
    out.set(m.gamertag, {
      recentGames: n,
      facts: sorted,
      take: sorted.length ? sorted.slice(0, 2).join(" ") : `${plural(n, "game")} lately, no standout numbers yet.`,
    });
  }
  return out;
});

/** The factual two-fact line per player (the fallback when there is no written bio). */
export const getPlayerTakes = cache(async (): Promise<Map<string, string>> =>
  new Map([...(await getPlayerFacts())].map(([p, f]) => [p, f.take])),
);
