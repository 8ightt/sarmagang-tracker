// Copies new screenshots from the Telegram bot into inbox/ (local only), then clears them
// from the database:  node --env-file=.env.local scripts/telegram-pull.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const safe = (s) => String(s ?? "").replace(/[^\w.-]+/g, "_").slice(0, 40);

mkdirSync("inbox", { recursive: true });
const rows = await sql`
  select id, from_name, caption, mime, bytes, received_at from screenshots
  where pulled_at is null and bytes is not null order by id`;
for (const r of rows) {
  const day = r.received_at.toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const name = `tg-${day}-${safe(r.from_name)}-${r.id}.${ext[r.mime] ?? "jpg"}`;
  writeFileSync(`inbox/${name}`, r.bytes);
  await sql`update screenshots set pulled_at = now(), bytes = null where id = ${r.id}`;
  console.log(`${name}${r.caption ? `  "${r.caption}"` : ""}`);
}
console.log(`${rows.length} new screenshot${rows.length === 1 ? "" : "s"}`);
await sql.end();
