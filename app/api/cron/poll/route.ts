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
  const expected = CRON_SECRET.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set on the server. Add it in Vercel → Settings → Environment Variables and redeploy." },
      { status: 503 },
    );
  }
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (given !== expected) {
    return NextResponse.json(
      { error: given ? "CRON_SECRET does not match the one set in Vercel." : "Missing Authorization header." },
      { status: 401 },
    );
  }
  const result = await pollOnce();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
