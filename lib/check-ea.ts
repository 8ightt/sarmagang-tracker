import { clubId, platform, refreshSettings } from "./config";
import { fetchPayload } from "./ea-remote";
import { ingest, pollOnce, type PollResult } from "./poller";

/**
 * One EA check by the site itself: on Vercel through its Python function (api/ea-fetch.py,
 * which gets past EA's bot filter), locally straight from EA. Started by the database's
 * timer (/api/cron/poll, supabase/migrations/0021) and the "Check now" button.
 */
export async function checkEa(source: string): Promise<PollResult> {
  await refreshSettings();
  const id = clubId();
  if (!id) return { ok: false, newMatches: 0, message: "No club set up yet: open /setup." };
  try {
    const payload = await fetchPayload(id, platform());
    if (!payload) return await pollOnce();
    return await ingest({ ...payload, source: `${source}, ${String(payload.source ?? "vercel")}` });
  } catch (err) {
    // logged like any other check, so the site shows it failed
    return ingest({ source, matches: {}, errors: [(err as Error).message] });
  }
}
