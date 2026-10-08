import { NextResponse } from "next/server";
import { CRON_SECRET } from "@/lib/config";
import { pollOnce } from "@/lib/poller";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Checks EA for new matches and fresh totals.
 * Called by Vercel Cron and the GitHub Actions schedule with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const result = await pollOnce();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
