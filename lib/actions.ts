"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { CLUB_PASSWORD } from "./config";
import { sql } from "./db";

export type ActionState = { ok: boolean; message: string } | null;

function checkPassword(given: FormDataEntryValue | null): string | null {
  if (!CLUB_PASSWORD) return "Editing is switched off: set CLUB_PASSWORD in Vercel.";
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(CLUB_PASSWORD);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "Wrong club password.";
  return null;
}

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

/** Move one of a player's red cards in a match to the CPU (or undo that). */
export async function toggleCpuRed(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = checkPassword(form.get("password"));
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
  const err = checkPassword(form.get("password"));
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
  const err = checkPassword(form.get("password"));
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
  const err = checkPassword(form.get("password"));
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
  const err = checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  await sql()`delete from tactics where id = ${Number(form.get("id"))}`;
  revalidatePath("/", "layout");
  return { ok: true, message: "Tactic removed." };
}
