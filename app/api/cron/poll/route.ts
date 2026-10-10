import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { pollOnce } from "@/lib/poller";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fetches EA from the server itself. EA blocks Vercel's servers, so production uses
 * /api/ingest instead; this stays for hosts that EA does let through.
 */
export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const result = await pollOnce();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
