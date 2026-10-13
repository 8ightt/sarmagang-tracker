import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ALL_PER_DAY,
  MAX_FILE_BYTES,
  PER_SENDER_PER_DAY,
  TELEGRAM_TOKEN,
  download,
  imageOf,
  reply,
  senderName,
  webhookSecret,
  type TgUpdate,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HELP =
  "Send me screenshots from EA FC (Player Performance, Archetypes › Statistics, match facts…) and I'll save them for the Sarma gang tracker.\n\nTip: send them as a file (📎 → File) to keep full quality.";

/** Webhook for the screenshot bot. Telegram calls it with each message (see scripts/telegram-setup.mjs). */
export async function POST(req: Request) {
  const secret = webhookSecret();
  if (!TELEGRAM_TOKEN || !secret) return NextResponse.json({ error: "Bot not configured." }, { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const m = update?.message;
  // other update kinds (edits, joins…): nothing to do
  if (!update || !m) return NextResponse.json({ ok: true });
  const db = sql();

  const img = imageOf(m);
  if (!img) {
    if (m.chat.type === "private") await reply(m.chat.id, HELP);
    return NextResponse.json({ ok: true });
  }
  if (img.size > MAX_FILE_BYTES) {
    await reply(m.chat.id, "That file is too big (max 20 MB).", m.message_id);
    return NextResponse.json({ ok: true });
  }

  const [{ mine, all }] = await db<{ mine: number; all: number }[]>`
    select count(*) filter (where from_id = ${m.from?.id ?? null}) as mine, count(*) as all
    from screenshots where received_at > now() - interval '1 day'`;
  if (mine >= PER_SENDER_PER_DAY || all >= ALL_PER_DAY) {
    await reply(m.chat.id, "That's a lot of screenshots today, try again tomorrow.", m.message_id);
    return NextResponse.json({ ok: true });
  }

  let bytes: Buffer;
  try {
    bytes = await download(img.fileId);
  } catch (e) {
    console.error(e);
    await reply(m.chat.id, "Couldn't download that one, please send it again.", m.message_id);
    return NextResponse.json({ ok: true });
  }

  const saved = await db<{ id: number }[]>`
    insert into screenshots (update_id, chat_id, from_id, from_name, caption, media_group_id,
                             file_id, file_unique_id, mime, size, bytes)
    values (${update.update_id}, ${m.chat.id}, ${m.from?.id ?? null}, ${senderName(m)}, ${m.caption ?? null},
            ${m.media_group_id ?? null}, ${img.fileId}, ${img.uniqueId}, ${img.mime}, ${bytes.length}, ${bytes})
    on conflict do nothing
    returning id`;

  if (!saved.length) {
    await reply(m.chat.id, "Already have that one 👍", m.message_id);
    return NextResponse.json({ ok: true });
  }
  // an album arrives as one message per image: only answer the first
  const firstOfAlbum = m.media_group_id
    ? (await db`select 1 from screenshots where media_group_id = ${m.media_group_id} and id < ${saved[0].id} limit 1`).length === 0
    : true;
  if (firstOfAlbum) await reply(m.chat.id, m.media_group_id ? "Got them ✅" : "Got it ✅", m.message_id);
  return NextResponse.json({ ok: true });
}
