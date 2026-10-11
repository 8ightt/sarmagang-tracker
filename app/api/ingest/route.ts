import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { ingest, type EaPayload } from "@/lib/poller";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Receives EA data fetched elsewhere (the GitHub Actions workflow) and saves it.
 * Body: { source, matches: { leagueMatch: [...], ... }, info, overall, members, career, search, leaderboard, opponents, errors }
 */
export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  let payload: EaPayload;
  try {
    payload = (await req.json()) as EaPayload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Empty payload." }, { status: 400 });
  const result = await ingest({ ...payload, source: String(payload.source ?? "ingest") });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
