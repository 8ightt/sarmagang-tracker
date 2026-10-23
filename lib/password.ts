import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { CLUB_PASSWORD } from "./config";
import { sql } from "./db";

/**
 * The club password check shared by the edit forms (lib/actions.ts) and setup (app/api/setup):
 * wrong guesses are counted per visitor and for everyone, and lock editing for a while.
 */

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

export async function checkPassword(given: FormDataEntryValue | null): Promise<string | null> {
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

