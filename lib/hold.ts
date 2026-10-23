import { sql } from "./db";
import type { EaPayload } from "./poller";

const SNAPSHOT_KEYS = ["info", "overall", "members", "career", "search", "leaderboard"] as const;

/**
 * Holds another club's EA data (supabase/migrations/0020) until it has its own site: every match
 * once, with the opponent's Skill Rating when the payload has it, and the latest snapshots.
 * Nothing here touches this site's own club or stats.
 */
export async function holdPayload(clubId: string, payload: EaPayload): Promise<{ matches: number; newMatches: number }> {
  const db = sql();
  let matches = 0;
  let newMatches = 0;
  for (const [type, list] of Object.entries(payload.matches ?? {})) {
    for (const m of list ?? []) {
      const id = String(m.matchId ?? "");
      if (!id) continue;
      const oppId = Object.keys(m.clubs ?? {}).find((k) => k !== clubId);
      const sr = oppId ? Number(payload.opponents?.[oppId]?.skillRating) : NaN;
      const rows = await db`
        insert into held_matches (club_id, match_id, match_type, ts, data, opp_sr)
        values (${clubId}, ${id}, ${type}, ${Number(m.timestamp ?? 0)}, ${db.json(m as never)}, ${Number.isFinite(sr) ? sr : null})
        on conflict (club_id, match_id) do update set opp_sr = coalesce(held_matches.opp_sr, excluded.opp_sr)
        returning (xmax = 0) as inserted`;
      matches++;
      if (rows[0]?.inserted) newMatches++;
    }
  }
  for (const key of SNAPSHOT_KEYS) {
    const data = payload[key];
    if (data === undefined || data === null) continue;
    await db`
      insert into held_snapshots (club_id, key, data, fetched_at) values (${clubId}, ${key}, ${db.json(data as never)}, now())
      on conflict (club_id, key) do update set data = excluded.data, fetched_at = now()`;
  }
  return { matches, newMatches };
}
