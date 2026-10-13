// Points the Telegram bot at the site's webhook (/api/telegram).
// Run once, and again if SITE_URL or CRON_SECRET changes:
//   node --env-file=.env.local scripts/telegram-setup.mjs
import { createHash } from "node:crypto";

const token = process.env.TELEGRAM_TOKEN?.trim();
const site = process.env.SITE_URL?.trim().replace(/\/$/, "");
const cron = process.env.CRON_SECRET?.trim();
if (!token || !site || !cron) throw new Error("Set TELEGRAM_TOKEN, SITE_URL and CRON_SECRET in .env.local.");

// same as webhookSecret() in lib/telegram.ts
const secret = createHash("sha256").update(`telegram:${cron}`).digest("hex").slice(0, 48);

async function call(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

const me = await call("getMe");
await call("setWebhook", {
  url: `${site}/api/telegram`,
  secret_token: secret,
  allowed_updates: ["message"],
  drop_pending_updates: false,
});
await call("setMyCommands", { commands: [{ command: "start", description: "How to send screenshots" }] });
const info = await call("getWebhookInfo");
console.log(`@${me.username} → ${info.url}`);
console.log(`pending: ${info.pending_update_count}${info.last_error_message ? `, last error: ${info.last_error_message}` : ""}`);
