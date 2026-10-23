import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { holdPayload } from "@/lib/hold";
import type { EaPayload } from "@/lib/poller";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Holds another club's EA data until it has a site of its own (lib/hold.ts). Called by the regular
 * check for each club in HOLD_CLUB_IDS. Body: { clubId, payload }.
 */
export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { clubId?: string; payload?: EaPayload } | null;
  const clubId = String(body?.clubId ?? "");
  if (!/^\d{1,12}$/.test(clubId) || !body?.payload) return NextResponse.json({ error: "Need clubId and payload." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await holdPayload(clubId, body.payload)) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
