"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CLUB_PASSWORD } from "./config";
import { sql } from "./db";

export type ActionState = { ok: boolean; message: string } | null;

/** Wrong passwords allowed per visitor, and from everyone together, within LOCK_MINUTES. */
const MAX_FAILURES = 5;
const MAX_FAILURES_ALL = 30;
const LOCK_MINUTES = 15;

/** The visitor, as a hash of their IP (the IP itself is never stored). */
async function visitor(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`sarmagang:${ip}`).digest("hex").slice(0, 32);
}

async function checkPassword(given: FormDataEntryValue | null): Promise<string | null> {
  if (!CLUB_PASSWORD) return "Editing is switched off: set CLUB_PASSWORD in Vercel.";
  const db = sql();
  const who = await visitor();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  // counted before checking, so a right guess during a lockout doesn't get through either
  const [c] = await db`
    select count(*) filter (where who = ${who})::int as mine, count(*)::int as everyone
    from password_failures where at > ${since}`;
  if (c.mine >= MAX_FAILURES || c.everyone >= MAX_FAILURES_ALL)
    return `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.`;
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(CLUB_PASSWORD);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db`insert into password_failures (who) values (${who})`;
    await db`delete from password_failures where at < now() - interval '1 day'`;
    const left = MAX_FAILURES - c.mine - 1;
    return left > 0 ? `Wrong club password (${left} ${left === 1 ? "try" : "tries"} left).` : `Wrong club password. Locked for ${LOCK_MINUTES} minutes.`;
  }
  return null;
}

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

/** Move one of a player's red cards in a match to the CPU (or undo that). */
export async function toggleCpuRed(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  const matchId = text(form, "matchId", 40);
  const player = text(form, "player", 40);
  const db = sql();
  const [row] = await db`select reds from match_players where match_id = ${matchId} and player = ${player}`;
  if (!row || row.reds < 1) return { ok: false, message: "That player has no red card in this match." };
  const [existing] = await db`select id from corrections where match_id = ${matchId} and player = ${player} and stat = 'reds'`;
  if (existing) {
    await db`delete from corrections where id = ${existing.id}`;
  } else {
    await db`
      insert into corrections (match_id, player, stat, amount, note, created_by)
      values (${matchId}, ${player}, 'reds', ${row.reds}, 'CPU card while playing ANY', ${text(form, "by", 40) || null})`;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: existing ? "Red card given back to the player." : "Red card moved to the CPU." };
}

