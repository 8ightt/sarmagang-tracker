import { sql } from "./db";
import { senderName, type TgMessage } from "./telegram";

export const HELP = [
  "Send me screenshots from EA FC (Player Performance, Archetypes › Statistics, match facts…) and I'll save them for the Sarma gang tracker.",
  "Tip: send them as a file (📎 → File) to keep full quality.",
  "",
  "Ran the CPU? EA mixes the CPU's ratings into yours, so the site estimates it. Send the real one:",
  "/iam <gamertag> – once, so I know who you are",
  "/rr 7.4 – your in-game rating for your latest game where you ran the CPU",
  "/rr 7.4 Toz – the same for your latest CPU game against a club whose name contains “Toz”",
].join("\n");

const day = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });

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
  await db`
    insert into match_player_fixes (match_id, player, rating, motm, updated_by)
    values (${game.match_id}, ${player}, ${value}, ${game.motm}, ${`telegram: ${senderName(m)}`})
    on conflict (match_id, player) do update set rating = excluded.rating, updated_by = excluded.updated_by, updated_at = now()`;
  const was = game.rating_est !== null ? `, was ≈ ${Number(game.rating_est).toFixed(1)} est.` : "";
  return `Saved ${value.toFixed(1)} for ${player} vs ${game.opp_name} (${game.goals_for}–${game.goals_against}, ${day(Number(game.ts))}; EA's ${Number(game.ea).toFixed(1)} incl. CPU${was}). Wrong game? Add the club: /rr ${value.toFixed(1)} <club name>`;
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
    default:
      return HELP;
  }
}
