import type postgres from "postgres";
import { cache } from "react";
import { CLUB_ID, currentSeason, inGameArchetypes, loadSettings, playoffsWindow, promotionRule, refreshSettings, seasonOf, type InGameArchetype } from "./config";
import { COUNTER_STATS, counterStat, type Counters } from "./counters";
import { getSnapshot, sql } from "./db";
import type { EaMember } from "./ea";
import { crestUrl, positionName } from "./ea-assets";
import type { TopClub } from "./poller";

/**
 * Player lines with the club's stat fixes applied. Falls back to EA's raw lines
 * until supabase/migrations/0004 has been run.
 */
export const playersTable = cache(async (): Promise<string> => {
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
  /** one of our players quit mid-game: the club takes the loss */
  we_quit?: boolean;
  minutes: number;
  team: { us: Record<string, number> | null; them: Record<string, number> | null } | null;
  captain?: string | null;
  /** kit colours EA sent with the match (body, trim, sleeve, extra); null before migration 0005 */
  our_kit?: number[] | null;
  opp_kit?: number[] | null;
};

export type MatchPlayer = {
  match_id: string;
  player: string;
  /** exact position from a stat fix (e.g. "ST"), if the club entered one */
  position: string | null;
  /** EA's broad group: forward / midfielder / defender / goalkeeper */
  pos: string;
  archetype: number;
  /** null on a +CPU line without a fix: EA averages the CPU teammates' ratings into it (see ea_rating) */
  rating: number | null;
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
  /** EA's own numbers; on a +CPU line they include the CPU teammates' (goals/assists above don't) */
  ea_goals: number;
  ea_assists: number;
  /** hidden event counters {"id": count} (see lib/counters.ts); null for lines without them */
  counters: Counters | null;
  /** quit mid-game (EA userResult 6): EA wiped this line to 0, the counters kept the real numbers */
  quit: boolean;
  /** EA's passes and tackles (incl. the CPU's on a +CPU line); 0 until supabase/migrations/0008 has been run */
  ea_passes_made: number;
  ea_pass_attempts: number;
  ea_tackles_made: number;
  /** EA's rating; on a +CPU line it's the average of the player's and the CPU teammates' */
  ea_rating?: number | null;
  /** on a +CPU line without an entered rating: the estimate of the player's own (lib/rating-model.ts) */
  rating_est?: number | null;
  /** the fields below are 0/false until supabase/migrations/0005 has been run */
  goals_conceded: number;
  clean_sheet: boolean;
  /** real-world seconds EA counted as idle */
  idle_seconds: number;
  real_seconds: number;
  reflex_saves: number;
  parry_saves: number;
  punch_saves: number;
  dive_saves: number;
  cross_saves: number;
  direction_saves: number;
};

/** Idle this long in one game counts as AFK. */
export const AFK_SECONDS = 60;

export const SAVE_TYPES = [
  { key: "reflex_saves", label: "Reflex" },
  { key: "dive_saves", label: "Diving" },
  { key: "parry_saves", label: "Parry" },
  { key: "punch_saves", label: "Punch" },
  { key: "cross_saves", label: "Cross claimed" },
  { key: "direction_saves", label: "Positioning" },
] as const;

/** A keeper's saves split by type; EA leaves some saves untyped ("Other"). */
export function saveBreakdown(p: Pick<MatchPlayer, "saves" | (typeof SAVE_TYPES)[number]["key"]>) {
  const parts: { label: string; n: number }[] = SAVE_TYPES.map((t) => ({ label: t.label, n: Number(p[t.key] ?? 0) }));
  const other = p.saves - parts.reduce((a, b) => a + b.n, 0);
  if (other > 0) parts.push({ label: "Other", n: other });
  return parts.filter((x) => x.n > 0);
}

export const idleLabel = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

export type Club = {
  name: string;
  crestAssetId?: string;
  /** the crest to show: the one uploaded on /settings, else EA's */
  crest: string;
  /** the crest's main colour, as EA sends it with the kits */
  crestColor?: number;
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
  await refreshSettings();
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
    crest: loadSettings().look.crest || crestUrl(kit.crestAssetId),
    crestColor: kit.crestColor ? num(kit.crestColor) : undefined,
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
  /** own goals/assists: EA's season totals minus the CPU's share in saved games */
  goals: number;
  assists: number;
  /** EA's season totals, which include the CPU's goals/assists for whoever controls the CPU */
  goalsEa: number;
  assistsEa: number;
  /** EA's season passes/tackles; passes/tackles above take the CPU's share out of saved games */
  passesEa: number;
  tacklesEa: number;
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
  /** EA's season average rating; on +CPU games it's averaged with the CPU teammates' */
  ratingEa: number;
  /** saved +CPU games left out of rating (no in-game RR entered, no estimate) */
  ratingUnknown: number;
  /** saved +CPU games whose rating in the average is an estimate */
  ratingEstimated: number;
  /** this season's games from before the site saved matches, when the player runs the CPU: EA's totals may include its stats from those */
  cpuEarlyGames: number;
};

type Delta = { goals: number; assists: number; motm: number; passes: number; pass_attempts: number; tackles: number };

export const getMembers = cache(async (): Promise<Member[]> => {
  await refreshSettings();
  const db = sql();
  const fixesReady = (await playersTable()) === "match_players_effective";
  const [snap, cpuRows, cpuPlayerRows, savedRows, ratingRows, fixRows] = await Promise.all([
    getSnapshot<{ members: EaMember[] }>("members"),
    db`select player, sum(amount)::int as n from corrections where stat = 'reds' group by player`,
    db`select distinct player from match_players where controls_cpu`,
    db`select mp.player, m.ts from match_players mp join matches m on m.id = mp.match_id where mp.seconds > 0`,
    // lines whose rating isn't EA's: unknown or estimated (+CPU), or fixed from the in-game screen; needs migration 0017
    db`select mp.player, m.ts, mp.rating, mp.ea_rating, mp.rating_est from match_players_effective mp join matches m on m.id = mp.match_id
        where mp.seconds > 0 and mp.rating is distinct from mp.ea_rating`.catch(() => [] as postgres.Row[]),
    // how far the own/corrected lines differ from EA's, per player
    fixesReady
      ? db`select player,
             sum(goals - ea_goals)::int as goals,
             sum(assists - ea_assists)::int as assists,
             sum(motm::int - ea_motm::int)::int as motm,
             sum(passes_made - ea_passes_made)::int as passes,
             sum(coalesce(pass_attempts, passes_made) - ea_pass_attempts)::int as pass_attempts,
             sum(tackles_made - ea_tackles_made)::int as tackles
          from match_players_effective
          where goals <> ea_goals or assists <> ea_assists or motm <> ea_motm
             or passes_made <> ea_passes_made or pass_attempts is distinct from ea_pass_attempts or tackles_made <> ea_tackles_made
          group by player`
      : Promise.resolve([] as postgres.Row[]),
  ]);
  const members = snap?.data?.members ?? [];
  const settings = loadSettings();
  const cpuReds = new Map(cpuRows.map((r) => [r.player as string, r.n as number]));
  const cpuPlayers = new Set(cpuPlayerRows.map((r) => r.player as string));
  const fixDelta = new Map(fixRows.map((r) => [r.player as string, r as unknown as Delta]));
  // saved games of the season EA's totals cover
  const season = currentSeason()?.name;
  const savedGames = new Map<string, number>();
  for (const r of savedRows)
    if (seasonOf(Number(r.ts))?.name === season) savedGames.set(r.player as string, (savedGames.get(r.player as string) ?? 0) + 1);
  // per player: EA ratings to take out of the season average, games to drop, entered or estimated ratings to put in
  const ratingFix = new Map<string, { eaOut: number; dropped: number; fixedIn: number; estimated: number }>();
  for (const r of ratingRows) {
    if (seasonOf(Number(r.ts))?.name !== season) continue;
    const x = ratingFix.get(r.player as string) ?? { eaOut: 0, dropped: 0, fixedIn: 0, estimated: 0 };
    x.eaOut += Number(r.ea_rating ?? 0);
    if (r.rating !== null) x.fixedIn += Number(r.rating);
    else if (r.rating_est !== null && r.rating_est !== undefined) {
      x.fixedIn += Number(r.rating_est);
      x.estimated += 1;
    } else x.dropped += 1;
    ratingFix.set(r.player as string, x);
  }
  return members
    .map((m) => {
      const s = settings.players[m.name] ?? {};
      const eaPos = positionName(m.proPos);
      const redsEa = num(m.redCards);
      const redsCpu = cpuReds.get(m.name) ?? 0;
      const fix = fixDelta.get(m.name) ?? { goals: 0, assists: 0, motm: 0, passes: 0, pass_attempts: 0, tackles: 0 };
      // EA only sends pass success %, so its attempts are worked back from that
      const passesEa = num(m.passesMade);
      const attemptsEa = num(m.passSuccessRate) > 0 ? passesEa / (num(m.passSuccessRate) / 100) : passesEa;
      const passes = Math.max(0, passesEa + fix.passes);
      const attempts = Math.max(passes, attemptsEa + fix.pass_attempts);
      return {
        gamertag: m.name,
        proName: m.proName || "—",
        overall: num(m.proOverall),
        height: num(m.proHeight),
        nation: m.proNationality ?? "",
        eaPosition: eaPos,
        // an empty value saved on /settings means "not set"
        position: s.position || eaPos || "",
        role: s.role || "",
        nickname: s.nickname || undefined,
        bio: s.bio || undefined,
        photo: s.photo || undefined,
        games: num(m.gamesPlayed),
        winRate: num(m.winRate),
        // EA's season totals minus the CPU's share (and with the club's fixes) in saved games
        goals: Math.max(0, num(m.goals) + fix.goals),
        assists: Math.max(0, num(m.assists) + fix.assists),
        goalsEa: num(m.goals),
        assistsEa: num(m.assists),
        rating: (() => {
          const rf = ratingFix.get(m.name);
          const games = num(m.gamesPlayed);
          if (!rf || games - rf.dropped <= 0) return num(m.ratingAve);
          return Math.round(((num(m.ratingAve) * games - rf.eaOut + rf.fixedIn) / (games - rf.dropped)) * 10) / 10;
        })(),
        ratingEa: num(m.ratingAve),
        ratingUnknown: ratingFix.get(m.name)?.dropped ?? 0,
        ratingEstimated: ratingFix.get(m.name)?.estimated ?? 0,
        motm: Math.max(0, num(m.manOfTheMatch) + fix.motm),
        redsEa,
        redsCpu,
        reds: Math.max(0, redsEa - redsCpu),
        passes,
        passPct: attempts > 0 ? Math.round((passes / attempts) * 100) : num(m.passSuccessRate),
        passesEa,
        tackles: Math.max(0, num(m.tacklesMade) + fix.tackles),
        tacklesEa: num(m.tacklesMade),
        tacklePct: num(m.tackleSuccessRate),
        shotPct: num(m.shotSuccessRate),
        lastTenGoals: Array.from({ length: 10 }, (_, i) => num(m[`prevGoals${i + 1}`])).reverse(),
        controlsCpu: cpuPlayers.has(m.name) || /any/i.test(s.role ?? ""),
        cpuEarlyGames:
          cpuPlayers.has(m.name) || /any/i.test(s.role ?? "") ? Math.max(0, num(m.gamesPlayed) - (savedGames.get(m.name) ?? 0)) : 0,
      } satisfies Member;
    })
    .sort((a, b) => b.games - a.games);
});

/** Whether supabase/migrations/0005 (conceded, idle time, save types, kits) has been run. */
const extrasReady = cache(async (): Promise<boolean> => {
  const [r] = await sql()`
    select exists (select 1 from information_schema.columns where table_name = 'matches' and column_name = 'opp_kit') as ok`;
  return Boolean(r?.ok);
});

const kitColumns = (ready: boolean) => sql().unsafe(ready ? "m.our_kit, m.opp_kit" : "null as our_kit, null as opp_kit");

export async function getMatches(limit = 50): Promise<MatchRow[]> {
  const kits = kitColumns(await extrasReady());
  return (await sql()`
    select m.id, m.ts, m.match_type, m.opp_id, m.opp_name, m.opp_crest, m.goals_for, m.goals_against,
           m.result, m.dnf, m.minutes, m.team, n.captain, ${kits},
           exists (select 1 from match_players q where q.match_id = m.id and q.quit) as we_quit
    from matches m left join match_notes n on n.match_id = m.id
    order by m.ts desc limit ${limit}`) as unknown as MatchRow[];
}

export async function getMatch(id: string) {
  const db = sql();
  const kits = kitColumns(await extrasReady());
  const [match] = (await db`
    select m.id, m.ts, m.match_type, m.opp_id, m.opp_name, m.opp_crest, m.goals_for, m.goals_against,
           m.result, m.dnf, m.minutes, m.team, n.captain, ${kits}
    from matches m left join match_notes n on n.match_id = m.id where m.id = ${id}`) as unknown as MatchRow[];
  if (!match) return null;
  const t = await playersTable();
  const [players, cpuReds] = await Promise.all([
    db`select * from ${db(t)} where match_id = ${id} order by motm desc, rating desc nulls last` as unknown as Promise<MatchPlayer[]>,
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

export type Advanced = {
  /** saved games that had counters */
  games: number;
  totals: Record<string, number>;
};

/** Per-player totals of the counter stats (interceptions, dribbles…) over the saved games. */
export const getAdvanced = cache(async (): Promise<Map<string, Advanced>> => {
  const db = sql();
  const rows = (await db`
    select player, counters from match_players
    where counters is not null and seconds > 0`) as unknown as { player: string; counters: Counters }[];
  const out = new Map<string, Advanced>();
  for (const r of rows) {
    const a = out.get(r.player) ?? { games: 0, totals: Object.fromEntries(COUNTER_STATS.map((s) => [s.key, 0])) };
    a.games += 1;
    for (const s of COUNTER_STATS) a.totals[s.key] += counterStat(r.counters, s);
    out.set(r.player, a);
  }
  return out;
});

export type Tracked = {
  games: number;
  conceded: number;
  cleanSheets: number;
  afkGames: number;
  idleSeconds: number;
  saves: number;
  saveTypes: { label: string; n: number }[];
};

/** Per-player totals over the saved matches, for stats EA's season totals don't have. */
export const getTracked = cache(async (): Promise<Map<string, Tracked>> => {
  if (!(await extrasReady())) return new Map();
  const db = sql();
  const rows = await db`
    select player, count(*)::int as games, sum(goals_conceded)::int as conceded, sum(clean_sheet::int)::int as clean_sheets,
           count(*) filter (where idle_seconds >= ${AFK_SECONDS})::int as afk_games, sum(idle_seconds)::int as idle_seconds,
           sum(saves)::int as saves, sum(reflex_saves)::int as reflex_saves, sum(dive_saves)::int as dive_saves,
           sum(parry_saves)::int as parry_saves, sum(punch_saves)::int as punch_saves,
           sum(cross_saves)::int as cross_saves, sum(direction_saves)::int as direction_saves
    from ${db(await playersTable())} group by player`;
  return new Map(
    rows.map((r) => [
      r.player as string,
      {
        games: r.games,
        conceded: r.conceded,
        cleanSheets: r.clean_sheets,
        afkGames: r.afk_games,
        idleSeconds: r.idle_seconds,
        saves: r.saves,
        saveTypes: saveBreakdown(r as unknown as MatchPlayer),
      },
    ]),
  );
});

export type ArchetypeRow = {
  archetype: number;
  games: number;
  w: number;
  d: number;
  l: number;
  /** null when every game of the archetype was a +CPU one */
  rating: number | null;
  goals: number;
  assists: number;
  motm: number;
  saves: number;
};

/** One player's saved games split by the archetype they played, most played first. */
export async function getArchetypes(player: string): Promise<ArchetypeRow[]> {
  const db = sql();
  const rows = await db`
    select mp.archetype, count(*)::int as games,
           count(*) filter (where m.result = 'W')::int as w, count(*) filter (where m.result = 'D')::int as d,
           count(*) filter (where m.result = 'L')::int as l, avg(coalesce(mp.rating, mp.rating_est))::float as rating,
           sum(mp.goals)::int as goals, sum(mp.assists)::int as assists, sum(mp.motm::int)::int as motm, sum(mp.saves)::int as saves
    from ${db(await playersTable())} mp join matches m on m.id = mp.match_id
    where mp.player = ${player} and mp.seconds > 0
    group by mp.archetype order by games desc, rating desc nulls last`;
  return rows as unknown as ArchetypeRow[];
}

export type ArchetypeSeason = {
  archetype: number;
  /** the in-game totals (all season, up to asOf) */
  inGame: InGameArchetype | null;
  /** saved games after asOf, added on top */
  since: { games: number; goals: number; assists: number; motm: number; passes: number; tackles: number; saves: number; conceded: number; cleanSheets: number };
  /** in-game totals + saved games since */
  total: { games: number; goals: number; assists: number; motm: number; passes: number; tackles: number; saves: number; conceded: number; cleanSheets: number };
};

/** Row id for the season's games EA counted but the site never saw (archetype unknown). */
export const UNKNOWN_ARCHETYPE = -1;

/**
 * A player's whole season split by archetype. With the in-game Archetypes > Statistics totals
 * (config/archetype-stats.json): those, plus every game the site saved after they were copied.
 * Without: the saved games of the current season per archetype, plus an UNKNOWN_ARCHETYPE row
 * for the rest of EA's season totals (games from before the site saved matches).
 */
export async function getArchetypeSeason(
  player: string,
): Promise<{ season: string; asOf: number | null; rows: ArchetypeSeason[] } | null> {
  await refreshSettings();
  const copied = inGameArchetypes(player);
  const current = currentSeason();
  const snap = copied ?? (current ? { season: current.name, asOf: null, archetypes: {} as Record<string, InGameArchetype> } : null);
  if (!snap) return null;
  const asOf = snap.asOf ? Date.parse(snap.asOf) / 1000 : 0;
  const db = sql();
  // the player's own numbers, without the CPU's (the in-game screen's include them)
  const games = (await db`
    select mp.archetype, m.ts, mp.goals, mp.assists, mp.motm, mp.passes_made, mp.tackles_made, mp.saves,
           mp.goals_conceded, mp.clean_sheet, mp.ea_goals, mp.ea_assists, mp.ea_motm, mp.ea_passes_made, mp.ea_tackles_made
    from ${db(await playersTable())} mp join matches m on m.id = mp.match_id
    where mp.player = ${player} and mp.seconds > 0 and m.ts > ${asOf} and m.match_type <> 'friendlyMatch'`) as unknown as {
    archetype: number; ts: number; goals: number; assists: number; motm: boolean; passes_made: number; tackles_made: number;
    saves: number; goals_conceded: number | null; clean_sheet: boolean | null;
    ea_goals: number; ea_assists: number; ea_motm: boolean; ea_passes_made: number; ea_tackles_made: number;
  }[];
  const zero = () => ({ games: 0, goals: 0, assists: 0, motm: 0, passes: 0, tackles: 0, saves: 0, conceded: 0, cleanSheets: 0 });
  const since = new Map<number, ReturnType<typeof zero>>();
  // EA's numbers for the same games, to take them out of EA's season totals below
  const eaSaved = zero();
  for (const g of games) {
    if (seasonOf(Number(g.ts))?.name !== snap.season) continue;
    eaSaved.games += 1;
    eaSaved.goals += Number(g.ea_goals ?? 0);
    eaSaved.assists += Number(g.ea_assists ?? 0);
    eaSaved.motm += g.ea_motm ? 1 : 0;
    eaSaved.passes += Number(g.ea_passes_made ?? 0);
    eaSaved.tackles += Number(g.ea_tackles_made ?? 0);
    const a = Number(g.archetype);
    const x = since.get(a) ?? zero();
    x.games += 1;
    x.goals += Number(g.goals ?? 0);
    x.assists += Number(g.assists ?? 0);
    x.motm += g.motm ? 1 : 0;
    x.passes += Number(g.passes_made ?? 0);
    x.tackles += Number(g.tackles_made ?? 0);
    x.saves += Number(g.saves ?? 0);
    x.conceded += Number(g.goals_conceded ?? 0);
    x.cleanSheets += g.clean_sheet ? 1 : 0;
    since.set(a, x);
  }
  const ids = new Set([...Object.keys(snap.archetypes).map(Number), ...since.keys()]);
  const rows = [...ids].map((archetype): ArchetypeSeason => {
    const inGame = snap.archetypes[String(archetype)] ?? null;
    const s = since.get(archetype) ?? zero();
    return {
      archetype,
      inGame,
      since: s,
      total: {
        games: (inGame?.matches ?? 0) + s.games,
        goals: (inGame?.goals ?? 0) + s.goals,
        assists: (inGame?.assists ?? 0) + s.assists,
        motm: (inGame?.motm ?? 0) + s.motm,
        passes: (inGame?.passesMade ?? 0) + s.passes,
        tackles: (inGame?.tackles ?? 0) + s.tackles,
        saves: (inGame?.saves ?? 0) + s.saves,
        conceded: (inGame?.goalsConceded ?? 0) + s.conceded,
        cleanSheets: (inGame?.cleanSheets ?? 0) + s.cleanSheets,
      },
    };
  });
  rows.sort((a, b) => b.total.games - a.total.games);
  if (!copied) {
    // EA's season totals minus what the saved games cover = the games nobody knows the archetype of
    const members = await getSnapshot<{ members?: Record<string, string>[] }>("members");
    const m = members?.data?.members?.find((x) => x.name === player);
    if (m) {
      const saved = eaSaved;
      const rest = (ea: number, ours: number) => Math.max(0, ea - ours);
      const unknown = {
        ...zero(),
        games: rest(num(m.gamesPlayed), saved.games),
        goals: rest(num(m.goals), saved.goals),
        assists: rest(num(m.assists), saved.assists),
        motm: rest(num(m.manOfTheMatch), saved.motm),
        passes: rest(num(m.passesMade), saved.passes),
        tackles: rest(num(m.tacklesMade), saved.tackles),
      };
      if (unknown.games > 0) rows.push({ archetype: UNKNOWN_ARCHETYPE, inGame: null, since: zero(), total: unknown });
    }
    if (!rows.some((r) => r.archetype !== UNKNOWN_ARCHETYPE)) return null;
  }
  return { season: snap.season, asOf: snap.asOf ? asOf : null, rows };
}

/** A member's all-time totals at the club (members/career/stats); EA's numbers, incl. the CPU's for whoever runs it. */
export async function getCareer(player: string) {
  const snap = await getSnapshot<{ members?: Record<string, string>[] }>("career");
  const m = snap?.data?.members?.find((x) => x.name === player);
  if (!m) return null;
  return { games: num(m.gamesPlayed), goals: num(m.goals), assists: num(m.assists), motm: num(m.manOfTheMatch), rating: num(m.ratingAve) };
}

/** The top 100 clubs by Skill Rating (allTimeLeaderboard), best first. */
export async function getTop100(): Promise<{ clubs: TopClub[]; updatedAt: number } | null> {
  const snap = await getSnapshot<TopClub[]>("leaderboard");
  if (!snap?.data?.length) return null;
  return { clubs: [...snap.data].sort((a, b) => a.rank - b.rank), updatedAt: snap.updatedAt };
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
       where ${db.unsafe(cond)} order by ${db.unsafe(col)} ${db.unsafe(dir)}, mp.rating desc nulls last limit 1`;

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
  const topR = await best(base("mp.seconds >= 2700 and mp.rating is not null", "desc", "mp.rating"));
  if (topR) out.matchRecords.push({ label: "Highest match rating", value: Number(topR.rating).toFixed(1), who: topR.player, detail: vs(topR), matchId: topR.match_id, crest: topR.opp_crest });
  const topS = await best(base("true", "desc", "mp.saves"));
  if (topS?.saves) out.matchRecords.push({ label: "Most saves in a game", value: String(topS.saves), who: topS.player, detail: vs(topS), matchId: topS.match_id, crest: topS.opp_crest });

  const losses = matches.filter((m) => m.result === "L");
  const worst = [...losses].sort((a, b) => margin(a) - margin(b) || b.goals_against - a.goals_against)[0];
  if (worst) out.shame.push({ label: "Heaviest defeat", value: `${worst.goals_for}–${worst.goals_against}`, who: `vs ${worst.opp_name}`, detail: fmtDate(worst.ts), matchId: worst.id, crest: worst.opp_crest });
  const leaky = [...matches].sort((a, b) => b.goals_against - a.goals_against)[0];
  if (leaky?.goals_against) out.shame.push({ label: "Most conceded in a game", value: String(leaky.goals_against), who: `vs ${leaky.opp_name}`, detail: fmtDate(leaky.ts), matchId: leaky.id, crest: leaky.opp_crest });
  const lowR = await best(base("mp.seconds >= 2700 and mp.rating is not null", "asc", "mp.rating"));
  if (lowR) out.shame.push({ label: "Lowest match rating", value: Number(lowR.rating).toFixed(1), who: lowR.player, detail: vs(lowR), matchId: lowR.match_id, crest: lowR.opp_crest });

  if (await extrasReady()) {
    const idle = await best(db`
      select mp.player, mp.match_id, mp.idle_seconds, m.ts, m.opp_name, m.opp_crest, m.goals_for, m.goals_against, m.dnf
      from ${db(t)} mp join matches m on m.id = mp.match_id
      where mp.idle_seconds >= ${AFK_SECONDS} order by mp.idle_seconds desc limit 1`);
    if (idle) {
      out.shame.push({ label: "Longest AFK", value: idleLabel(idle.idle_seconds), who: idle.player, detail: vs(idle), matchId: idle.match_id, crest: idle.opp_crest });
    }
  }

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


export type SeasonEvent = {
  ts: number;
  kind: "playoffs" | "promoted" | "playoff-lost" | "relegation-match" | "survived" | "relegated";
  division: number;
};

/** league: playing for points; relegation: out of chances, next game decides; playoffs: target reached */
export type SeasonPhase = "league" | "relegation" | "playoffs";

export type Season = {
  division: number;
  phase: SeasonPhase;
  points: number;
  target: number;
  chances: number;
  maxChances: number;
  /** results since the season started (or the state was last set), newest last */
  results: { id: string; ts: number; result: "W" | "D" | "L"; opp: string; score: string; type: string }[];
  events: SeasonEvent[];
  /** during the promotion match series */
  promotion: { played: number; wins: number; matches: number; winsNeeded: number; confirmed: boolean; games: Season["results"] } | null;
  /** every promotion match game since the season state was last set: match id → game n of the series */
  promotionGames: Record<string, { game: number; of: number; division: number }>;
  setAt: number;
  setBy: string | null;
};

const POINTS = { W: 3, D: 1, L: 0 } as const;
/** Division 1 is the highest numbered tier; above it is Elite (shown as 0). */
const LOWEST_DIVISION = 5;
export const divisionName = (d: number) => (d <= 0 ? "Elite" : `Division ${d}`);

/**
 * The league season, replayed from the last known state through every result since.
 *
 * - League: win +3 points, draw +1, loss -1 chance.
 * - Reaching the division's points target starts the promotion match: a short series that
 *   gets one win harder per division (Division 4: 2 wins from 3). Falling short keeps the
 *   club in its division with all chances back and the points one win short of the target
 *   (Division 3: 9 of 12, seen in the lobby on 14 Oct).
 * - Losing the last chance means a relegation match: win and you stay (with some chances
 *   back), lose and you go down a division.
 * Points targets per division and the chances you get back are in config/settings.json.
 * Games during a season's end-of-season Playoffs are left out (see getSeasonPlayoffs).
 */
export const getSeason = cache(async (): Promise<Season | null> => {
  await refreshSettings();
  const db = sql();
  const [exists] = await db`select to_regclass('public.season_state') is not null as ok`;
  if (!exists?.ok) return null; // supabase/migrations/0004 not run yet
  const [state] = await db`select division, points, chances, target, anchor_ts, updated_by, updated_at from season_state where id = 1`;
  if (!state) return null;
  const games = (await db`
    select id, ts, result, opp_name, goals_for, goals_against, match_type from matches
    where match_type in ('leagueMatch', 'playoffMatch') and ts > ${Number(state.anchor_ts)} order by ts asc`) as unknown as (MatchRow & {
    opp_name: string;
  })[];

  const league = loadSettings().league;
  const maxChances = league.chances;
  const targetFor = (d: number, fallback: number) => league.targets[String(d)] ?? fallback;

  let division = Number(state.division);
  let points = Number(state.points);
  let chances = Number(state.chances);
  let target = Number(state.target);
  let phase: SeasonPhase = points >= target ? "playoffs" : chances <= 0 ? "relegation" : "league";
  const events: SeasonEvent[] = [];
  let results: Season["results"] = [];
  let series = { played: 0, wins: 0 };
  const promotionGames: Season["promotionGames"] = {};
  const newSeason = (d: number) => {
    division = d;
    points = 0;
    chances = maxChances;
    target = targetFor(d, target);
    phase = "league";
    results = [];
    series = { played: 0, wins: 0 };
  };

  // games in the end-of-season Playoffs don't move league points or chances
  const windows = loadSettings().seasons.map(playoffsWindow).filter((w) => w !== null);
  for (const g of games) {
    const ts = Number(g.ts);
    if (windows.some((w) => ts >= w.from && ts <= w.to)) continue;
    results.push({ id: g.id, ts, result: g.result, opp: g.opp_name, score: `${g.goals_for}–${g.goals_against}`, type: g.match_type });

    if (phase === "playoffs") {
      series.played += 1;
      if (g.result === "W") series.wins += 1;
      const rule = promotionRule(division);
      promotionGames[g.id] = { game: series.played, of: rule.matches, division };
      if (series.wins >= rule.wins) {
        events.push({ ts, kind: "promoted", division: Math.max(0, division - 1) });
        newSeason(Math.max(0, division - 1));
      } else if (rule.wins - series.wins > rule.matches - series.played) {
        events.push({ ts, kind: "playoff-lost", division });
        newSeason(division);
        points = league.pointsAfterMissedPromotion[String(division)] ?? Math.max(0, target - POINTS.W);
      }
      continue;
    }

    if (phase === "relegation") {
      if (g.result === "W") {
        chances = league.chancesAfterSurviving;
        phase = "league";
        events.push({ ts, kind: "survived", division });
      } else if (g.result === "L") {
        const down = Math.min(LOWEST_DIVISION, division + 1);
        events.push({ ts, kind: "relegated", division: down });
        newSeason(down);
      }
      continue;
    }

    points += POINTS[g.result];
    if (g.result === "L") chances -= 1;
    if (points >= target) {
      phase = "playoffs";
      events.push({ ts, kind: "playoffs", division });
    } else if (chances <= 0) {
      chances = 0;
      phase = "relegation";
      events.push({ ts, kind: "relegation-match", division });
    }
  }

  return {
    division,
    phase,
    points,
    target,
    chances,
    maxChances,
    results,
    events,
    promotion:
      phase === "playoffs"
        ? {
            played: series.played,
            wins: series.wins,
            matches: promotionRule(division).matches,
            winsNeeded: promotionRule(division).wins,
            confirmed: promotionRule(division).confirmed,
            games: results.slice(results.length - series.played),
          }
        : null,
    promotionGames,
    setAt: new Date(state.updated_at).getTime(),
    setBy: (state.updated_by as string) ?? null,
  };
});

export type SeasonPlayoffs = {
  name: string;
  from: number;
  to: number;
  planned: number | null;
  games: { id: string; ts: number; result: "W" | "D" | "L"; opp: string; score: string }[];
  w: number;
  d: number;
  l: number;
  points: number;
  gf: number;
  ga: number;
  /** our Skill Rating saved with the last game before the Playoffs, and the latest one */
  srStart: number | null;
  srNow: number | null;
};

/**
 * The current season's end-of-season Playoffs: every league or playoff game between the
 * start in config/settings.json and the season's last day. Null before they start.
 */
export const getSeasonPlayoffs = cache(async (): Promise<SeasonPlayoffs | null> => {
  await refreshSettings();
  const x = currentSeason();
  const win = x ? playoffsWindow(x) : null;
  if (!x || !win || Date.now() / 1000 < win.from) return null;
  const db = sql();
  const [srCols] = await db`
    select exists (select 1 from information_schema.columns where table_name = 'matches' and column_name = 'our_sr') as ok`;
  const rows = await db`
    select id, ts, result, opp_name, goals_for, goals_against from matches
    where match_type in ('leagueMatch', 'playoffMatch') and ts >= ${win.from} and ts <= ${win.to} order by ts asc`;
  const [before] = srCols?.ok
    ? await db`select our_sr from matches where our_sr is not null and ts < ${win.from} order by ts desc limit 1`
    : [];
  const club = await getClub();
  const games = rows.map((r) => ({
    id: r.id as string,
    ts: Number(r.ts),
    result: r.result as "W" | "D" | "L",
    opp: r.opp_name as string,
    score: `${r.goals_for}–${r.goals_against}`,
  }));
  const count = (r: "W" | "D" | "L") => games.filter((g) => g.result === r).length;
  return {
    name: x.name,
    from: win.from,
    to: win.to,
    planned: x.playoffsMatches ?? null,
    games,
    w: count("W"),
    d: count("D"),
    l: count("L"),
    points: games.reduce((s, g) => s + POINTS[g.result], 0),
    gf: rows.reduce((s, r) => s + Number(r.goals_for), 0),
    ga: rows.reduce((s, r) => s + Number(r.goals_against), 0),
    srStart: before?.our_sr ?? null,
    srNow: club.skillRating,
  };
});