/** Season-level correction for red cards from before the site saved matches. */
export async function setSeasonCpuReds(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  const player = text(form, "player", 40);
  const amount = Math.max(0, Math.min(50, Math.round(Number(form.get("amount") ?? 0)) || 0));
  const db = sql();
  await db.begin(async (tx) => {
    await tx`delete from corrections where match_id is null and player = ${player} and stat = 'reds'`;
    if (amount > 0)
      await tx`
        insert into corrections (match_id, player, stat, amount, note, created_by)
        values (null, ${player}, 'reds', ${amount}, 'CPU cards before tracking started', ${text(form, "by", 40) || null})`;
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved: ${amount} earlier red card(s) of ${player} counted as the CPU's.` };
}

export async function setCaptain(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  const matchId = text(form, "matchId", 40);
  const captain = text(form, "captain", 40) || null;
  await sql()`
    insert into match_notes (match_id, captain, updated_at) values (${matchId}, ${captain}, now())
    on conflict (match_id) do update set captain = excluded.captain, updated_at = excluded.updated_at`;
  revalidatePath("/", "layout");
  return { ok: true, message: captain ? `Captain set: ${captain}` : "Captain cleared." };
}

export async function addTactic(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  const name = text(form, "name", 60);
  const code = text(form, "code", 40);
  if (!name || !code) return { ok: false, message: "A tactic needs a name and its share code." };
  await sql()`
    insert into tactics (name, formation, code, note, added_by)
    values (${name}, ${text(form, "formation", 20) || null}, ${code}, ${text(form, "note", 200) || null}, ${text(form, "by", 40) || null})`;
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved “${name}”.` };
}

export async function removeTactic(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  await sql()`delete from tactics where id = ${Number(form.get("id"))}`;
  revalidatePath("/", "layout");
  return { ok: true, message: "Tactic removed." };
}

const intOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 && n <= 999 ? n : null;
};
const ratingOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? Math.round(n * 10) / 10 : null;
};
const POSITIONS = new Set(["GK", "CB", "LCB", "RCB", "LB", "RB", "LWB", "RWB", "CDM", "LDM", "RDM", "CM", "LCM", "RCM", "CAM", "LAM", "RAM", "LM", "RM", "LW", "RW", "CF", "ST", "LS", "RS"]);

/**
 * Saves the real lines from the in-game post-match screen. For each player:
 * fix_<n>=on means "use my numbers", otherwise any earlier fix is removed.
 */
export async function saveStatFixes(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  const matchId = text(form, "matchId", 40);
  const by = text(form, "by", 40) || null;
  const db = sql();
  const players = (await db`select player from match_players where match_id = ${matchId}`).map((r) => r.player as string);
  if (!players.length) return { ok: false, message: "Match not found." };
  const motmPlayer = text(form, "motm", 40);
  let fixed = 0;
  await db.begin(async (tx) => {
    for (let i = 0; i < players.length; i++) {
      const player = String(form.get(`player_${i}`) ?? "");
      if (!players.includes(player)) continue;
      if (form.get(`fix_${i}`) !== "on") {
        await tx`delete from match_player_fixes where match_id = ${matchId} and player = ${player}`;
        continue;
      }
      const pos = text(form, `position_${i}`, 4).toUpperCase();
      const row = {
        match_id: matchId,
        player,
        position: POSITIONS.has(pos) ? pos : null,
        rating: ratingOrNull(form.get(`rating_${i}`)),
        goals: intOrNull(form.get(`goals_${i}`)),
        assists: intOrNull(form.get(`assists_${i}`)),
        shots: intOrNull(form.get(`shots_${i}`)),
        passes_made: intOrNull(form.get(`passes_${i}`)),
        tackles_made: intOrNull(form.get(`tackles_${i}`)),
        motm: motmPlayer === player,
        updated_by: by,
      };
      await tx`
        insert into match_player_fixes ${tx(row)}
        on conflict (match_id, player) do update set
          position = excluded.position, rating = excluded.rating, goals = excluded.goals,
          assists = excluded.assists, shots = excluded.shots, passes_made = excluded.passes_made,
          tackles_made = excluded.tackles_made, motm = excluded.motm,
          updated_by = excluded.updated_by, updated_at = now()`;
      fixed++;
    }
  });
  revalidatePath("/", "layout");
  return { ok: true, message: fixed ? `Saved the real stats for ${fixed} player(s).` : "Back to EA's numbers for this match." };
}

/** Sets the league season as shown in the lobby right now; later results are applied automatically. */
export async function setSeasonState(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  const division = intOrNull(form.get("division"));
  const points = intOrNull(form.get("points"));
  const target = intOrNull(form.get("target"));
  const chances = intOrNull(form.get("chances"));
  if (division === null || division < 1 || division > 10) return { ok: false, message: "Division must be 1–10." };
  if (points === null || target === null || target < 1) return { ok: false, message: "Enter the points and the target." };
  if (chances === null || chances > 3) return { ok: false, message: "Chances must be 0–3." };
  const now = Math.floor(Date.now() / 1000);
  await sql()`
    insert into season_state (id, division, points, chances, target, anchor_ts, updated_by, updated_at)
    values (1, ${division}, ${points}, ${chances}, ${target}, ${now}, ${text(form, "by", 40) || null}, now())
    on conflict (id) do update set division = excluded.division, points = excluded.points, chances = excluded.chances,
      target = excluded.target, anchor_ts = excluded.anchor_ts, updated_by = excluded.updated_by, updated_at = now()`;
  revalidatePath("/", "layout");
  return { ok: true, message: `Season set: Division ${division}, ${points}/${target} points, ${chances} chance(s).` };
}
