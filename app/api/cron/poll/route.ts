import { NextResponse } from "next/server";
import { checkEa } from "@/lib/check-ea";
import { checkCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One EA check, started by the database's timer (supabase/migrations/0021_site_checks_ea.sql):
 * every 2 minutes while the club is playing, every 10 otherwise.
 */
export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const result = await checkEa("timer");
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
