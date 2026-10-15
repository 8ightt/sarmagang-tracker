import { sql } from "./db";
import { senderName, type TgMessage } from "./telegram";

export const HELP = [
  "Send me screenshots from EA FC (Player Performance, Archetypes › Statistics, match facts…) and I'll save them for the Sarma gang tracker.",
  "Tip: send them as a file (📎 → File) to keep full quality.",
  "",
  "Ran the CPU? EA mixes the CPU's ratings into yours, so the site estimates it. Send the real one:",
  "/iam <gamertag> – once, so I know who you are",
  "/rr 7.4 – your in-game rating for the game you just played, if you ran the CPU",
  "/rr 7.4 Toz – the same for your latest CPU game against a club whose name contains “Toz”",
  "/undo – take back your last /rr",
].join("\n");

/** A plain /rr only goes to a CPU game played this recently (kick-off, minutes ago) */
const FRESH_MINUTES = 60;

const when = (ts: number) =>
  new Date(ts * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

/** Links the sender's Telegram account to a gamertag. The first account to claim one keeps it. */
async function iam(m: TgMessage, arg: string): Promise<string> {
  const fromId = m.from?.id;
  if (!fromId) return "I can't tell who you are in this chat. Message me directly.";
  if (!arg) return "Which gamertag? e.g. /iam dirty8ightt";
  const db = sql();
  const [p] = await db`select player from match_players where lower(player) = lower(${arg}) limit 1`;
  if (!p) return `I don't know “${arg}” yet: it has to be a gamertag from a saved game.`;
  const player = p.player as string;
  const [owner] = await db`select from_id from telegram_links where player = ${player}`;
  if (owner && Number(owner.from_id) !== fromId) return `${player} is already linked to someone else's Telegram. Ask the club to unlink it if that's wrong.`;
  await db`
    insert into telegram_links (from_id, player, from_name) values (${fromId}, ${player}, ${senderName(m)})
    on conflict (from_id) do update set player = excluded.player, from_name = excluded.from_name, linked_at = now()`;
  return `Got it: you're ${player}. After a game where you ran the CPU, send /rr and your in-game rating, e.g. /rr 7.4`;
}

/** Saves the sender's in-game rating for their latest +CPU game (or the latest against a named club). */
async function rr(m: TgMessage, arg: string): Promise<string> {
  const fromId = m.from?.id;
  if (!fromId) return "I can't tell who you are in this chat. Message me directly.";
  const [first, ...rest] = arg.split(/\s+/).filter(Boolean);
  const rating = Number(String(first ?? "").replace(",", "."));
  if (!first || !Number.isFinite(rating) || rating < 0 || rating > 10) return "Send the rating from the in-game screen, e.g. /rr 7.4";
  const value = Math.round(rating * 10) / 10;
  const db = sql();
  const [link] = await db`select player from telegram_links where from_id = ${fromId}`;
  if (!link) return "Tell me your gamertag first: /iam <gamertag>";
  const player = link.player as string;
  const opp = rest.join(" ");
  const [game] = await db`
    select mp.match_id, mp.motm, mp.rating as ea, mp.rating_est, m.opp_name, m.ts, m.goals_for, m.goals_against
    from match_players mp join matches m on m.id = mp.match_id
    where mp.player = ${player} and mp.controls_cpu and mp.seconds > 0
      ${opp ? db`and m.opp_name ilike ${"%" + opp.replace(/[%_\\]/g, "\\$&") + "%"}` : db``}
    order by m.ts desc limit 1`;
  if (!game) return opp ? `No saved game where ${player} ran the CPU against a club matching “${opp}”.` : `No saved game where ${player} ran the CPU yet.`;
  const vs = `vs ${game.opp_name} (${game.goals_for}–${game.goals_against}, ${when(Number(game.ts))})`;
  if (!opp) {
    // without a club, only the game just played: a game that isn't saved yet would otherwise
    // send the rating to an older one
    const [latest] = await db`
      select m.id, m.opp_name, m.ts from match_players mp join matches m on m.id = mp.match_id
      where mp.player = ${player} and mp.seconds > 0 order by m.ts desc limit 1`;
    const ageMin = (Date.now() / 1000 - Number(game.ts)) / 60;
    if (latest && latest.id !== game.match_id)
      return `Your latest saved game, vs ${latest.opp_name}, wasn't one where you ran the CPU. For the one ${vs}, add the club: /rr ${value.toFixed(1)} ${game.opp_name}`;
    if (ageMin > FRESH_MINUTES)
      return `Your latest saved CPU game is ${vs}. If you just played, it may not be saved yet: try again in a few minutes. If it's that one, add the club: /rr ${value.toFixed(1)} ${game.opp_name}`;
  }
  await db.begin(async (tx) => {
    const [prev] = await tx`select rating from match_player_fixes where match_id = ${game.match_id} and player = ${player}`;
    await tx`
      insert into match_player_fixes (match_id, player, rating, motm, updated_by)
      values (${game.match_id}, ${player}, ${value}, ${game.motm}, ${`telegram: ${senderName(m)}`})
      on conflict (match_id, player) do update set rating = excluded.rating, updated_by = excluded.updated_by, updated_at = now()`;
    await tx`
      update telegram_links set last_match_id = ${game.match_id}, last_prev_rating = ${prev?.rating ?? null},
        last_had_fix = ${Boolean(prev)}, last_at = now()
      where from_id = ${fromId}`;
  });
  const was = game.rating_est !== null ? `, was ≈ ${Number(game.rating_est).toFixed(1)} est.` : "";
  return `Saved ${value.toFixed(1)} for ${player} ${vs}; EA's ${Number(game.ea).toFixed(1)} incl. CPU${was}. Wrong game? /undo`;
}

/** Puts back what the sender's last /rr changed. */
async function undo(m: TgMessage): Promise<string> {
  const fromId = m.from?.id;
  if (!fromId) return "I can't tell who you are in this chat. Message me directly.";
  const db = sql();
  const [link] = await db`
    select l.player, l.last_match_id, l.last_prev_rating, l.last_had_fix, m.opp_name, m.ts, m.goals_for, m.goals_against
    from telegram_links l left join matches m on m.id = l.last_match_id where l.from_id = ${fromId}`;
  if (!link?.last_match_id) return "Nothing to undo.";
  const player = link.player as string;
  const [fix] = await db`select updated_by from match_player_fixes where match_id = ${link.last_match_id} and player = ${player}`;
  // changed with Fix stats since: leave that alone
  if (fix && !String(fix.updated_by ?? "").startsWith("telegram:"))
    return "That rating was changed with Fix stats since, so I left it. Use Fix stats on the match page.";
  await db.begin(async (tx) => {
    if (link.last_had_fix)
      await tx`update match_player_fixes set rating = ${link.last_prev_rating}, updated_at = now() where match_id = ${link.last_match_id} and player = ${player}`;
    else await tx`delete from match_player_fixes where match_id = ${link.last_match_id} and player = ${player}`;
    await tx`update telegram_links set last_match_id = null, last_prev_rating = null, last_had_fix = null, last_at = null where from_id = ${fromId}`;
  });
  const back = link.last_had_fix ? (link.last_prev_rating !== null ? `back to ${Number(link.last_prev_rating).toFixed(1)}` : "back to no rating") : "back to the estimate";
  return `Undone: ${player} vs ${link.opp_name} (${link.goals_for}–${link.goals_against}, ${when(Number(link.ts))}) is ${back}.`;
}

/** Answers a bot command, or returns null when the message isn't one. */
export async function command(m: TgMessage): Promise<string | null> {
  const text = (m.text ?? "").trim();
  const match = /^\/(\w+)(?:@\w+)?\s*(.*)$/s.exec(text);
  if (!match) return null;
  const [, name, arg] = match;
  switch (name.toLowerCase()) {
    case "iam":
      return iam(m, arg.trim());
    case "rr":
      return rr(m, arg.trim());
    case "undo":
      return undo(m);
    default:
      return HELP;
  }
}
