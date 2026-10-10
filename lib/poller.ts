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
    raw: db.json(m as unknown as postgres.JSONValue),
  };
  const players = ours.map((p) => ({
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
  }));

  return db.begin(async (tx) => {
    const [res] = await tx`
      insert into matches ${tx(row)}
      on conflict (id) do update set raw = excluded.raw, team = excluded.team, minutes = excluded.minutes
      returning (xmax = 0) as inserted`;
    if (players.length) {
      await tx`
        insert into match_players ${tx(players)}
        on conflict (match_id, player) do update set
          pos = excluded.pos, archetype = excluded.archetype, rating = excluded.rating, goals = excluded.goals,
          assists = excluded.assists, shots = excluded.shots, passes_made = excluded.passes_made,
          pass_attempts = excluded.pass_attempts, tackles_made = excluded.tackles_made,
          tackle_attempts = excluded.tackle_attempts, saves = excluded.saves, reds = excluded.reds,
          motm = excluded.motm, seconds = excluded.seconds, controls_cpu = excluded.controls_cpu`;
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
  const scorers = players
    .filter((p) => n(p.goals) > 0)
    .map((p) => (n(p.goals) > 1 ? `${p.playername} ×${p.goals}` : p.playername))
    .join(", ");
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

/** One check of EA: saves new matches and refreshes club and member totals. */
export async function pollOnce(): Promise<{ ok: boolean; newMatches: number; message: string }> {
  const db = sql();
  const errors: string[] = [];
  let newMatches = 0;
  const [{ count: existing }] = await db`select count(*)::int as count from matches`;
  const firstRun = existing === 0;

  const saveList = async (type: string, list: EaMatch[]) => {
    // oldest first so Discord posts arrive in order
    for (const m of [...(Array.isArray(list) ? list : [])].sort((a, b) => n(a.timestamp) - n(b.timestamp))) {
      if (await saveMatch(m, type)) {
        newMatches++;
        // don't spam Discord with old games on the very first run
        if (!firstRun && Date.now() / 1000 - n(m.timestamp) < 6 * 3600) await announce(m);
      }
    }
  };

  // League games first, on their own: they matter most, and this call also
  // finds out which request style EA accepts for the rest.
  let eaReachable = true;
  try {
    await saveList("leagueMatch", await ea.matches("leagueMatch"));
  } catch (err) {
    errors.push((err as Error).message);
    eaReachable = false;
  }

  if (eaReachable) {
    const snap = async (key: string, fn: () => Promise<unknown>) => {
      try {
        await setSnapshot(key, await fn());
      } catch (err) {
        errors.push(`${key}: ${(err as Error).message}`);
      }
    };
    const previous = (await getSnapshot<Record<string, { name?: string }>>("info"))?.data;
    const clubName = previous?.[CLUB_ID]?.name ?? "Sarma gang";
    await Promise.all([
      ...MATCH_TYPES.filter((t) => t !== "leagueMatch").map((t) =>
        ea.matches(t).then((list) => saveList(t, list)).catch(() => {
          /* most clubs have no friendlies or playoffs: ignore */
        }),
      ),
      snap("info", ea.clubInfo),
      snap("overall", ea.overallStats),
      snap("members", ea.members),
      snap("career", ea.career),
      snap("search", () => ea.search(clubName)),
    ]);
  }

  const ok = errors.length === 0;
  const mode = eaHeaderMode();
  const message = (ok ? "ok" : errors.join("; ")) + (mode ? ` [${mode} headers]` : "");
  await db`insert into poll_log (ok, new_matches, message) values (${ok}, ${newMatches}, ${message})`;
  await db`delete from poll_log where id not in (select id from poll_log order by id desc limit 500)`;
  console.log(`[poll] ${ok ? "ok" : "partial"} · ${newMatches} new match(es)${ok ? "" : " · " + message}`);
  return { ok, newMatches, message };
}
