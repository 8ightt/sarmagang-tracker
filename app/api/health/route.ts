import { NextResponse } from "next/server";
import { lastPoll, savedMatchCount } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const [poll, saved] = await Promise.all([lastPoll(), savedMatchCount()]);
  return NextResponse.json({
    ok: true,
    savedMatches: saved.count,
    lastPoll: poll ? { at: new Date(poll.at).toISOString(), ok: poll.ok, newMatches: poll.newMatches, message: poll.message } : null,
  });
}
