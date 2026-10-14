import { createHash } from "node:crypto";
import { CRON_SECRET } from "./config";

/** Bot token from @BotFather. */
export const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN ?? "";

/** Largest file the Bot API lets a bot download. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Screenshots one sender can send per day, and all senders together. */
export const PER_SENDER_PER_DAY = 150;
export const ALL_PER_DAY = 300;

/**
 * Telegram sends this back in X-Telegram-Bot-Api-Secret-Token on every webhook call, so only
 * Telegram can post screenshots. Derived from CRON_SECRET (same in scripts/telegram-setup.mjs).
 */
export function webhookSecret(): string {
  const base = CRON_SECRET.trim();
  return base ? createHash("sha256").update(`telegram:${base}`).digest("hex").slice(0, 48) : "";
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new Error(`Telegram ${method}: ${json?.description ?? res.status}`);
  return json.result as T;
}

export async function reply(chatId: number, text: string, replyTo?: number): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
  }).catch((e) => console.error(e));
}

/** Downloads a file the bot received. */
export async function download(fileId: string): Promise<Buffer> {
  const f = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!f.file_path) throw new Error("Telegram getFile: no file_path");
  if ((f.file_size ?? 0) > MAX_FILE_BYTES) throw new Error("File too big");
  const res = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${f.file_path}`);
  if (!res.ok) throw new Error(`Telegram file download: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

type PhotoSize = { file_id: string; file_unique_id: string; file_size?: number; width: number; height: number };
type Document = { file_id: string; file_unique_id: string; file_size?: number; mime_type?: string; file_name?: string };
export type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  text?: string;
  caption?: string;
  media_group_id?: string;
  photo?: PhotoSize[];
  document?: Document;
};
export type TgUpdate = { update_id: number; message?: TgMessage };

export type Image = { fileId: string; uniqueId: string; size: number; mime: string };

/** The image in a message: the largest size of a photo, or a file sent as an image. */
export function imageOf(m: TgMessage): Image | null {
  if (m.photo?.length) {
    const p = [...m.photo].sort((a, b) => a.width * a.height - b.width * b.height).pop()!;
    return { fileId: p.file_id, uniqueId: p.file_unique_id, size: p.file_size ?? 0, mime: "image/jpeg" };
  }
  const d = m.document;
  if (d && (d.mime_type ?? "").startsWith("image/")) {
    return { fileId: d.file_id, uniqueId: d.file_unique_id, size: d.file_size ?? 0, mime: d.mime_type! };
  }
  return null;
}

export function senderName(m: TgMessage): string {
  const f = m.from;
  if (!f) return "unknown";
  return f.username ?? ([f.first_name, f.last_name].filter(Boolean).join(" ") || String(f.id));
}
