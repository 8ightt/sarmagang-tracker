"use server";

import { revalidatePath } from "next/cache";
import { checkEa } from "./check-ea";
import { checkPassword } from "./password";
import { refreshSettings, type ClubSeason, type LeagueRules, type LookSettings, type PlayerSettings } from "./config";
import { sql } from "./db";

export type ActionState = { ok: boolean; message: string } | null;

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

/** Seconds between EA checks the "Check now" button may start; anyone can press it, so EA stays unhammered. */
const CHECK_NOW_GAP = 60;

/** The club page's "Check now": one EA check right away instead of waiting for the timer. */
export async function checkNow(_prev: ActionState): Promise<ActionState> {
  const [last] = await sql()`select extract(epoch from now() - at)::int as ago from poll_log order by id desc limit 1`;
  if (last && Number(last.ago) < CHECK_NOW_GAP) {
    return { ok: true, message: `Checked ${Number(last.ago)}s ago; try again in ${CHECK_NOW_GAP - Number(last.ago)}s.` };
  }
  const result = await checkEa("button");
  revalidatePath("/", "layout");
  if (!result.ok) return { ok: false, message: "EA didn't answer properly; the timer tries again soon." };
  return { ok: true, message: result.newMatches ? `${result.newMatches} new game${result.newMatches === 1 ? "" : "s"} saved.` : "Up to date: no new games yet." };
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

export type SettingsSection = "club" | "look" | "players" | "seasons" | "league";

const HEX = /^#[0-9a-f]{6}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** an uploaded crest, already scaled down in the browser (components/SettingsForms.tsx) */
const MAX_CREST_CHARS = 400_000;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** One section of /settings, checked field by field; null with a reason when it doesn't hold. */
function parseSection(section: SettingsSection, raw: unknown): { value: unknown } | { error: string } {
  const v = (raw ?? {}) as Record<string, unknown>;
  switch (section) {
    case "club":
      return { value: str(v.tagline, 120) || undefined };
    case "look": {
      const look: LookSettings = {};
      for (const key of ["club", "accent"] as const) {
        const c = str(v[key], 7);
        if (c && !HEX.test(c)) return { error: `${key === "club" ? "Shirt colour" : "Accent"} must be a colour like #189745.` };
        if (c) look[key] = c.toLowerCase();
      }
      const crest = typeof v.crest === "string" ? v.crest : "";
      if (crest && (!/^data:image\/(png|jpeg|webp);base64,/.test(crest) || crest.length > MAX_CREST_CHARS))
        return { error: "The crest must be a PNG, JPG or WebP image under about 300 KB." };
      if (crest) look.crest = crest;
      return { value: look };
    }
    case "players": {
      const players: Record<string, PlayerSettings> = {};
      for (const [name, p] of Object.entries(v)) {
        const q = (p ?? {}) as Record<string, unknown>;
        const photo = str(q.photo, 300);
        if (photo && !/^(https:\/\/|\/)/.test(photo)) return { error: `${name}: the photo must be an https:// link or a /path.` };
        // empty strings, not missing keys: an emptied field must also clear what config/settings.json says
        const entry: PlayerSettings = {
          nickname: str(q.nickname, 40),
          bio: str(q.bio, 240),
          position: str(q.position, 6).toUpperCase(),
          role: str(q.role, 10).toUpperCase(),
          photo,
        };
        players[name.slice(0, 40)] = entry;
      }
      return { value: players };
    }
    case "seasons": {
      if (!Array.isArray(raw)) return { error: "Seasons must be a list." };
      const seasons: ClubSeason[] = [];
      for (const s of raw as Record<string, unknown>[]) {
        const name = str(s.name, 40);
        const start = str(s.start, 10);
        const end = str(s.end, 10);
        if (!name) return { error: "Every season needs a name." };
        if (!DAY.test(start) || !DAY.test(end) || end < start) return { error: `${name}: enter a start and an end date, end after start.` };
        const time = (k: string) => {
          const t = str(s[k], 40);
          return t && Number.isFinite(Date.parse(t)) ? new Date(t).toISOString() : undefined;
        };
        seasons.push({ name, start, end, endsAt: time("endsAt"), playoffsStart: time("playoffsStart"), playoffsMatches: num(s.playoffsMatches, 1, 50) ?? undefined });
      }
      return { value: seasons.sort((a, b) => a.start.localeCompare(b.start)) };
    }
    case "league": {
      const chances = num(v.chances, 1, 10);
      const after = num(v.chancesAfterSurviving, 0, 10);
      if (chances === null || after === null) return { error: "Chances must be whole numbers." };
      const league: LeagueRules = { chances, chancesAfterSurviving: after, targets: {}, promotion: {}, pointsAfterMissedPromotion: {} };
      for (const [d, r] of Object.entries((v.divisions ?? {}) as Record<string, Record<string, unknown>>)) {
        if (!/^[1-9]$/.test(d)) continue;
        const target = num(r.target, 1, 99);
        const matches = num(r.matches, 1, 9);
        const wins = num(r.wins, 1, 9);
        const kept = num(r.pointsAfterMissed, 0, 99);
        if (target !== null) league.targets[d] = target;
        if (matches !== null && wins !== null) {
          if (wins > matches) return { error: `Division ${d}: wins needed can't be more than games in the series.` };
          league.promotion[d] = { matches, wins, confirmed: Boolean(r.confirmed) };
        }
        if (kept !== null) league.pointsAfterMissedPromotion[d] = kept;
      }
      return { value: league };
    }
  }
}

/** Saves one section of /settings (club password), on top of config/settings.json. */
export async function saveSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const err = await checkPassword(form.get("password"));
  if (err) return { ok: false, message: err };
  const section = String(form.get("section")) as SettingsSection;
  if (!["club", "look", "players", "seasons", "league"].includes(section)) return { ok: false, message: "Unknown section." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? "null"));
  } catch {
    return { ok: false, message: "That didn't come through: reload the page and try again." };
  }
  const parsed = parseSection(section, raw);
  if ("error" in parsed) return { ok: false, message: parsed.error };
  const key = section === "club" ? "tagline" : section;
  await sql()`
    insert into site_settings (key, data, updated_at) values ('main', ${sql().json({ [key]: parsed.value ?? null } as never)}, now())
    on conflict (key) do update set data = site_settings.data || excluded.data, updated_at = now()`;
  await refreshSettings(true);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}
